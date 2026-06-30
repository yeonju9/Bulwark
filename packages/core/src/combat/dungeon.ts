import { getItem } from '../data/items';
import { getDungeon, getMonster } from '../data/monsters';
import { hashString, mulberry32 } from '../rng';
import { computeVillageStats, grantXp } from './village';
import { damageTakenPerKill, hitpointsXpPerKill, timeToKillMs } from './stats';
import type { DungeonId, Gains, GameState, ItemId, MonsterId, SkillId } from '../types';

export type DungeonError = 'unknown-dungeon';

/**
 * 던전 반복 클리어 시 전투 XP 배율. 최초 클리어는 풀(1.0) 지급, 이후 반복은 이 값만.
 * 던전은 쿨다운·비용·패배손실이 없어, 반복마다 풀 전투 XP를 주면 결과 모달을 닫고 다시
 * 누르는 클릭 스팸만으로 "전투레벨은 웨이브 생존으로 성장한다"는 핵심 설계가 무너진다.
 * (아이템 보상은 firstRewards/repeatRewards로 이미 분리되어 있고, 여기서는 XP 축만 막는다.)
 */
export const DUNGEON_REPEAT_XP_MULT = 0.1;

export interface DungeonFight {
  monsterId: MonsterId;
  defeated: boolean;
  timeMs: number;
  damageTaken: number;
  foodUsed: number;
}

export interface DungeonResult {
  dungeonId: DungeonId;
  success: boolean;
  /** 이번 클리어가 최초 1회인가 (최초만 큰 보상 + 티어 해금) */
  firstClear: boolean;
  fights: DungeonFight[];
  totalMs: number;
  rewards: Record<ItemId, number>;
  xp: Partial<Record<SkillId, number>>;
  hpAfter: number;
  /** 입장 시 수비대 최대 HP (= 그 순간 마을 maxHp 스냅샷). 남은 HP의 분모 */
  maxHp: number;
}

export interface DungeonAttempt {
  state: GameState;
  error?: DungeonError;
  result?: DungeonResult;
}

/**
 * 던전 도전. 즉시 판정되는 단발 커맨드 — "마을 수비대 파견" 컨셉으로 마을 스탯을 쓴다.
 * 웨이브와 완전 별개이며 쿨다운이 없다(반복 보상이 소량이라 악용 여지 적음).
 * 최초 1회 클리어만 큰 보상 + 다음 웨이브 티어 해금, 이후 반복은 소량 보상.
 * 호출 전에 simulate()로 정산된 상태를 넘기는 것이 전제. 패배해도 손실은 없다(마을 HP 1로 생환).
 */
export function attemptDungeon(state: GameState, dungeonId: DungeonId): DungeonAttempt {
  let dungeon;
  try {
    dungeon = getDungeon(dungeonId);
  } catch {
    return { state, error: 'unknown-dungeon' };
  }

  const next = structuredClone(state);
  const stats = computeVillageStats(next);
  const gains: Gains = {
    elapsedMs: 0, discardedMs: 0, xp: {}, levelUps: {},
    itemsGained: {}, itemsConsumed: {}, kills: {}, stopped: [],
  };

  const supplyItem = next.combatFood ? getItem(next.combatFood) : null;
  const heal = supplyItem?.food?.heal ?? 0;

  // 던전은 "수비대 파견" — 마을 스탯을 쓰되 별도 HP 풀(= 최대 HP)로 출정한다.
  // 지속 자원인 village.hp(웨이브 방어용)는 건드리지 않는다.
  let hp = stats.maxHp;
  const fights: DungeonFight[] = [];
  let totalMs = 0;
  let success = true;
  // 전투 XP는 루프 중 누적만 하고, 결과(최초/반복/패배)가 확정된 뒤 한 번에 지급한다.
  // 던전 stats는 루프 내내 고정이라 즉시 지급해도 시뮬 결과는 같지만, 반복·부분실패 누수를
  // 막으려면 결과가 정해진 다음에 배율을 적용해 지급해야 한다.
  let attackXp = 0;
  let hitpointsXp = 0;

  for (const monsterId of dungeon.monsters) {
    const monster = getMonster(monsterId);
    const timeMs = timeToKillMs(stats, monster);
    const damage = damageTakenPerKill(stats, monster);

    // 이번 전투를 버티는 데 필요한 만큼 보급품을 먼저 소비한다 (자동)
    let foodUsed = 0;
    while (
      Number.isFinite(damage) &&
      hp - damage < 1 &&
      heal > 0 &&
      next.combatFood &&
      (next.inventory[next.combatFood] ?? 0) > 0
    ) {
      const left = next.inventory[next.combatFood]! - 1;
      if (left > 0) next.inventory[next.combatFood] = left;
      else delete next.inventory[next.combatFood];
      hp = Math.min(stats.maxHp, hp + heal);
      foodUsed++;
    }

    const defeated = Number.isFinite(damage) && hp - damage >= 1;
    if (defeated) {
      hp -= damage;
      totalMs += timeMs;
      next.monsterKills[monsterId] = (next.monsterKills[monsterId] ?? 0) + 1;
      gains.kills[monsterId] = (gains.kills[monsterId] ?? 0) + 1;
      attackXp += monster.xp;
      hitpointsXp += hitpointsXpPerKill(damage);
      fights.push({ monsterId, defeated: true, timeMs, damageTaken: damage, foodUsed });
    } else {
      success = false;
      fights.push({ monsterId, defeated: false, timeMs: 0, damageTaken: 0, foodUsed });
      break;
    }
  }

  const rewards: Record<ItemId, number> = {};
  let firstClear = false;
  if (success) {
    const priorClears = next.dungeonClears[dungeonId] ?? 0;
    firstClear = priorClears === 0;
    next.dungeonClears[dungeonId] = priorClears + 1;

    // 전투 XP: 최초 클리어만 풀 지급, 반복은 DUNGEON_REPEAT_XP_MULT만(클릭 스팸 누수 차단).
    // 패배(success=false)는 이 블록에 들어오지 않으므로 부분 처치분도 전투 XP 0.
    const xpMult = firstClear ? 1 : DUNGEON_REPEAT_XP_MULT;
    grantXp(next, gains, 'attack', Math.round(attackXp * xpMult));
    grantXp(next, gains, 'hitpoints', Math.round(hitpointsXp * xpMult));

    // 보상 난수: 던전별 클리어 순번을 시드로 — 결정적
    const roll = mulberry32(hashString(dungeonId) ^ Math.imul(priorClears + 1, 2654435761));
    const table = firstClear ? dungeon.firstRewards : dungeon.repeatRewards;
    for (const entry of table) {
      if (roll() < entry.chance) {
        rewards[entry.itemId] = (rewards[entry.itemId] ?? 0) + entry.qty;
        next.inventory[entry.itemId] = (next.inventory[entry.itemId] ?? 0) + entry.qty;
        gains.itemsGained[entry.itemId] = (gains.itemsGained[entry.itemId] ?? 0) + entry.qty;
      }
    }
  }

  return {
    state: next,
    result: {
      dungeonId,
      success,
      firstClear,
      fights,
      totalMs,
      rewards,
      xp: gains.xp,
      hpAfter: hp,
      maxHp: stats.maxHp,
    },
  };
}
