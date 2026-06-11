import { grantXp, settleHunt } from './combat/hunt';
import { computeStats, REGEN_PER_MINUTE_PER_HP_LEVEL } from './combat/stats';
import { getAction } from './data/skills';
import type { ActiveAction, Gains, GameState, SimResult } from './types';

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
    kills: {},
    stopped: [],
  };
}

/**
 * 시뮬레이션의 단일 진입점.
 * (저장된 상태, 현재 시각) → (새 상태, 변화 요약)의 순수 함수이며,
 * 실시간 틱과 오프라인 정산이 모두 이 함수 하나로 처리된다.
 * 클라이언트와 서버가 같은 코드를 실행하므로 서버 측 재검증에도 그대로 쓴다.
 *
 * 동시 작업은 슬롯 배열 순서대로 순차 정산한다. 한 정산 구간 안에서
 * 생산 작업의 산출물을 뒤 순서의 소비 작업이 쓸 수 있다는 단순화가 있지만,
 * 실시간(200ms 틱)에서는 오차가 무시할 수준이고 오프라인 정산에서도
 * 슬롯 순서가 고정이므로 결정성은 유지된다.
 */
export function simulate(state: GameState, now: number, opts?: SimulateOptions): SimResult {
  const cap = opts?.maxOfflineMs ?? DEFAULT_OFFLINE_CAP_MS;
  const rawElapsed = Math.max(0, now - state.lastTickAt);
  const elapsedMs = Math.min(rawElapsed, cap);

  const next = structuredClone(state);
  next.lastTickAt = now;
  const gains = emptyGains(elapsedMs, rawElapsed - elapsedMs);

  if (elapsedMs <= 0) {
    return { state: next, gains };
  }

  const stillActive: ActiveAction[] = [];
  let combatActive = false;

  for (const active of next.activeActions) {
    const action = getAction(active.actionId);

    if (action.combat) {
      const keep = settleHunt(next, active, action, elapsedMs, gains);
      if (keep) {
        stillActive.push(active);
        combatActive = true;
      }
      continue;
    }

    const budgetMs = active.progressMs + elapsedMs;
    let cycles = Math.floor(budgetMs / action.durationMs);
    let outOfMaterials = false;

    // 제작 액션은 보유 재료만큼만 진행 가능
    if (action.inputs && action.inputs.length > 0) {
      let maxByMaterials = Infinity;
      for (const input of action.inputs) {
        const have = next.inventory[input.itemId] ?? 0;
        maxByMaterials = Math.min(maxByMaterials, Math.floor(have / input.qty));
      }
      if (cycles >= maxByMaterials) {
        cycles = maxByMaterials;
        outOfMaterials = true;
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
      grantXp(next, gains, action.skillId, action.xp * cycles);
    }

    if (outOfMaterials) {
      gains.stopped.push({ actionId: action.id, reason: 'out-of-materials' });
    } else {
      active.progressMs = budgetMs - cycles * action.durationMs;
      stillActive.push(active);
    }
  }

  next.activeActions = stillActive;

  // 비전투 시 HP 자연 회복: 분당 체력 레벨만큼
  if (!combatActive) {
    const stats = computeStats(next);
    next.hp = Math.min(
      stats.maxHp,
      next.hp + (elapsedMs / 60_000) * stats.hpLevel * REGEN_PER_MINUTE_PER_HP_LEVEL,
    );
  }

  return { state: next, gains };
}
