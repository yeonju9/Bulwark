import { xpForLevel } from './xp';
import type { ActiveAction, GameState } from './types';

export const SAVE_VERSION = 4;

/** 체력 스킬 시작 레벨 (최대 HP = 10×레벨 → 시작 100) */
export const STARTING_HITPOINTS_LEVEL = 10;

export function createInitialState(now: number): GameState {
  return {
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
    hp: 10 * STARTING_HITPOINTS_LEVEL,
    combatFood: null,
    monsterKills: {},
    dungeonCooldowns: {},
    buffs: [],
    upgrades: {},
    actionCycles: {},
  };
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

  if (data.version !== SAVE_VERSION) return null;
  if (typeof data.lastTickAt !== 'number' || typeof data.skills !== 'object') return null;
  if (!Array.isArray(data.activeActions)) return null;
  return data as unknown as GameState;
}
