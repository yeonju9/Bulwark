import { levelFromXp } from './xp';
import type { GameState } from './types';

/**
 * 작업 슬롯 해금 규칙.
 * 1슬롯으로 시작하고, 총 레벨(모든 스킬 레벨의 합)이 기준에 도달하면 확장된다.
 * 장기적으로는 던전 클리어/시즌 보상 등 다른 해금 조건이 추가될 수 있다.
 */
export const SLOT_UNLOCKS: ReadonlyArray<{ slots: number; totalLevel: number }> = [
  { slots: 2, totalLevel: 30 },
  { slots: 3, totalLevel: 90 },
];

export function totalLevel(state: GameState): number {
  return Object.values(state.skills).reduce((sum, s) => sum + levelFromXp(s.xp), 0);
}

export function unlockedActionSlots(state: GameState): number {
  const total = totalLevel(state);
  let slots = 1;
  for (const unlock of SLOT_UNLOCKS) {
    if (total >= unlock.totalLevel) slots = unlock.slots;
  }
  return slots;
}

/** 다음 슬롯 해금 조건. 모두 해금했으면 null */
export function nextSlotUnlock(state: GameState): { slots: number; totalLevel: number } | null {
  const total = totalLevel(state);
  return SLOT_UNLOCKS.find((u) => total < u.totalLevel) ?? null;
}
