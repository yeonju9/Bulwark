import type { ActiveAction, GameState } from './types';

export const SAVE_VERSION = 2;

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
    },
    inventory: {},
    activeActions: [],
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

  if (data.version !== SAVE_VERSION) return null;
  if (typeof data.lastTickAt !== 'number' || typeof data.skills !== 'object') return null;
  if (!Array.isArray(data.activeActions)) return null;
  return data as unknown as GameState;
}
