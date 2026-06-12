import type { SkillId } from '../types';

/** 도구 업그레이드 1단계당 사이클 시간 배율 (단계마다 곱연산 — 5% 단축) */
export const UPGRADE_SPEED_PER_STAGE = 0.95;

export interface UpgradeDef {
  /** 적용 스킬 (채집 스킬만) */
  skillId: SkillId;
  name: string;
  icon: string;
  /** 단계별 도구 이름과 가격 (인덱스 0 = 1단계). 가격은 지수 증가 — 골드 싱크 */
  stages: { name: string; price: number }[];
}

const list: UpgradeDef[] = [
  {
    skillId: 'woodcutting',
    name: '도끼',
    icon: '🪓',
    stages: [
      { name: '철 도끼', price: 800 },
      { name: '은 도끼', price: 4_000 },
      { name: '미스릴 도끼', price: 20_000 },
      { name: '아다만타이트 도끼', price: 100_000 },
      { name: '오리할콘 도끼', price: 500_000 },
    ],
  },
  {
    skillId: 'mining',
    name: '곡괭이',
    icon: '⛏️',
    stages: [
      { name: '철 곡괭이', price: 800 },
      { name: '은 곡괭이', price: 4_000 },
      { name: '미스릴 곡괭이', price: 20_000 },
      { name: '아다만타이트 곡괭이', price: 100_000 },
      { name: '오리할콘 곡괭이', price: 500_000 },
    ],
  },
  {
    skillId: 'fishing',
    name: '낚싯대',
    icon: '🎣',
    stages: [
      { name: '튼튼한 낚싯대', price: 800 },
      { name: '은 낚싯대', price: 4_000 },
      { name: '미스릴 낚싯대', price: 20_000 },
      { name: '아다만타이트 낚싯대', price: 100_000 },
      { name: '오리할콘 낚싯대', price: 500_000 },
    ],
  },
];

export const UPGRADES: ReadonlyArray<UpgradeDef> = list;

export function getUpgrade(skillId: SkillId): UpgradeDef | null {
  return list.find((u) => u.skillId === skillId) ?? null;
}
