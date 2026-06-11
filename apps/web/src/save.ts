import { migrateSave, type GameState } from '@idle-rpg/core';

const SAVE_KEY = 'idle-rpg-save';

export function loadSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return migrateSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function persistSave(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // 저장 실패(용량 초과 등)는 게임 진행을 막지 않는다
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
