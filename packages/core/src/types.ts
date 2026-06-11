export type SkillId = 'woodcutting' | 'mining' | 'smithing';

export type ItemId = string;
export type ActionId = string;

export interface ItemDef {
  id: ItemId;
  name: string;
  icon: string;
  sellPrice: number;
}

export interface ItemStack {
  itemId: ItemId;
  qty: number;
}

export interface ActionDef {
  id: ActionId;
  skillId: SkillId;
  name: string;
  icon: string;
  levelRequired: number;
  /** 1사이클 소요 시간 */
  durationMs: number;
  /** 1사이클당 획득 경험치 */
  xp: number;
  /** 제작 액션일 경우 사이클당 소모 재료 */
  inputs?: ItemStack[];
  /** 사이클당 산출물 */
  outputs: ItemStack[];
}

export interface SkillDef {
  id: SkillId;
  name: string;
  icon: string;
  description: string;
}

export interface ActiveAction {
  skillId: SkillId;
  actionId: ActionId;
  /** 현재 사이클 안에서의 진행 시간 */
  progressMs: number;
}

export interface SkillState {
  xp: number;
}

export interface GameState {
  version: number;
  createdAt: number;
  /** 마지막으로 시뮬레이션이 반영된 시각 (epoch ms) */
  lastTickAt: number;
  gold: number;
  skills: Record<SkillId, SkillState>;
  inventory: Record<ItemId, number>;
  /**
   * 진행 중인 작업 목록. 동시 작업 수는 슬롯(unlockedActionSlots)으로 제한되고,
   * 같은 스킬의 작업은 동시에 하나만 가능하다.
   */
  activeActions: ActiveAction[];
}

export interface StoppedAction {
  actionId: ActionId;
  reason: 'out-of-materials';
}

/** simulate() 한 번이 만들어낸 변화 요약. 오프라인 정산 화면 등에 사용 */
export interface Gains {
  /** 실제로 시뮬레이션된 시간 */
  elapsedMs: number;
  /** 오프라인 상한에 걸려 버려진 시간 */
  discardedMs: number;
  xp: Partial<Record<SkillId, number>>;
  levelUps: Partial<Record<SkillId, { from: number; to: number }>>;
  itemsGained: Record<ItemId, number>;
  itemsConsumed: Record<ItemId, number>;
  /** 재료 고갈 등으로 진행 중 멈춘 작업들 */
  stopped: StoppedAction[];
}

export interface SimResult {
  state: GameState;
  gains: Gains;
}
