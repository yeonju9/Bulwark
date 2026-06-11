import type { GameState } from './types';

export const SAVE_VERSION = 1;

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
    activeAction: null,
  };
}

/**
 * 저장 데이터를 현재 버전의 GameState로 변환.
 * 형식이 손상되었거나 알 수 없는 버전이면 null을 반환한다.
 * 이후 스키마가 바뀌면 여기에 버전별 마이그레이션을 추가한다.
 */
export function migrateSave(raw: unknown): GameState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as Partial<GameState>;
  if (data.version !== SAVE_VERSION) return null;
  if (typeof data.lastTickAt !== 'number' || typeof data.skills !== 'object') return null;
  return data as GameState;
}
