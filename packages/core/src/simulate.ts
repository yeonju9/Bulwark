import { getAction } from './data/skills';
import { levelFromXp } from './xp';
import type { Gains, GameState, SimResult } from './types';

/** 오프라인 진행 인정 상한 (12시간) */
export const DEFAULT_OFFLINE_CAP_MS = 12 * 60 * 60 * 1000;

export interface SimulateOptions {
  maxOfflineMs?: number;
}

function emptyGains(elapsedMs: number, discardedMs: number): Gains {
  return {
    elapsedMs,
    discardedMs,
    xp: {},
    levelUps: {},
    itemsGained: {},
    itemsConsumed: {},
    stopped: null,
  };
}

/**
 * 시뮬레이션의 단일 진입점.
 * (저장된 상태, 현재 시각) → (새 상태, 변화 요약)의 순수 함수이며,
 * 실시간 틱과 오프라인 정산이 모두 이 함수 하나로 처리된다.
 * 클라이언트와 서버가 같은 코드를 실행하므로 서버 측 재검증에도 그대로 쓴다.
 */
export function simulate(state: GameState, now: number, opts?: SimulateOptions): SimResult {
  const cap = opts?.maxOfflineMs ?? DEFAULT_OFFLINE_CAP_MS;
  const rawElapsed = Math.max(0, now - state.lastTickAt);
  const elapsedMs = Math.min(rawElapsed, cap);

  const next = structuredClone(state);
  next.lastTickAt = now;
  const gains = emptyGains(elapsedMs, rawElapsed - elapsedMs);

  if (!next.activeAction || elapsedMs <= 0) {
    return { state: next, gains };
  }

  const action = getAction(next.activeAction.actionId);
  const budgetMs = next.activeAction.progressMs + elapsedMs;
  let cycles = Math.floor(budgetMs / action.durationMs);

  // 제작 액션은 보유 재료만큼만 진행 가능
  if (action.inputs && action.inputs.length > 0) {
    let maxByMaterials = Infinity;
    for (const input of action.inputs) {
      const have = next.inventory[input.itemId] ?? 0;
      maxByMaterials = Math.min(maxByMaterials, Math.floor(have / input.qty));
    }
    if (cycles >= maxByMaterials) {
      cycles = maxByMaterials;
      gains.stopped = 'out-of-materials';
    }
  }

  if (cycles > 0) {
    if (action.inputs) {
      for (const input of action.inputs) {
        const used = input.qty * cycles;
        const left = (next.inventory[input.itemId] ?? 0) - used;
        if (left > 0) next.inventory[input.itemId] = left;
        else delete next.inventory[input.itemId];
        gains.itemsConsumed[input.itemId] = (gains.itemsConsumed[input.itemId] ?? 0) + used;
      }
    }
    for (const output of action.outputs) {
      const got = output.qty * cycles;
      next.inventory[output.itemId] = (next.inventory[output.itemId] ?? 0) + got;
      gains.itemsGained[output.itemId] = (gains.itemsGained[output.itemId] ?? 0) + got;
    }

    const skill = next.skills[action.skillId];
    const levelBefore = levelFromXp(skill.xp);
    skill.xp += action.xp * cycles;
    const levelAfter = levelFromXp(skill.xp);
    gains.xp[action.skillId] = (gains.xp[action.skillId] ?? 0) + action.xp * cycles;
    if (levelAfter > levelBefore) {
      gains.levelUps[action.skillId] = { from: levelBefore, to: levelAfter };
    }
  }

  if (gains.stopped) {
    next.activeAction = null;
  } else {
    next.activeAction.progressMs = budgetMs - cycles * action.durationMs;
  }

  return { state: next, gains };
}
