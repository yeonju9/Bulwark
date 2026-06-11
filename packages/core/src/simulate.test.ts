import { describe, expect, it } from 'vitest';
import { sellItem, startAction } from './commands';
import { simulate } from './simulate';
import { createInitialState } from './state';
import { levelFromXp, xpForLevel } from './xp';
import type { GameState } from './types';

const T0 = 1_000_000;

function stateWithAction(actionId: string, patch?: Partial<GameState>): GameState {
  const base = { ...createInitialState(T0), ...patch };
  const { state, error } = startAction(base, actionId);
  expect(error).toBeUndefined();
  return state;
}

describe('simulate — 채집', () => {
  it('경과 시간만큼 아이템과 경험치를 누적한다', () => {
    const s0 = stateWithAction('wc_normal'); // 3초/사이클, 10xp, 통나무 1개
    const { state, gains } = simulate(s0, T0 + 10_000);

    expect(state.inventory['normal_log']).toBe(3);
    expect(state.skills.woodcutting.xp).toBe(30);
    expect(gains.itemsGained['normal_log']).toBe(3);
    expect(state.activeAction?.progressMs).toBe(1000); // 10초 - 3사이클 = 1초 진행 중
  });

  it('사이클 진행도가 다음 simulate 호출로 이어진다', () => {
    const s0 = stateWithAction('wc_normal');
    const r1 = simulate(s0, T0 + 2_000); // 사이클 미완성
    expect(r1.state.inventory['normal_log']).toBeUndefined();
    expect(r1.state.activeAction?.progressMs).toBe(2000);

    const r2 = simulate(r1.state, T0 + 4_000); // 누적 4초 → 1사이클 완료
    expect(r2.state.inventory['normal_log']).toBe(1);
    expect(r2.state.activeAction?.progressMs).toBe(1000);
  });

  it('레벨업을 감지해 보고한다', () => {
    const s0 = stateWithAction('wc_normal');
    const xpToLevel2 = xpForLevel(2); // 83xp → 9사이클이면 90xp
    const { state, gains } = simulate(s0, T0 + 9 * 3000);

    expect(state.skills.woodcutting.xp).toBeGreaterThanOrEqual(xpToLevel2);
    expect(levelFromXp(state.skills.woodcutting.xp)).toBe(2);
    expect(gains.levelUps.woodcutting).toEqual({ from: 1, to: 2 });
  });
});

describe('simulate — 제작', () => {
  it('재료를 소모하며, 재료가 떨어지면 액션이 멈춘다', () => {
    // 구리 제련: 2초/사이클, 구리 광석 1개 소모
    const s0 = stateWithAction('sm_copper_bar', { inventory: { copper_ore: 5 } });
    const { state, gains } = simulate(s0, T0 + 60_000); // 시간상 30사이클이지만 재료는 5개

    expect(state.inventory['copper_bar']).toBe(5);
    expect(state.inventory['copper_ore']).toBeUndefined();
    expect(gains.itemsConsumed['copper_ore']).toBe(5);
    expect(gains.stopped).toBe('out-of-materials');
    expect(state.activeAction).toBeNull();
  });
});

describe('simulate — 오프라인 정산', () => {
  it('오프라인 상한(12시간)을 넘는 시간은 버린다', () => {
    const s0 = stateWithAction('wc_normal');
    const dayMs = 24 * 60 * 60 * 1000;
    const { state, gains } = simulate(s0, T0 + dayMs);

    expect(gains.elapsedMs).toBe(dayMs / 2);
    expect(gains.discardedMs).toBe(dayMs / 2);
    expect(state.inventory['normal_log']).toBe((dayMs / 2) / 3000);
  });

  it('진행 중 액션이 없으면 시간만 흐른다', () => {
    const s0 = createInitialState(T0);
    const { state, gains } = simulate(s0, T0 + 10_000);
    expect(state.lastTickAt).toBe(T0 + 10_000);
    expect(Object.keys(gains.itemsGained)).toHaveLength(0);
  });
});

describe('commands', () => {
  it('레벨이 부족한 액션은 시작할 수 없다', () => {
    const s0 = createInitialState(T0);
    const { error } = startAction(s0, 'wc_yew'); // 벌목 40 필요
    expect(error).toBe('level-too-low');
  });

  it('재료 없이 제작 액션을 시작할 수 없다', () => {
    const s0 = createInitialState(T0);
    const { error } = startAction(s0, 'sm_copper_bar');
    expect(error).toBe('missing-materials');
  });

  it('아이템을 팔면 골드가 늘어난다', () => {
    const s0 = { ...createInitialState(T0), inventory: { normal_log: 10 } };
    const { state } = sellItem(s0, 'normal_log', 'all');
    expect(state.gold).toBe(10); // 개당 1골드
    expect(state.inventory['normal_log']).toBeUndefined();
  });
});
