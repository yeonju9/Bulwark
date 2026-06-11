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

export function exportSave(state: GameState): string {
  return JSON.stringify(state);
}

/** 붙여넣은 텍스트를 검증해 GameState로. 실패 시 null (기존 세이브는 건드리지 않음) */
export function importSave(text: string): GameState | null {
  try {
    return migrateSave(JSON.parse(text));
  } catch {
    return null;
  }
}
