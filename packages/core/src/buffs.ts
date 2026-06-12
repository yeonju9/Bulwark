import { getItem } from './data/items';
import { UPGRADE_SPEED_PER_STAGE } from './data/upgrades';
import type { ActionDef, GameState } from './types';

/**
 * 도구 업그레이드·물약 버프가 반영된 실제 사이클 시간(ms).
 * 정수로 반올림한다 — 진행도 산술을 정수로 유지해야
 * 실시간 틱과 오프라인 일괄 정산이 완전히 같은 결과를 낸다.
 */
export function effectiveCycleMs(action: ActionDef, state: GameState): number {
  let mult = Math.pow(UPGRADE_SPEED_PER_STAGE, state.upgrades[action.skillId] ?? 0);
  for (const buff of state.buffs) {
    const cycleTime = getItem(buff.itemId).potion?.effect.cycleTime;
    if (cycleTime && cycleTime.skillId === action.skillId) mult *= cycleTime.multiplier;
  }
  return Math.max(1, Math.round(action.durationMs * mult));
}

/** 활성 전투 물약의 공격/방어 배율 (없으면 1) */
export function combatBuffMultipliers(state: GameState): { attack: number; defense: number } {
  let attack = 1;
  let defense = 1;
  for (const buff of state.buffs) {
    const effect = getItem(buff.itemId).potion?.effect;
    if (effect?.attack) attack *= effect.attack;
    if (effect?.defense) defense *= effect.defense;
  }
  return { attack, defense };
}
