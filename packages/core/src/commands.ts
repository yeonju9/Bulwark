import { getItem, ITEMS } from './data/items';
import { ACTIONS } from './data/skills';
import { getUpgrade } from './data/upgrades';
import { activelySupplied } from './simulate';
import { unlockedActionSlots } from './slots';
import { levelFromXp } from './xp';
import type { ActionId, EquipSlot, GameState, ItemId, SkillId } from './types';

export type CommandError =
  | 'unknown-action'
  | 'level-too-low'
  | 'missing-materials'
  | 'unknown-item'
  | 'not-enough-items'
  | 'not-equippable'
  | 'not-food'
  | 'not-potion'
  | 'unknown-upgrade'
  | 'max-stage'
  | 'not-enough-gold';

export interface CommandResult {
  state: GameState;
  error?: CommandError;
}

/**
 * 플레이어 조작은 모두 이 커맨드들을 통해 상태를 바꾼다.
 * 호출 전에 simulate()로 시간을 정산한 상태를 넘기는 것이 전제.
 * 실패 시 원본 상태를 그대로 돌려주고 error를 채운다.
 */

/**
 * 작업 시작 규칙:
 * - 같은 스킬의 작업이 이미 돌고 있으면 그 작업을 교체한다 (슬롯 소모 없음)
 * - 빈 슬롯이 있으면 새 슬롯에서 시작한다
 * - 슬롯이 가득 차 있으면 가장 오래된 작업을 멈추고 교체한다
 */
export function startAction(state: GameState, actionId: ActionId): CommandResult {
  const action = ACTIONS.get(actionId);
  if (!action) return { state, error: 'unknown-action' };

  const level = levelFromXp(state.skills[action.skillId].xp);
  if (level < action.levelRequired) return { state, error: 'level-too-low' };

  const next = structuredClone(state);
  const newAction = { skillId: action.skillId, actionId: action.id, progressMs: 0 };

  const sameSkillIndex = next.activeActions.findIndex((a) => a.skillId === action.skillId);
  if (sameSkillIndex >= 0) {
    next.activeActions[sameSkillIndex] = newAction;
  } else {
    if (next.activeActions.length >= unlockedActionSlots(next)) {
      next.activeActions.shift();
    }
    next.activeActions.push(newAction);
  }

  // 재료 검사는 교체/축출이 반영된 최종 슬롯 구성으로 한다 — 부족한 재료라도
  // 함께 돌아갈 작업이 공급한다면(낚시→요리) 시작을 허용하고 simulate가 대기시킨다
  for (const input of action.inputs ?? []) {
    if (
      (next.inventory[input.itemId] ?? 0) < input.qty &&
      !activelySupplied(next, input.itemId, action.id)
    ) {
      return { state, error: 'missing-materials' };
    }
  }
  return { state: next };
}

/** actionId를 주면 해당 작업만, 생략하면 모든 작업을 중지한다 */
export function stopAction(state: GameState, actionId?: ActionId): CommandResult {
  if (state.activeActions.length === 0) return { state };
  const next = structuredClone(state);
  next.activeActions = actionId
    ? next.activeActions.filter((a) => a.actionId !== actionId)
    : [];
  return { state: next };
}

/** 인벤토리의 장비를 장착. 같은 슬롯에 끼고 있던 장비는 인벤토리로 돌아간다 */
export function equipItem(state: GameState, itemId: ItemId): CommandResult {
  const item = ITEMS.get(itemId);
  if (!item) return { state, error: 'unknown-item' };
  if (!item.equip) return { state, error: 'not-equippable' };
  if ((state.inventory[itemId] ?? 0) < 1) return { state, error: 'not-enough-items' };
  const attackLevel = levelFromXp(state.skills.attack.xp);
  if (attackLevel < (item.equip.levelRequired ?? 1)) return { state, error: 'level-too-low' };

  const next = structuredClone(state);
  const slot = item.equip.slot;
  const left = next.inventory[itemId]! - 1;
  if (left > 0) next.inventory[itemId] = left;
  else delete next.inventory[itemId];
  const previous = next.equipment[slot];
  if (previous) next.inventory[previous] = (next.inventory[previous] ?? 0) + 1;
  next.equipment[slot] = itemId;
  return { state: next };
}

export function unequipItem(state: GameState, slot: EquipSlot): CommandResult {
  const equipped = state.equipment[slot];
  if (!equipped) return { state };
  const next = structuredClone(state);
  next.inventory[equipped] = (next.inventory[equipped] ?? 0) + 1;
  next.equipment[slot] = null;
  return { state: next };
}

/** 사냥 중 자동 섭취할 음식 지정 (null이면 해제) */
export function setCombatFood(state: GameState, itemId: ItemId | null): CommandResult {
  if (itemId !== null) {
    const item = ITEMS.get(itemId);
    if (!item) return { state, error: 'unknown-item' };
    if (!item.food) return { state, error: 'not-food' };
  }
  const next = structuredClone(state);
  next.combatFood = itemId;
  return { state: next };
}

/**
 * 물약 마시기. 같은 카테고리의 기존 버프는 교체된다 (동시 적용 카테고리별 1개).
 * 호출 전에 simulate()로 정산된 상태를 넘기는 것이 전제 — now는 만료 시각 계산에 쓴다.
 */
export function drinkPotion(state: GameState, itemId: ItemId, now: number): CommandResult {
  const item = ITEMS.get(itemId);
  if (!item) return { state, error: 'unknown-item' };
  if (!item.potion) return { state, error: 'not-potion' };
  if ((state.inventory[itemId] ?? 0) < 1) return { state, error: 'not-enough-items' };

  const next = structuredClone(state);
  const left = next.inventory[itemId]! - 1;
  if (left > 0) next.inventory[itemId] = left;
  else delete next.inventory[itemId];

  next.buffs = next.buffs.filter((b) => b.category !== item.potion!.category);
  next.buffs.push({
    itemId,
    category: item.potion.category,
    expiresAtMs: now + item.potion.durationMs,
  });
  return { state: next };
}

/** 상점: 도구 업그레이드 구매 (골드 차감, 단계 +1) */
export function buyUpgrade(state: GameState, skillId: SkillId): CommandResult {
  const upgrade = getUpgrade(skillId);
  if (!upgrade) return { state, error: 'unknown-upgrade' };
  const stage = state.upgrades[skillId] ?? 0;
  if (stage >= upgrade.stages.length) return { state, error: 'max-stage' };
  const price = upgrade.stages[stage].price;
  if (state.gold < price) return { state, error: 'not-enough-gold' };

  const next = structuredClone(state);
  next.gold -= price;
  next.upgrades[skillId] = stage + 1;
  return { state: next };
}

export function sellItem(state: GameState, itemId: ItemId, qty: number | 'all'): CommandResult {
  if (!ITEMS.has(itemId)) return { state, error: 'unknown-item' };
  const have = state.inventory[itemId] ?? 0;
  const amount = qty === 'all' ? have : Math.floor(qty);
  if (amount <= 0 || have < amount) return { state, error: 'not-enough-items' };

  const next = structuredClone(state);
  const left = have - amount;
  if (left > 0) next.inventory[itemId] = left;
  else delete next.inventory[itemId];
  next.gold += getItem(itemId).sellPrice * amount;
  return { state: next };
}
