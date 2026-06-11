import { getItem } from '../data/items';
import { getDungeon, getMonster } from '../data/monsters';
import { hashString, mulberry32 } from '../rng';
import { computeStats, damageTakenPerKill, hitpointsXpPerKill, timeToKillMs } from './stats';
import { grantXp } from './hunt';
import type { DungeonId, Gains, GameState, ItemId, MonsterId, SkillId } from '../types';

/** 던전 재도전 대기 시간 (성공/실패 무관) */
export const DUNGEON_COOLDOWN_MS = 10 * 60 * 1000;

export type DungeonError = 'unknown-dungeon' | 'combat-in-progress' | 'on-cooldown';

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
  fights: DungeonFight[];
  totalMs: number;
  rewards: Record<ItemId, number>;
  xp: Partial<Record<SkillId, number>>;
  hpAfter: number;
}

export interface DungeonAttempt {
  state: GameState;
  error?: DungeonError;
  result?: DungeonResult;
}

/**
 * 던전 도전. 즉시 판정되는 단발 커맨드 — 방치 루프가 아니라 "준비해서 도전"하는 콘텐츠.
 * 호출 전에 simulate()로 정산된 상태를 넘기는 것이 전제 (다른 커맨드와 동일).
 * 시간 경과 대신 쿨다운(10분)으로 도전 빈도를 제한한다.
 * 패배해도 아이템·XP 손실은 없다 (HP 1로 생환, 잡은 몬스터의 XP는 유지).
 */
export function attemptDungeon(state: GameState, dungeonId: DungeonId, now: number): DungeonAttempt {
  let dungeon;
  try {
    dungeon = getDungeon(dungeonId);
  } catch {
    return { state, error: 'unknown-dungeon' };
  }
  if (state.activeActions.some((a) => a.skillId === 'attack')) {
    return { state, error: 'combat-in-progress' };
  }
  if ((state.dungeonCooldowns[dungeonId] ?? 0) > now) {
    return { state, error: 'on-cooldown' };
  }

  const next = structuredClone(state);
  const stats = computeStats(next);
  const gains: Gains = {
    elapsedMs: 0, discardedMs: 0, xp: {}, levelUps: {},
    itemsGained: {}, itemsConsumed: {}, kills: {}, stopped: [],
  };

  const foodItem = next.combatFood ? getItem(next.combatFood) : null;
  const heal = foodItem?.food?.heal ?? 0;

  const fights: DungeonFight[] = [];
  let totalMs = 0;
  let success = true;

  for (const monsterId of dungeon.monsters) {
    const monster = getMonster(monsterId);
    const timeMs = timeToKillMs(stats, monster);
    const damage = damageTakenPerKill(stats, monster);

    // 이번 전투를 버티는 데 필요한 만큼 음식을 먼저 먹는다 (자동 섭취)
    let foodUsed = 0;
    while (next.hp - damage < 1 && heal > 0 && (next.inventory[next.combatFood!] ?? 0) > 0) {
      const left = next.inventory[next.combatFood!]! - 1;
      if (left > 0) next.inventory[next.combatFood!] = left;
      else delete next.inventory[next.combatFood!];
      next.hp = Math.min(stats.maxHp, next.hp + heal);
      foodUsed++;
    }

    const defeated = next.hp - damage >= 1;
    if (defeated) {
      next.hp -= damage;
      totalMs += timeMs;
      next.monsterKills[monsterId] = (next.monsterKills[monsterId] ?? 0) + 1;
      gains.kills[monsterId] = (gains.kills[monsterId] ?? 0) + 1;
      grantXp(next, gains, 'attack', monster.xp);
      grantXp(next, gains, 'hitpoints', hitpointsXpPerKill(damage));
      fights.push({ monsterId, defeated: true, timeMs, damageTaken: damage, foodUsed });
    } else {
      // 패배: HP 1로 생환. 여기까지 잡은 몬스터의 XP·처치 수는 유지
      next.hp = 1;
      success = false;
      fights.push({ monsterId, defeated: false, timeMs: 0, damageTaken: 0, foodUsed });
      break;
    }
  }

  const rewards: Record<ItemId, number> = {};
  if (success) {
    // 보상 난수: 던전별 클리어 순번(보스 처치 수)을 시드로 — 결정적
    const bossId = dungeon.monsters[dungeon.monsters.length - 1];
    const clearIndex = next.monsterKills[bossId] ?? 1;
    const roll = mulberry32(hashString(dungeonId) ^ Math.imul(clearIndex, 2654435761));
    for (const entry of dungeon.rewards) {
      if (roll() < entry.chance) {
        rewards[entry.itemId] = (rewards[entry.itemId] ?? 0) + entry.qty;
        next.inventory[entry.itemId] = (next.inventory[entry.itemId] ?? 0) + entry.qty;
      }
    }
  }

  next.dungeonCooldowns[dungeonId] = now + DUNGEON_COOLDOWN_MS;

  return {
    state: next,
    result: {
      dungeonId,
      success,
      fights,
      totalMs,
      rewards,
      xp: gains.xp,
      hpAfter: next.hp,
    },
  };
}
