import { effectiveCycleMs } from './buffs';
import { grantXp, settleHunt } from './combat/hunt';
import { computeStats, REGEN_PER_MINUTE_PER_HP_LEVEL } from './combat/stats';
import { getMonster } from './data/monsters';
import { getAction } from './data/skills';
import { seededRolls } from './rng';
import type { ActionId, ActiveAction, Gains, GameState, ItemId, SimResult } from './types';

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
 * 버프(물약)가 있으면 만료 시각을 경계로 구간을 나눠 순차 정산한다 —
 * 구간 안에서는 버프 셋이 고정이라, 오프라인 중 버프가 만료되어도
 * 실시간으로 플레이했을 때와 같은 결과가 나온다.
 */
export function simulate(state: GameState, now: number, opts?: SimulateOptions): SimResult {
  const cap = opts?.maxOfflineMs ?? DEFAULT_OFFLINE_CAP_MS;
  const rawElapsed = Math.max(0, now - state.lastTickAt);
  const elapsedMs = Math.min(rawElapsed, cap);

  const next = structuredClone(state);
  const simStart = next.lastTickAt;
  next.lastTickAt = now;
  const gains = emptyGains(elapsedMs, rawElapsed - elapsedMs);

  // 시작 시점에 이미 만료된 버프 정리
  next.buffs = next.buffs.filter((b) => b.expiresAtMs > simStart);

  if (elapsedMs > 0) {
    let t = simStart;
    const end = simStart + elapsedMs;
    while (t < end) {
      let boundary = end;
      for (const buff of next.buffs) {
        if (buff.expiresAtMs > t && buff.expiresAtMs < boundary) boundary = buff.expiresAtMs;
      }
      settleSpan(next, boundary - t, gains);
      t = boundary;
      next.buffs = next.buffs.filter((b) => b.expiresAtMs > t);
    }
  }

  // 오프라인 상한으로 정산 창이 잘렸어도 현재 시각 기준 만료 버프는 제거
  next.buffs = next.buffs.filter((b) => b.expiresAtMs > now);

  return { state: next, gains };
}

/**
 * 다른 활성 작업이 해당 아이템을 공급하는가 (산출물·부산물·전투 전리품).
 * 활성 작업 목록만 보므로 틱 패턴과 무관하게 같은 판정이 나온다.
 * 소비 작업의 "재료 대기" 판정과 시작 허용 판정이 공유한다.
 */
export function activelySupplied(state: GameState, itemId: ItemId, exceptActionId: ActionId): boolean {
  for (const other of state.activeActions) {
    if (other.actionId === exceptActionId) continue;
    const def = getAction(other.actionId);
    if (def.outputs.some((o) => o.itemId === itemId)) return true;
    if (def.byproducts?.some((b) => b.itemId === itemId)) return true;
    if (def.combat && getMonster(def.combat.monsterId).lootTable.some((l) => l.itemId === itemId)) {
      return true;
    }
  }
  return false;
}

/**
 * 고정된 버프 셋 아래에서 spanMs만큼 모든 작업을 정산한다. state를 직접 변형.
 *
 * 동시 작업은 슬롯 배열 순서대로 순차 정산한다. 한 정산 구간 안에서
 * 생산 작업의 산출물을 뒤 순서의 소비 작업이 쓸 수 있다는 단순화가 있지만,
 * 실시간(200ms 틱)에서는 오차가 무시할 수준이고 오프라인 정산에서도
 * 슬롯 순서가 고정이므로 결정성은 유지된다.
 */
function settleSpan(next: GameState, spanMs: number, gains: Gains): void {
  const stillActive: ActiveAction[] = [];
  let combatActive = false;

  for (const active of next.activeActions) {
    const action = getAction(active.actionId);

    if (action.combat) {
      const keep = settleHunt(next, active, action, spanMs, gains);
      if (keep) {
        stillActive.push(active);
        combatActive = true;
      }
      continue;
    }

    const cycleMs = effectiveCycleMs(action, next);
    const budgetMs = active.progressMs + spanMs;
    let cycles = Math.floor(budgetMs / cycleMs);
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

      // 부산물(약초 등): 액션별 누적 사이클 순번 시드 — 틱 패턴 무관 동일 결과
      if (action.byproducts && action.byproducts.length > 0) {
        const cyclesBefore = next.actionCycles[action.id] ?? 0;
        for (let i = 0; i < cycles; i++) {
          const roll = seededRolls(action.id, cyclesBefore + i);
          for (const entry of action.byproducts) {
            if (roll() < entry.chance) {
              next.inventory[entry.itemId] = (next.inventory[entry.itemId] ?? 0) + entry.qty;
              gains.itemsGained[entry.itemId] = (gains.itemsGained[entry.itemId] ?? 0) + entry.qty;
            }
          }
        }
        next.actionCycles[action.id] = cyclesBefore + cycles;
      }

      grantXp(next, gains, action.skillId, action.xp * cycles);
    }

    if (outOfMaterials) {
      // 부족한 재료를 전부 다른 활성 작업이 공급 중이면(낚시→요리 등) 중단하지 않고
      // 대기한다. 재료가 없는 동안 사이클 진행도는 쌓이지 않는다 — 진행도를 누적하면
      // 재료가 도착하는 순간 사이클이 일괄 폭발해 틱 패턴에 따라 결과가 달라진다.
      const missing = (action.inputs ?? []).filter(
        (input) => (next.inventory[input.itemId] ?? 0) < input.qty,
      );
      if (missing.every((input) => activelySupplied(next, input.itemId, action.id))) {
        active.progressMs = 0;
        stillActive.push(active);
      } else {
        gains.stopped.push({ actionId: action.id, reason: 'out-of-materials' });
      }
    } else {
      active.progressMs = budgetMs - cycles * cycleMs;
      stillActive.push(active);
    }
  }

  next.activeActions = stillActive;

  // 비전투 시 HP 자연 회복: 분당 체력 레벨만큼
  if (!combatActive) {
    const stats = computeStats(next);
    next.hp = Math.min(
      stats.maxHp,
      next.hp + (spanMs / 60_000) * stats.hpLevel * REGEN_PER_MINUTE_PER_HP_LEVEL,
    );
  }
}
