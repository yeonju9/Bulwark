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
export type BuildingId = string;
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
  /** 맵 배치용 권장 레벨 (공격 레벨 기준) */
  level: number;
  /** 연전 순서. 마지막이 보스 */
  monsters: MonsterId[];
  /** 최초 1회 클리어 보상 (큼). 다음 웨이브 티어 해금의 관문 */
  firstRewards: LootEntry[];
  /** 반복 클리어 보상 (소량) */
  repeatRewards: LootEntry[];
}

/** 마을 방어 건물. 본부(중앙 고정)·병영 등. 효과는 마을 스탯에 합산된다 */
export interface BuildingDef {
  id: BuildingId;
  name: string;
  icon: string;
  description: string;
  /** 마을 최대 HP 기여 */
  hp: number;
  /** 마을 공격력 기여 */
  attack: number;
  /** 마을 방어력 기여 */
  defense: number;
  /** 중앙 고정·파손 불가 (본부). false면 빈 터에 건설하고 파손될 수 있다 */
  fixed: boolean;
  /** 건설 비용 (fixed 건물은 없음 — 시작 시 존재). 같은 건물 중복 건설 가능 */
  buildGold?: number;
  buildItems?: ItemStack[];
}

/** 3×3 건물터 한 칸. null이면 빈 터 */
export interface BuildingSlot {
  id: BuildingId;
  /** 파손되면 스탯 기여가 정지된다. 골드+자원으로 수리 */
  damaged: boolean;
}

/** 마을 — 캐릭터 스탯을 대체한다. HP는 웨이브가 깎고 자연회복·보급품으로 메운다 */
export interface Village {
  /** 현재 마을 HP. 소수 허용(기대값 정산) — 표시할 때만 반올림 */
  hp: number;
  /** 외곽 성벽 링 강화 레벨 (0~MAX). 레벨↑ → 최대 HP·방어력 누적 증가 */
  wallLevel: number;
  /** 안쪽 3×3 건물터. index 4(중앙)=본부 고정. 나머지는 병영 등/빈 터(null) */
  buildings: (BuildingSlot | null)[];
  /** 웨이브 패배 후 농성 상태. 수리·강화로 해제될 때까지 웨이브 정산 중단(피해·보상 없음) */
  underSiege: boolean;
  /** 웨이브 주기 누적 진행도 (사이클 진행도와 같은 원리 — 틱 패턴 무관 정산) */
  waveProgressMs: number;
  /** 누적 처리 웨이브 수 (전리품 시드 순번 — 처치 순번과 같은 원리) */
  wavesProcessed: number;
}

/** 한 맵 단계의 웨이브 티어. 난이도 ∝ 보상 */
export interface WaveTierDef {
  tier: number;
  name: string;
  /** 1 웨이브를 구성하는 몬스터들 (기대값 피해·전리품 합산) */
  monsters: MonsterId[];
  /** 전리품·XP 배율 (난이도 ∝ 보상) */
  rewardMultiplier: number;
  /** 해금 조건: 이 단계에서 최초 클리어한 던전 수 (0이면 처음부터 해금) */
  unlockClears: number;
}

/** 맵 단계. 단계마다 자체 웨이브 테이블·던전·UI 테마를 가진다 */
export interface MapStageDef {
  stage: number;
  name: string;
  /** body 클래스로 쓰는 테마 식별자 (목업 s1~s5) */
  themeClass: string;
  tiers: WaveTierDef[];
  /** 맵에 배치되는 던전 (레벨 순) */
  dungeons: DungeonId[];
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
  /** 장착 중인 장비 (인벤토리와 분리 보관). 무기→마을 공격력, 방어구→마을 방어력 */
  equipment: Record<EquipSlot, ItemId | null>;
  /** 마을 (캐릭터 HP·스탯을 대체) */
  village: Village;
  /** 현재 맵 단계 (1-indexed). 단계마다 웨이브 테이블·던전·테마가 바뀐다 */
  mapStage: number;
  /** 선택된 웨이브 티어 (해금 범위 안에서 유저가 직접 선택) */
  waveTier: number;
  /** 웨이브 방어 시 자동 소비할 보급품 (기존 전투 음식 — 마을 HP 복구) */
  combatFood: ItemId | null;
  /** 몬스터별 누적 처치 수 (도감 + 전리품 시드) */
  monsterKills: Record<MonsterId, number>;
  /** 던전별 누적 클리어 수 (최초 클리어 보상·웨이브 티어 해금 판정) */
  dungeonClears: Record<DungeonId, number>;
  /** 활성 버프 (카테고리별 최대 1개) */
  buffs: ActiveBuff[];
  /** 스킬별 도구 업그레이드 단계 (상점 구매) */
  upgrades: Partial<Record<SkillId, number>>;
  /** 부산물이 있는 액션의 누적 사이클 수 (부산물 시드 — 처치 순번과 같은 원리) */
  actionCycles: Record<ActionId, number>;
}

export interface StoppedAction {
  actionId: ActionId;
  reason: 'out-of-materials';
}

/** 웨이브 방어 정산 요약 (전리품·XP는 Gains의 itemsGained·xp·kills에 합산된다) */
export interface WaveReport {
  /** 막아낸(승리) 웨이브 수 */
  wavesWon: number;
  /** 승리한 웨이브에서 얻은 골드 합계 (오프라인이면 50%) */
  goldWon: number;
  /** 승리한 웨이브에서 얻은 XP 합계(공격+체력, 오프라인이면 50%) — 격퇴 알림용 */
  xpWon: number;
  /** 패배해 농성에 진입했는가 */
  defeated: boolean;
  /** 패배 시 손상된 구조물 */
  damaged?: 'wall' | 'barracks';
  /** 패배·손상 후 성벽 레벨 */
  wallLevelAfter?: number;
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
  /** 몬스터별 처치 수 (웨이브·던전 합산) */
  kills: Record<MonsterId, number>;
  /** 재료 고갈로 진행 중 멈춘 작업들 */
  stopped: StoppedAction[];
  /** 웨이브 방어 결과 (이번 정산에서 웨이브가 발생했을 때만) */
  wave?: WaveReport;
}

export interface SimResult {
  state: GameState;
  gains: Gains;
}
