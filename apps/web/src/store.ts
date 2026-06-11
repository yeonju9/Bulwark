import {
  actionsForSkill,
  createInitialState,
  getAction,
  getSkill,
  sellItem,
  simulate,
  startAction,
  stopAction,
  unlockedActionSlots,
  type ActionId,
  type GameState,
  type Gains,
  type ItemId,
  type SkillId,
} from '@idle-rpg/core';
import { create } from 'zustand';
import { clearSave, loadSave, persistSave } from './save';

export type Panel = SkillId | 'inventory' | 'settings';

export interface Toast {
  id: number;
  message: string;
}

interface GameStore {
  game: GameState;
  offline: Gains | null;
  panel: Panel;
  toasts: Toast[];
  setPanel(panel: Panel): void;
  tick(): void;
  start(actionId: ActionId): void;
  stop(actionId?: ActionId): void;
  sell(itemId: ItemId, qty: number | 'all'): void;
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
    messages.push(`⚠️ ${getAction(stopped.actionId).name} — 재료가 떨어져 중단되었습니다`);
  }

  return messages;
}

export const useGame = create<GameStore>((set, get) => ({
  ...bootstrap(),
  panel: 'woodcutting',
  toasts: [],

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
