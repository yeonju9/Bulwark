import {
  createInitialState,
  sellItem,
  simulate,
  startAction,
  stopAction,
  type ActionId,
  type GameState,
  type Gains,
  type ItemId,
  type SkillId,
} from '@idle-rpg/core';
import { create } from 'zustand';
import { loadSave, persistSave } from './save';

export type Panel = SkillId | 'inventory';

interface GameStore {
  game: GameState;
  offline: Gains | null;
  panel: Panel;
  setPanel(panel: Panel): void;
  tick(): void;
  start(actionId: ActionId): void;
  stop(actionId?: ActionId): void;
  sell(itemId: ItemId, qty: number | 'all'): void;
  dismissOffline(): void;
  save(): void;
}

const OFFLINE_MODAL_THRESHOLD_MS = 60_000;

function bootstrap(): { game: GameState; offline: Gains | null } {
  const saved = loadSave();
  const base = saved ?? createInitialState(Date.now());
  const { state, gains } = simulate(base, Date.now());
  const offline = saved && gains.elapsedMs >= OFFLINE_MODAL_THRESHOLD_MS ? gains : null;
  return { game: state, offline };
}

export const useGame = create<GameStore>((set, get) => ({
  ...bootstrap(),
  panel: 'woodcutting',

  setPanel: (panel) => set({ panel }),

  tick: () => {
    const { state } = simulate(get().game, Date.now());
    set({ game: state });
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
}));
