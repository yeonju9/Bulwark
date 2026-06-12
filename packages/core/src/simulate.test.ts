import { describe, expect, it } from 'vitest';
import { sellItem, startAction, stopAction } from './commands';
import { simulate } from './simulate';
import { nextSlotUnlock, totalLevel, unlockedActionSlots } from './slots';
import { createInitialState, migrateSave, SAVE_VERSION } from './state';
import { levelFromXp, xpForLevel } from './xp';
import type { GameState, SkillId, SkillState } from './types';

const T0 = 1_000_000;

function stateWith(patch?: Partial<GameState>): GameState {
  return { ...createInitialState(T0), ...patch };
}

function skillsWith(patch: Partial<Record<SkillId, SkillState>>): Record<SkillId, SkillState> {
  return { ...createInitialState(T0).skills, ...patch };
}

function stateWithAction(actionId: string, patch?: Partial<GameState>): GameState {
  const { state, error } = startAction(stateWith(patch), actionId);
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
    expect(state.activeActions[0].progressMs).toBe(1000); // 10초 - 3사이클 = 1초 진행 중
  });

  it('사이클 진행도가 다음 simulate 호출로 이어진다', () => {
    const s0 = stateWithAction('wc_normal');
    const r1 = simulate(s0, T0 + 2_000); // 사이클 미완성
    expect(r1.state.inventory['normal_log']).toBeUndefined();
    expect(r1.state.activeActions[0].progressMs).toBe(2000);

    const r2 = simulate(r1.state, T0 + 4_000); // 누적 4초 → 1사이클 완료
    expect(r2.state.inventory['normal_log']).toBe(1);
    expect(r2.state.activeActions[0].progressMs).toBe(1000);
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
  it('재료를 소모하며, 재료가 떨어지면 해당 작업만 멈춘다', () => {
    // 구리 제련: 2초/사이클, 구리 광석 1개 소모
    const s0 = stateWithAction('sm_copper_bar', { inventory: { copper_ore: 5 } });
    const { state, gains } = simulate(s0, T0 + 60_000); // 시간상 30사이클이지만 재료는 5개

    expect(state.inventory['copper_bar']).toBe(5);
    expect(state.inventory['copper_ore']).toBeUndefined();
    expect(gains.itemsConsumed['copper_ore']).toBe(5);
    expect(gains.stopped).toEqual([{ actionId: 'sm_copper_bar', reason: 'out-of-materials' }]);
    expect(state.activeActions).toHaveLength(0);
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

  it('진행 중 작업이 없으면 시간만 흐른다', () => {
    const s0 = createInitialState(T0);
    const { state, gains } = simulate(s0, T0 + 10_000);
    expect(state.lastTickAt).toBe(T0 + 10_000);
    expect(Object.keys(gains.itemsGained)).toHaveLength(0);
  });
});

describe('작업 슬롯', () => {
  // 벌목 30 → 총 레벨 30+1×5+10 = 45 ≥ 45 → 2슬롯
  const twoSlotSkills = skillsWith({ woodcutting: { xp: xpForLevel(30) } });

  it('1슬롯으로 시작하고 총 레벨 45/110에서 확장된다', () => {
    const fresh = stateWith();
    expect(totalLevel(fresh)).toBe(17); // 비전투 1×6 + 공격 1 + 체력 10
    expect(unlockedActionSlots(fresh)).toBe(1);
    expect(nextSlotUnlock(fresh)).toEqual({ slots: 2, totalLevel: 45 });

    const mid = stateWith({ skills: twoSlotSkills });
    expect(unlockedActionSlots(mid)).toBe(2);

    const high = stateWith({
      skills: skillsWith({ woodcutting: { xp: xpForLevel(65) }, mining: { xp: xpForLevel(30) } }),
    });
    expect(totalLevel(high)).toBe(110);
    expect(unlockedActionSlots(high)).toBe(3);
    expect(nextSlotUnlock(high)).toBeNull();
  });

  it('1슬롯일 때 다른 스킬 작업을 시작하면 기존 작업이 교체된다', () => {
    const s0 = stateWithAction('wc_normal');
    const { state } = startAction(s0, 'mi_copper');
    expect(state.activeActions).toHaveLength(1);
    expect(state.activeActions[0].actionId).toBe('mi_copper');
  });

  it('2슬롯이면 두 작업이 동시에 진행된다', () => {
    const s0 = stateWithAction('wc_normal', { skills: twoSlotSkills });
    const s1 = startAction(s0, 'mi_copper').state;
    expect(s1.activeActions).toHaveLength(2);

    const { state } = simulate(s1, T0 + 9_000); // 벌목 3사이클 + 채광 3사이클
    expect(state.inventory['normal_log']).toBe(3);
    expect(state.inventory['copper_ore']).toBe(3);
  });

  it('같은 스킬의 작업은 슬롯을 새로 쓰지 않고 교체된다', () => {
    const s0 = stateWithAction('wc_normal', { skills: twoSlotSkills });
    const { state } = startAction(s0, 'wc_oak'); // 벌목 28레벨이라 참나무 가능
    expect(state.activeActions).toHaveLength(1);
    expect(state.activeActions[0].actionId).toBe('wc_oak');
  });

  it('슬롯이 가득 차면 가장 오래된 작업이 교체된다', () => {
    const s0 = stateWithAction('wc_normal', { skills: twoSlotSkills, inventory: { copper_ore: 10 } });
    const s1 = startAction(s0, 'mi_copper').state; // 슬롯 2/2 (벌목, 채광)
    const { state, error } = startAction(s1, 'sm_copper_bar');
    expect(error).toBeUndefined();
    expect(state.activeActions).toHaveLength(2);
    expect(state.activeActions.map((a) => a.actionId)).toEqual(['mi_copper', 'sm_copper_bar']);
  });

  it('특정 작업만 골라서 중지할 수 있다', () => {
    const s0 = stateWithAction('wc_normal', { skills: twoSlotSkills });
    const s1 = startAction(s0, 'mi_copper').state;
    const { state } = stopAction(s1, 'wc_normal');
    expect(state.activeActions.map((a) => a.actionId)).toEqual(['mi_copper']);
  });
});

describe('세이브 마이그레이션', () => {
  it('v1 세이브의 activeAction을 activeActions 배열로 변환한다', () => {
    const v1 = {
      version: 1,
      createdAt: T0,
      lastTickAt: T0,
      gold: 50,
      skills: { woodcutting: { xp: 100 }, mining: { xp: 0 }, smithing: { xp: 0 } },
      inventory: { normal_log: 3 },
      activeAction: { skillId: 'woodcutting', actionId: 'wc_normal', progressMs: 500 },
    };
    const migrated = migrateSave(v1);
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(SAVE_VERSION);
    expect(migrated!.activeActions).toEqual([
      { skillId: 'woodcutting', actionId: 'wc_normal', progressMs: 500 },
    ]);
    expect((migrated as Record<string, unknown>)['activeAction']).toBeUndefined();
  });

  it('알 수 없는 버전이나 손상된 데이터는 거부한다', () => {
    expect(migrateSave(null)).toBeNull();
    expect(migrateSave({ version: 999 })).toBeNull();
    expect(migrateSave({ version: SAVE_VERSION, lastTickAt: 'bad' })).toBeNull();
  });
});

describe('commands', () => {
  it('레벨이 부족한 액션은 시작할 수 없다', () => {
    const { error } = startAction(stateWith(), 'wc_yew'); // 벌목 40 필요
    expect(error).toBe('level-too-low');
  });

  it('재료 없이 제작 액션을 시작할 수 없다', () => {
    const { error } = startAction(stateWith(), 'sm_copper_bar');
    expect(error).toBe('missing-materials');
  });

  it('아이템을 팔면 골드가 늘어난다', () => {
    const s0 = stateWith({ inventory: { normal_log: 10 } });
    const { state } = sellItem(s0, 'normal_log', 'all');
    expect(state.gold).toBe(10); // 개당 1골드
    expect(state.inventory['normal_log']).toBeUndefined();
  });
});
