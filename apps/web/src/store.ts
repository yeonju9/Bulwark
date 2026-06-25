import {
  actionsForSkill,
  attemptDungeon,
  buildBuilding,
  buyUpgrade,
  createInitialState,
  drinkPotion,
  equipItem,
  getAction,
  getItem,
  getSkill,
  reinforceWall,
  repairBuilding,
  selectWaveTier,
  sellItem,
  setCombatFood,
  simulate,
  startAction,
  stopAction,
  unequipItem,
  unlockedActionSlots,
  type ActionId,
  type BuildingId,
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

export type Panel = SkillId | 'inventory' | 'shop' | 'settings' | 'map' | 'collection';

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
  build(cellIndex: number, buildingId: BuildingId): void;
  reinforce(): void;
  repair(cellIndex: number): void;
  selectTier(tier: number): void;
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
  return `⚠️ ${name} — 재료가 떨어져 중단되었습니다`;
}

function bootstrap(): { game: GameState; offline: Gains | null } {
  const saved = loadSave();
  const base = saved ?? createInitialState(Date.now());
  // 저장된 세이브가 있으면 오프라인 복귀 정산 (웨이브 보상 50%)
  const { state, gains } = simulate(base, Date.now(), { offline: Boolean(saved) });
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

  if (gains.wave?.defeated) {
    const what =
      gains.wave.damaged === 'wall'
        ? ' 성벽이 한 단계 무너졌습니다.'
        : gains.wave.damaged === 'barracks'
          ? ' 병영이 파손되었습니다.'
          : '';
    messages.push(`🛡️ 마을이 함락되어 농성에 들어갔습니다!${what} 수리·강화로 방어를 재개하세요`);
  } else if (gains.wave && gains.wave.wavesWon > 0) {
    // 막아낸 웨이브 — 번호 + 보상 요약 (패배 시엔 농성 메시지로 대체)
    const n = next.village.wavesProcessed;
    const reward = [
      gains.wave.goldWon > 0 ? `🪙 ${gains.wave.goldWon}` : '',
      gains.wave.xpWon > 0 ? `+${gains.wave.xpWon} XP` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    messages.push(`🛡️ 웨이브 #${n} 격퇴!${reward ? ` ${reward}` : ''}`);
  }

  for (const stopped of gains.stopped) {
    messages.push(stoppedActionText(stopped));
  }

  return messages;
}

export const useGame = create<GameStore>((set, get) => ({
  ...bootstrap(),
  panel: 'map',
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
    const upgrade = getSkill(skillId);
    set({ game: state });
    get().pushToast(`${upgrade.icon} ${upgrade.name} 도구 강화! (${stage}단계) 채집 속도 상승`);
  },

  enterDungeon: (dungeonId) => {
    const settled = simulate(get().game, Date.now()).state;
    const { state, error, result } = attemptDungeon(settled, dungeonId);
    if (error) return;
    if (result) {
      set({ game: state, dungeonResult: result });
      persistSave(state);
    }
  },

  build: (cellIndex, buildingId) => {
    const settled = simulate(get().game, Date.now()).state;
    const { state, error } = buildBuilding(settled, cellIndex, buildingId);
    if (error === 'not-enough-gold') get().pushToast('❌ 골드가 부족합니다');
    else if (error === 'missing-materials') get().pushToast('❌ 자원이 부족합니다');
    if (!error) set({ game: state });
  },

  reinforce: () => {
    const settled = simulate(get().game, Date.now()).state;
    const { state, error } = reinforceWall(settled);
    if (error === 'not-enough-gold') get().pushToast('❌ 골드가 부족합니다');
    else if (error === 'missing-materials') get().pushToast('❌ 자원이 부족합니다');
    else if (error === 'max-wall') get().pushToast('성벽이 이미 최대 레벨입니다');
    if (!error) set({ game: state });
  },

  repair: (cellIndex) => {
    const settled = simulate(get().game, Date.now()).state;
    const { state, error } = repairBuilding(settled, cellIndex);
    if (error === 'not-enough-gold') get().pushToast('❌ 골드가 부족합니다');
    else if (error === 'missing-materials') get().pushToast('❌ 자원이 부족합니다');
    if (!error) set({ game: state });
  },

  selectTier: (tier) => {
    const settled = simulate(get().game, Date.now()).state;
    const { state, error } = selectWaveTier(settled, tier);
    if (error === 'tier-locked') {
      get().pushToast('🔒 던전을 더 클리어해야 해금됩니다');
      return;
    }
    if (!error) set({ game: state });
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
    set({ game: fresh, offline: null, panel: 'map' });
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
