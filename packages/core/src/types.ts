export type SkillId =
  | 'woodcutting'
  | 'mining'
  | 'smithing'
  | 'attack'
  | 'hitpoints'
  | 'fishing'
  | 'cooking'
  | 'alchemy';

export type ItemId = string;
export type ActionId = string;
export type MonsterId = string;
export type DungeonId = string;
export type EquipSlot = 'weapon' | 'armor';

export type BuffCategory = 'gathering' | 'combat';

/**
 * 물약 효과. 운영 원칙: 효과는 곱연산으로만 개입한다 (가산 금지 — 밸런스 단순화).
 */
export interface PotionEffect {
  /** 채집 사이클 시간 배율 (0.85 = 15% 단축). 지정한 스킬에만 적용 */
  cycleTime?: { skillId: SkillId; multiplier: number };
  /** 전투 공격력 배율 */
  attack?: number;
  /** 전투 방어력 배율 */
  defense?: number;
}

export interface ItemDef {
  id: ItemId;
  name: string;
  icon: string;
  sellPrice: number;
  /** 장비 아이템: 장착 슬롯과 스탯. levelRequired는 공격 레벨 기준 */
  equip?: { slot: EquipSlot; attack?: number; defense?: number; levelRequired?: number };
  /** 음식 아이템: 전투 중 자동 섭취 시 회복량 */
  food?: { heal: number };
  /** 물약 아이템: 마시면 일정 시간 버프 (카테고리별 동시 1개) */
  potion?: { category: BuffCategory; durationMs: number; effect: PotionEffect };
}

export interface ItemStack {
  itemId: ItemId;
  qty: number;
}

/** 전리품 항목. 처치/클리어 1회마다 chance 확률로 qty개 (난수는 시드 주입) */
export interface LootEntry {
  itemId: ItemId;
  qty: number;
  chance: number;
}

export interface ActionDef {
  id: ActionId;
  skillId: SkillId;
  name: string;
  icon: string;
  levelRequired: number;
  /** 1사이클 소요 시간. 전투 액션은 0 (스탯에서 동적 계산) */
  durationMs: number;
  /** 1사이클당 획득 경험치. 전투 액션은 처치당 공격 XP */
  xp: number;
  /** 제작 액션일 경우 사이클당 소모 재료 */
  inputs?: ItemStack[];
  /** 사이클당 산출물 (전투 액션은 비움 — 전리품 테이블 사용) */
  outputs: ItemStack[];
  /** 사이클당 확률 부산물 (약초 등). 난수는 액션별 누적 사이클 순번 시드 */
  byproducts?: LootEntry[];
  /** 전투 액션 표시. 사이클 = 몬스터 1마리 처치 */
  combat?: { monsterId: MonsterId };
}

export interface SkillDef {
  id: SkillId;
  name: string;
  icon: string;
  description: string;
}

export interface MonsterDef {
  id: MonsterId;
  name: string;
  icon: string;
  /** 사냥에 필요한 공격 레벨 */
  levelRequired: number;
  hp: number;
  attack: number;
  defense: number;
  /** 몬스터 공격 주기 */
  attackIntervalMs: number;
  /** 처치당 공격 XP */
  xp: number;
  lootTable: LootEntry[];
  /** true면 사냥터에 나오지 않음 (던전 전용) */
  dungeonOnly?: boolean;
}

export interface DungeonDef {
  id: DungeonId;
  name: string;
  icon: string;
  description: string;
  /** 연전 순서. 마지막이 보스 */
  monsters: MonsterId[];
  /** 클리어 보상 */
  rewards: LootEntry[];
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

/** 마신 물약의 활성 버프. 효과는 아이템 정의(potion)에서 찾는다 */
export interface ActiveBuff {
  itemId: ItemId;
  category: BuffCategory;
  /** 만료 시각 (epoch ms). simulate가 만료 경계로 정산 구간을 분할한다 */
  expiresAtMs: number;
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
   * 같은 스킬의 작업은 동시에 하나만 가능하다 (전투 작업도 skillId가 attack이라 자동으로 1개).
   */
  activeActions: ActiveAction[];
  /** 장착 중인 장비 (인벤토리와 분리 보관) */
  equipment: Record<EquipSlot, ItemId | null>;
  /** 현재 HP. 소수 허용(기대값 정산) — 표시할 때만 반올림 */
  hp: number;
  /** 사냥 중 자동 섭취할 음식 */
  combatFood: ItemId | null;
  /** 몬스터별 누적 처치 수 (도감 + 전리품 시드) */
  monsterKills: Record<MonsterId, number>;
  /** 던전별 재입장 가능 시각 (epoch ms) */
  dungeonCooldowns: Record<DungeonId, number>;
  /** 활성 버프 (카테고리별 최대 1개) */
  buffs: ActiveBuff[];
  /** 스킬별 도구 업그레이드 단계 (상점 구매) */
  upgrades: Partial<Record<SkillId, number>>;
  /** 부산물이 있는 액션의 누적 사이클 수 (부산물 시드 — 처치 순번과 같은 원리) */
  actionCycles: Record<ActionId, number>;
}

export interface StoppedAction {
  actionId: ActionId;
  reason: 'out-of-materials' | 'low-hp';
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
  /** 몬스터별 처치 수 */
  kills: Record<MonsterId, number>;
  /** 재료 고갈·HP 부족 등으로 진행 중 멈춘 작업들 */
  stopped: StoppedAction[];
}

export interface SimResult {
  state: GameState;
  gains: Gains;
}
