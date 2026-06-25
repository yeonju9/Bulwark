import { computeVillageStats } from './combat/village';
import { BUILDINGS, repairCost, wallReinforceCost } from './data/buildings';
import { getItem, ITEMS } from './data/items';
import { ACTIONS } from './data/skills';
import { unlockedTier } from './data/stages';
import { getUpgrade } from './data/upgrades';
import { activelySupplied } from './simulate';
import { unlockedActionSlots } from './slots';
import { levelFromXp } from './xp';
import type { ActionId, BuildingId, EquipSlot, GameState, ItemId, ItemStack, SkillId } from './types';

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
  | 'not-enough-gold'
  | 'unknown-building'
  | 'not-buildable'
  | 'invalid-cell'
  | 'cell-occupied'
  | 'not-damaged'
  | 'max-wall'
  | 'tier-locked';

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

// ─── 마을 방어 커맨드 ───
// 건설·강화·수리는 모두 농성을 해제하고, 농성 중이었다면 마을을 가득 채운 채 방어를 재개한다.

/** 보유 골드·자원이 비용을 감당하는지 검사 */
function canAfford(state: GameState, gold: number, items: ItemStack[]): CommandError | null {
  if (state.gold < gold) return 'not-enough-gold';
  for (const it of items) {
    if ((state.inventory[it.itemId] ?? 0) < it.qty) return 'missing-materials';
  }
  return null;
}

/** 비용 차감 (검사는 호출 측에서 끝낸 전제) */
function payCost(state: GameState, gold: number, items: ItemStack[]): void {
  state.gold -= gold;
  for (const it of items) {
    const left = (state.inventory[it.itemId] ?? 0) - it.qty;
    if (left > 0) state.inventory[it.itemId] = left;
    else delete state.inventory[it.itemId];
  }
}

/** 농성 해제: 마을을 가득 채우고 방어를 재개한다 (수리/강화/건설 성공 시) */
function liftSiege(state: GameState): void {
  if (!state.village.underSiege) return;
  state.village.underSiege = false;
  state.village.waveProgressMs = 0;
  state.village.hp = computeVillageStats(state).maxHp;
}

/** 빈 터(cellIndex)에 건물을 건설. 같은 건물 중복 건설 가능 */
export function buildBuilding(state: GameState, cellIndex: number, buildingId: BuildingId): CommandResult {
  const def = BUILDINGS.get(buildingId);
  if (!def) return { state, error: 'unknown-building' };
  if (def.fixed) return { state, error: 'not-buildable' };
  if (cellIndex < 0 || cellIndex >= state.village.buildings.length) return { state, error: 'invalid-cell' };
  if (state.village.buildings[cellIndex] !== null) return { state, error: 'cell-occupied' };

  const err = canAfford(state, def.buildGold ?? 0, def.buildItems ?? []);
  if (err) return { state, error: err };

  const next = structuredClone(state);
  payCost(next, def.buildGold ?? 0, def.buildItems ?? []);
  next.village.buildings[cellIndex] = { id: buildingId, damaged: false };
  liftSiege(next);
  return { state: next };
}

/** 파손된 건물 수리 (효과 재개) */
export function repairBuilding(state: GameState, cellIndex: number): CommandResult {
  const slot = state.village.buildings[cellIndex];
  if (!slot) return { state, error: 'invalid-cell' };
  if (!slot.damaged) return { state, error: 'not-damaged' };

  const cost = repairCost(slot.id);
  const err = canAfford(state, cost.gold, cost.items);
  if (err) return { state, error: err };

  const next = structuredClone(state);
  payCost(next, cost.gold, cost.items);
  next.village.buildings[cellIndex]!.damaged = false;
  liftSiege(next);
  return { state: next };
}

/** 성벽 외곽 링 강화 (레벨 +1 → 최대 HP·방어력 상승). 패배 시 가장 먼저 무너지는 구조물 */
export function reinforceWall(state: GameState): CommandResult {
  const cost = wallReinforceCost(state.village.wallLevel);
  if (!cost) return { state, error: 'max-wall' };

  const err = canAfford(state, cost.gold, cost.items);
  if (err) return { state, error: err };

  const next = structuredClone(state);
  payCost(next, cost.gold, cost.items);
  next.village.wallLevel += 1;
  liftSiege(next);
  return { state: next };
}

/** 웨이브 난이도(티어) 선택. 해금 범위 안에서만 가능 (난이도 ∝ 보상) */
export function selectWaveTier(state: GameState, tier: number): CommandResult {
  if (tier < 1 || tier > unlockedTier(state)) return { state, error: 'tier-locked' };
  const next = structuredClone(state);
  next.waveTier = tier;
  return { state: next };
}
