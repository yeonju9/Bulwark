import { computeVillageStats } from './combat/village';
import { initialBuildings } from './data/buildings';
import { xpForLevel } from './xp';
import type { ActiveAction, GameState, Village } from './types';

export const SAVE_VERSION = 6;

/** 체력 스킬 시작 레벨 (마을 최대 HP에 레벨당 10 기여 → 시작 시 본부와 합산) */
export const STARTING_HITPOINTS_LEVEL = 10;

export function createInitialState(now: number): GameState {
  const state: GameState = {
    version: SAVE_VERSION,
    createdAt: now,
    lastTickAt: now,
    gold: 0,
    skills: {
      woodcutting: { xp: 0 },
      mining: { xp: 0 },
      smithing: { xp: 0 },
      attack: { xp: 0 },
      hitpoints: { xp: xpForLevel(STARTING_HITPOINTS_LEVEL) },
      fishing: { xp: 0 },
      cooking: { xp: 0 },
      alchemy: { xp: 0 },
    },
    inventory: {},
    activeActions: [],
    equipment: { weapon: null, armor: null },
    village: {
      hp: 0,
      wallLevel: 0,
      buildings: initialBuildings(),
      underSiege: false,
      waveProgressMs: 0,
      wavesProcessed: 0,
      siegeProgressMs: 0,
      siegeKills: 0,
    },
    mapStage: 1,
    waveTier: 1,
    combatFood: null,
    monsterKills: {},
    dungeonClears: {},
    buffs: [],
    upgrades: {},
    actionCycles: {},
  };
  state.village.hp = computeVillageStats(state).maxHp;
  return state;
}

/**
 * 저장 데이터를 현재 버전의 GameState로 변환.
 * 형식이 손상되었거나 알 수 없는 버전이면 null을 반환한다.
 */
export function migrateSave(raw: unknown): GameState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  let data = raw as Record<string, unknown>;

  // v1 → v2: 단일 activeAction → 슬롯 기반 activeActions 배열
  if (data.version === 1) {
    const { activeAction, ...rest } = data as Record<string, unknown> & {
      activeAction?: ActiveAction | null;
    };
    data = {
      ...rest,
      version: 2,
      activeActions: activeAction ? [activeAction] : [],
    };
  }

  // v2 → v3: 전투 도입 — 전투 스킬, 장비, HP, 음식 슬롯, 도감, 던전 쿨다운
  if (data.version === 2) {
    const skills = data.skills as Record<string, { xp: number }>;
    data = {
      ...data,
      version: 3,
      skills: {
        ...skills,
        attack: { xp: 0 },
        hitpoints: { xp: xpForLevel(STARTING_HITPOINTS_LEVEL) },
      },
      equipment: { weapon: null, armor: null },
      hp: 10 * STARTING_HITPOINTS_LEVEL,
      combatFood: null,
      monsterKills: {},
      dungeonCooldowns: {},
    };
  }

  // v3 → v4: 스킬 확장 — 낚시/요리/연금술, 버프, 도구 업그레이드, 부산물 카운터
  if (data.version === 3) {
    const skills = data.skills as Record<string, { xp: number }>;
    data = {
      ...data,
      version: 4,
      skills: {
        ...skills,
        fishing: { xp: 0 },
        cooking: { xp: 0 },
        alchemy: { xp: 0 },
      },
      buffs: [],
      upgrades: {},
      actionCycles: {},
    };
  }

  // v4 → v5: 마을 방어 전환 — 캐릭터 HP→마을 HP, 진행 중 사냥 작업 제거,
  // 던전 쿨다운→클리어 횟수, 맵/티어/마을 구조물 기본값
  if (data.version === 4) {
    const oldHp = typeof data.hp === 'number' ? Math.max(1, Math.round(data.hp)) : undefined;
    const activeActions = Array.isArray(data.activeActions)
      ? (data.activeActions as ActiveAction[]).filter((a) => a.skillId !== 'attack')
      : [];
    const monsterKills = (data.monsterKills as Record<string, number>) ?? {};
    const dungeonClears: Record<string, number> = {};
    // 기존 goblin_den 보스(고블린 족장) 처치 이력 → 클리어 1회 인정
    if ((monsterKills['goblin_chief'] ?? 0) > 0) dungeonClears['goblin_den'] = 1;

    const { hp: _hp, dungeonCooldowns: _cooldowns, ...rest } = data;
    data = {
      ...rest,
      version: 5,
      activeActions,
      village: {
        hp: 0,
        wallLevel: 0,
        buildings: initialBuildings(),
        underSiege: false,
        waveProgressMs: 0,
        wavesProcessed: 0,
      },
      mapStage: 1,
      waveTier: 1,
      dungeonClears,
    };

    // 마을 시작 HP = 기존 HP를 새 최대 HP로 클램프 (없으면 가득 채움)
    const maxHp = computeVillageStats(data as unknown as GameState).maxHp;
    (data.village as Village).hp = oldHp !== undefined ? Math.min(oldHp, maxHp) : maxHp;
  }

  // v5 → v6: 실시간 공성 — 침공이 2분간 실시간 진행. 마을에 침공 진행 필드 추가.
  if (data.version === 5) {
    const village = data.village as Village;
    data = {
      ...data,
      version: 6,
      village: { ...village, siegeProgressMs: 0, siegeKills: 0 },
    };
  }

  if (data.version !== SAVE_VERSION) return null;
  if (typeof data.lastTickAt !== 'number' || typeof data.skills !== 'object') return null;
  if (!Array.isArray(data.activeActions)) return null;
  return data as unknown as GameState;
}
