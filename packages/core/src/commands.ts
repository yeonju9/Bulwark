import { getItem, ITEMS } from './data/items';
import { ACTIONS } from './data/skills';
import { unlockedActionSlots } from './slots';
import { levelFromXp } from './xp';
import type { ActionId, GameState, ItemId } from './types';

export type CommandError =
  | 'unknown-action'
  | 'level-too-low'
  | 'missing-materials'
  | 'unknown-item'
  | 'not-enough-items';

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

  if (action.inputs) {
    for (const input of action.inputs) {
      if ((state.inventory[input.itemId] ?? 0) < input.qty) {
        return { state, error: 'missing-materials' };
      }
    }
  }

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
