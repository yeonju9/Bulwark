import type { MonsterDef } from '../types';

/** 마을 수비대 공격 주기 (장비/건물 차이는 공격력으로만 표현) */
export const VILLAGE_ATTACK_INTERVAL_MS = 2400;

/** 마을 HP 자연 회복: 분당 (체력 레벨)만큼 */
export const REGEN_PER_MINUTE_PER_HP_LEVEL = 1;

/** 마을의 파생 전투 스탯. 건물·성벽·스킬·장비에서 computeVillageStats가 만든다 */
export interface VillageStats {
  attackLevel: number;
  hpLevel: number;
  maxHp: number;
  attackPower: number;
  defense: number;
}

/** 명중률: 공격측 위력 vs 수비측 방어. [0.2, 0.95] 클램프 */
export function hitChance(attackRating: number, defenseRating: number): number {
  if (attackRating <= 0) return 0.2;
  return Math.min(0.95, Math.max(0.2, attackRating / (attackRating + defenseRating)));
}

/** 몬스터 1마리 처치에 걸리는 시간(ms). 기대값 — 난수 없음 */
export function timeToKillMs(stats: VillageStats, monster: MonsterDef): number {
  const dps =
    (stats.attackPower * hitChance(stats.attackPower, monster.defense)) /
    (VILLAGE_ATTACK_INTERVAL_MS / 1000);
  if (dps <= 0) return Infinity;
  return Math.ceil((monster.hp / dps) * 1000);
}

/**
 * 몬스터 1마리를 처치하는 동안 마을이 받는 기대 피해량.
 * 정수로 반올림한다 — HP 산술을 정수로 유지해야 실시간 틱과 오프라인 일괄 정산이
 * 부동소수점 누적 순서와 무관하게 완전히 같은 결과를 낸다.
 * 공격력이 0이라 처치가 불가능하면(Infinity) 무한대 피해로 본다.
 */
export function damageTakenPerKill(stats: VillageStats, monster: MonsterDef): number {
  const ttk = timeToKillMs(stats, monster);
  if (!Number.isFinite(ttk)) return Infinity;
  const monsterDps =
    (monster.attack * hitChance(monster.attack, stats.defense)) /
    (monster.attackIntervalMs / 1000);
  return Math.round((monsterDps * ttk) / 1000);
}

/** 처치 1회당 체력 XP: 받은 피해에 비례 (방어가 높으면 체력 XP는 줄어드는 트레이드오프) */
export function hitpointsXpPerKill(damageTaken: number): number {
  if (!Number.isFinite(damageTaken)) return 0;
  return Math.round(damageTaken * 1.5);
}
