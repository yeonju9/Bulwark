import {
  actionsForSkill,
  attemptDungeon,
  buyUpgrade,
  createInitialState,
  drinkPotion,
  equipItem,
  getAction,
  getItem,
  getSkill,
  getUpgrade,
  sellItem,
  setCombatFood,
  simulate,
  startAction,
  stopAction,
  unequipItem,
  unlockedActionSlots,
  type ActionId,
  type DungeonId,
  type DungeonResult,
  type EquipSlot,
  type GameState,
  type Gains,
  type ItemId,
  type SkillId,
  type StoppedAction,
} from '@idle-rpg/core';
import { create } from 'zustand';
import { clearSave, loadSave, persistSave } from './save';

export type Panel =
  | SkillId
  | 'inventory'
  | 'shop'
  | 'settings'
  | 'character'
  | 'hunt'
  | 'dungeon'
  | 'collection';

export interface Toast {
  id: number;
  message: string;
}

interface GameStore {
  game: GameState;
  offline: Gains | null;
  panel: Panel;
  toasts: Toast[];
  dungeonResult: DungeonResult | null;
  setPanel(panel: Panel): void;
  tick(): void;
  start(actionId: ActionId): void;
  stop(actionId?: ActionId): void;
  sell(itemId: ItemId, qty: number | 'all'): void;
  equip(itemId: ItemId): void;
  unequip(slot: EquipSlot): void;
  setFood(itemId: ItemId | null): void;
  drink(itemId: ItemId): void;
  buy(skillId: SkillId): void;
  enterDungeon(dungeonId: DungeonId): void;
  dismissDungeonResult(): void;
  dismissOffline(): void;
  save(): void;
  importGame(state: GameState): void;
  resetGame(): void;
  pushToast(message: string): void;
  removeToast(id: number): void;
}

const OFFLINE_MODAL_THRESHOLD_MS = 60_000;
const TOAST_DURATION_MS = 3500;
const MAX_TOASTS = 4;
let toastSeq = 0;

export function stoppedActionText(stopped: StoppedAction): string {
  const name = getAction(stopped.actionId).name;
  return stopped.reason === 'low-hp'
    ? `⚠️ ${name} — 체력이 부족해 사냥을 중단했습니다`
    : `⚠️ ${name} — 재료가 떨어져 중단되었습니다`;
}

function bootstrap(): { game: GameState; offline: Gains | null } {
  const saved = loadSave();
  const base = saved ?? createInitialState(Date.now());
  const { state, gains } = simulate(base, Date.now());
  const offline = saved && gains.elapsedMs >= OFFLINE_MODAL_THRESHOLD_MS ? gains : null;
  return { game: state, offline };
}

/** 한 틱의 변화에서 토스트로 알릴 이벤트를 뽑아낸다 */
function toastMessages(prev: GameState, next: GameState, gains: Gains): string[] {
  const messages: string[] = [];

  for (const [skillId, lv] of Object.entries(gains.levelUps) as [
    SkillId,
    { from: number; to: number },
  ][]) {
    const skill = getSkill(skillId);
    messages.push(`${skill.icon} ${skill.name} Lv ${lv.to} 달성!`);
    for (const action of actionsForSkill(skillId)) {
      if (action.levelRequired > lv.from && action.levelRequired <= lv.to) {
        messages.push(`${action.icon} ${action.name} 해금!`);
      }
    }
  }

  const slotsAfter = unlockedActionSlots(next);
  if (slotsAfter > unlockedActionSlots(prev)) {
    messages.push(`✨ 작업 슬롯 확장! 이제 ${slotsAfter}개 작업을 동시에 진행할 수 있습니다`);
  }

  for (const stopped of gains.stopped) {
    messages.push(stoppedActionText(stopped));
  }

  return messages;
}

export const useGame = create<GameStore>((set, get) => ({
  ...bootstrap(),
  panel: 'woodcutting',
  toasts: [],
  dungeonResult: null,

  setPanel: (panel) => set({ panel }),

  tick: () => {
    const prev = get().game;
    const { state, gains } = simulate(prev, Date.now());
    set({ game: state });
    // 오프라인 정산 모달이 떠 있는 동안은 토스트 억제 (모달이 같은 내용을 보여줌)
    if (!get().offline) {
      for (const message of toastMessages(prev, state, gains)) {
        get().pushToast(message);
      }
    }
  },

  start: (actionId) => {
    const settled = simulate(get().game, Date.now()).state;
    const { state, error } = startAction(settled, actionId);
    if (!error) set({ game: state });
  },

  stop: (actionId) => {
    const settled = simulate(get().game, Date.now()).state;
    set({ game: stopAction(settled, actionId).state });
  },

  sell: (itemId, qty) => {
    const settled = simulate(get().game, Date.now()).state;
    const { state, error } = sellItem(settled, itemId, qty);
    if (!error) set({ game: state });
  },

  equip: (itemId) => {
    const settled = simulate(get().game, Date.now()).state;
    const { state, error } = equipItem(settled, itemId);
    if (error === 'level-too-low') get().pushToast('❌ 공격 레벨이 부족해 장착할 수 없습니다');
    if (!error) set({ game: state });
  },

  unequip: (slot) => {
    const settled = simulate(get().game, Date.now()).state;
    set({ game: unequipItem(settled, slot).state });
  },

  setFood: (itemId) => {
    const settled = simulate(get().game, Date.now()).state;
    const { state, error } = setCombatFood(settled, itemId);
    if (!error) set({ game: state });
  },

  drink: (itemId) => {
    const settled = simulate(get().game, Date.now()).state;
    const { state, error } = drinkPotion(settled, itemId, Date.now());
    if (error) return;
    set({ game: state });
    const item = getItem(itemId);
    const minutes = Math.round(item.potion!.durationMs / 60_000);
    get().pushToast(`${item.icon} ${item.name} 효과 발동! (${minutes}분)`);
  },

  buy: (skillId) => {
    const settled = simulate(get().game, Date.now()).state;
    const { state, error } = buyUpgrade(settled, skillId);
    if (error === 'not-enough-gold') {
      get().pushToast('❌ 골드가 부족합니다');
      return;
    }
    if (error) return;
    const stage = state.upgrades[skillId]!;
    const upgrade = getUpgrade(skillId)!;
    set({ game: state });
    get().pushToast(`${upgrade.icon} ${upgrade.stages[stage - 1].name} 구매! 채집 속도 상승`);
  },

  enterDungeon: (dungeonId) => {
    const settled = simulate(get().game, Date.now()).state;
    const { state, error, result } = attemptDungeon(settled, dungeonId, Date.now());
    if (error === 'combat-in-progress') {
      get().pushToast('❌ 사냥을 중단한 뒤 던전에 입장할 수 있습니다');
      return;
    }
    if (error === 'on-cooldown') {
      get().pushToast('⏳ 아직 재정비 중입니다');
      return;
    }
    if (!error && result) {
      set({ game: state, dungeonResult: result });
      persistSave(state);
    }
  },

  dismissDungeonResult: () => set({ dungeonResult: null }),

  dismissOffline: () => set({ offline: null }),

  save: () => persistSave(get().game),

  importGame: (imported) => {
    const { state } = simulate(imported, Date.now());
    set({ game: state, offline: null });
    persistSave(state);
    get().pushToast('💾 세이브를 불러왔습니다');
  },

  resetGame: () => {
    clearSave();
    const fresh = createInitialState(Date.now());
    set({ game: fresh, offline: null, panel: 'woodcutting' });
    persistSave(fresh);
    get().pushToast('🔄 진행이 초기화되었습니다');
  },

  pushToast: (message) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, message }].slice(-MAX_TOASTS) }));
    setTimeout(() => get().removeToast(id), TOAST_DURATION_MS);
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
