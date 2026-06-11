import { getItem } from '../data/items';
import { levelFromXp } from '../xp';
import type { GameState, MonsterDef } from '../types';

/** 플레이어 공격 주기 (무기 공통 — 무기 차이는 공격력으로만 표현) */
export const PLAYER_ATTACK_INTERVAL_MS = 2400;

/** 처치 사이클 사이의 탐색/이동 시간 */
export const HUNT_DOWNTIME_MS = 1500;

/** 비전투 시 HP 자연 회복: 분당 (체력 레벨)만큼 */
export const REGEN_PER_MINUTE_PER_HP_LEVEL = 1;

export interface PlayerStats {
  attackLevel: number;
  hpLevel: number;
  maxHp: number;
  attackPower: number;
  defense: number;
}

/** 레벨 + 장비에서 파생되는 전투 스탯. 순수 함수 */
export function computeStats(state: GameState): PlayerStats {
  const attackLevel = levelFromXp(state.skills.attack.xp);
  const hpLevel = levelFromXp(state.skills.hitpoints.xp);

  let attackPower = 1 + attackLevel;
  let defense = 0;
  for (const itemId of Object.values(state.equipment)) {
    if (!itemId) continue;
    const equip = getItem(itemId).equip;
    if (!equip) continue;
    attackPower += equip.attack ?? 0;
    defense += equip.defense ?? 0;
  }

  return { attackLevel, hpLevel, maxHp: 10 * hpLevel, attackPower, defense };
}

/** 명중률: 공격측 위력 vs 수비측 방어. [0.2, 0.95] 클램프 */
export function hitChance(attackRating: number, defenseRating: number): number {
  if (attackRating <= 0) return 0.2;
  return Math.min(0.95, Math.max(0.2, attackRating / (attackRating + defenseRating)));
}

/** 몬스터 1마리 처치에 걸리는 시간(ms). 기대값 — 난수 없음 */
export function timeToKillMs(stats: PlayerStats, monster: MonsterDef): number {
  const dps =
    (stats.attackPower * hitChance(stats.attackPower, monster.defense)) /
    (PLAYER_ATTACK_INTERVAL_MS / 1000);
  return Math.ceil((monster.hp / dps) * 1000);
}

/**
 * 처치 1회 동안 받는 기대 피해량.
 * 정수로 반올림한다 — HP 산술을 정수로 유지해야 실시간 틱과 오프라인 일괄 정산이
 * 부동소수점 누적 순서와 무관하게 완전히 같은 결과를 낸다.
 */
export function damageTakenPerKill(stats: PlayerStats, monster: MonsterDef): number {
  const monsterDps =
    (monster.attack * hitChance(monster.attack, stats.defense)) /
    (monster.attackIntervalMs / 1000);
  return Math.round((monsterDps * timeToKillMs(stats, monster)) / 1000);
}

/** 처치 1회당 체력 XP: 받은 피해에 비례 (방어가 높으면 체력 XP는 줄어드는 트레이드오프) */
export function hitpointsXpPerKill(damageTaken: number): number {
  return Math.round(damageTaken * 1.5);
}
