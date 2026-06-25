// 밸런스 리포트: 각 스킬을 "그 시점의 최고 XP 효율 액션"으로만 돌렸을 때
// 해금 포인트별 도달 시간을 출력한다. 수치 조정 후 매번 재실행해 곡선을 확인할 것.
// 실행: npm run balance -w @idle-rpg/core  (코어 빌드 포함)
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  ACTIONS, ITEMS, SKILLS, SLOT_UNLOCKS, UPGRADES,
  actionsForSkill, getMonster, getSkill, xpForLevel, MAX_LEVEL,
  damageTakenPerKill, hitpointsXpPerKill,
  createInitialState, computeVillageStats, grossWaveDamage, getStage,
  WAVE_PERIOD_MS, REGEN_PER_MINUTE_PER_HP_LEVEL, WAVE_GOLD_BASE, wallReinforceCost, getBuilding,
} = require('../dist/index.js');

function fmt(ms) {
  const totalMin = ms / 60000;
  if (totalMin < 1) return `${Math.round(ms / 1000)}초`;
  if (totalMin < 60) return `${totalMin.toFixed(1)}분`;
  const h = totalMin / 60;
  if (h < 48) return `${h.toFixed(1)}시간`;
  return `${(h / 24).toFixed(1)}일`;
}

/**
 * 레벨 level에서 사용 가능한 최고 XP/ms (제작은 재료가 무한하다고 가정 — 리포트에 명시).
 * 전투 액션은 사이클 시간이 스탯 의존이라 제외 — 전투 곡선은 별도 시뮬레이터로 다룬다.
 */
function bestXpRate(skillId, level) {
  let best = 0;
  for (const action of actionsForSkill(skillId)) {
    if (action.combat || action.durationMs <= 0) continue;
    if (action.levelRequired <= level) best = Math.max(best, action.xp / action.durationMs);
  }
  return best;
}

/** 레벨 1 → targetLevel 도달까지의 누적 시간(ms) */
function timeToLevel(skillId, targetLevel) {
  let ms = 0;
  for (let lv = 1; lv < targetLevel; lv++) {
    const rate = bestXpRate(skillId, lv);
    if (rate === 0) return Infinity;
    ms += (xpForLevel(lv + 1) - xpForLevel(lv)) / rate;
  }
  return ms;
}

console.log('━━━ 밸런스 리포트 ━━━');
console.log('(가정: 항상 최고 효율 액션 가동, 제작 재료는 준비되어 있음)\n');

const milestones = [50, 75, 99];

for (const skill of SKILLS) {
  // 전투 스킬(공격/체력)은 시간 기반 액션이 없으므로 이 리포트에서 제외
  if (bestXpRate(skill.id, 99) === 0) continue;
  console.log(`▶ ${skill.name}`);
  const unlockLevels = [
    ...new Set(actionsForSkill(skill.id).map((a) => a.levelRequired).filter((l) => l > 1)),
  ].sort((a, b) => a - b);

  for (const lv of unlockLevels) {
    const unlocks = actionsForSkill(skill.id)
      .filter((a) => a.levelRequired === lv)
      .map((a) => a.name)
      .join(', ');
    console.log(`  Lv ${String(lv).padStart(2)} (${unlocks}): ${fmt(timeToLevel(skill.id, lv))}`);
  }
  for (const lv of milestones) {
    if (lv <= MAX_LEVEL) console.log(`  Lv ${lv} (마일스톤): ${fmt(timeToLevel(skill.id, lv))}`);
  }
  console.log('');
}

/**
 * 총 레벨 목표까지 그리디 최적 경로(매번 다음 레벨이 가장 싼 스킬을 올림) 소요 시간.
 * 전투 스킬은 rate 0이라 제외됨 — 실플레이에선 전투도 총 레벨에 기여하므로 보수적 추정.
 */
function greedyTotalLevelTime(targetTotal) {
  const levels = Object.fromEntries(SKILLS.map((s) => [s.id, s.id === 'hitpoints' ? 10 : 1]));
  let total = Object.values(levels).reduce((a, b) => a + b, 0);
  let ms = 0;
  while (total < targetTotal) {
    let best = null;
    for (const s of SKILLS) {
      const lv = levels[s.id];
      if (lv >= MAX_LEVEL) continue;
      const rate = bestXpRate(s.id, lv);
      if (rate === 0) continue;
      const cost = (xpForLevel(lv + 1) - xpForLevel(lv)) / rate;
      if (!best || cost < best.cost) best = { id: s.id, cost };
    }
    if (!best) return Infinity;
    ms += best.cost;
    levels[best.id]++;
    total++;
  }
  return ms;
}

console.log('▶ 작업 슬롯 해금 (총 레벨 = 모든 스킬 레벨 합, 시작값 17)');
console.log('  (그리디 = 매번 가장 싼 레벨을 올리는 이론상 최단 경로. 실플레이는 이보다 느림)');
for (const unlock of SLOT_UNLOCKS) {
  console.log(
    `  슬롯 ${unlock.slots} (총 Lv ${unlock.totalLevel}): 그리디 최단 약 ${fmt(greedyTotalLevelTime(unlock.totalLevel))}`,
  );
}

// ━━━ 아이템 → 소비처 매트릭스 (Phase 3 DoD: 빈 칸 = 실패) ━━━
console.log('\n▶ 아이템 → 소비처 매트릭스 (소비처 없는 아이템 = 경제 순환 실패)');
const consumers = new Map(); // itemId → string[]
const add = (itemId, text) => {
  if (!consumers.has(itemId)) consumers.set(itemId, []);
  consumers.get(itemId).push(text);
};
for (const action of ACTIONS.values()) {
  for (const input of action.inputs ?? []) add(input.itemId, `제작: ${action.name}`);
}
for (const item of ITEMS.values()) {
  if (item.equip) add(item.id, `장비 (${item.equip.slot === 'weapon' ? '무기' : '방어구'})`);
  if (item.food) add(item.id, `음식 (회복 ${item.food.heal})`);
  if (item.potion) add(item.id, '물약 (버프)');
}
let missingCount = 0;
for (const item of ITEMS.values()) {
  const uses = consumers.get(item.id);
  if (!uses) {
    missingCount++;
    console.log(`  ❌ ${item.name}: 소비처 없음!`);
  } else {
    console.log(`  ${item.name}: ${[...new Set(uses)].join(' / ')}`);
  }
}
console.log(missingCount === 0 ? '  ✅ 모든 아이템에 소비처가 있습니다' : `  ❌ ${missingCount}개 아이템 소비처 없음`);

// ━━━ 골드 수입 vs 도구 업그레이드 가격 ━━━
console.log('\n▶ 시간당 골드 수입 vs 업그레이드 가격 (산출물 전량 판매 가정)');
function goldPerHour(action) {
  let gold = 0;
  for (const output of action.outputs) {
    gold += (ITEMS.get(output.itemId)?.sellPrice ?? 0) * output.qty;
  }
  // 전투 액션은 전리품 기대값 (사이클 시간은 스탯 의존이라 제외)
  return (gold * 3_600_000) / action.durationMs;
}
for (const upgrade of UPGRADES) {
  const skillName = getSkill(upgrade.skillId).name;
  console.log(`  ${upgrade.icon} ${skillName} ${upgrade.name}`);
  const actions = actionsForSkill(upgrade.skillId).filter((a) => !a.combat);
  for (const [i, stage] of upgrade.stages.entries()) {
    // 해당 단계쯤 도달했을 액션 가정: 단계 인덱스에 비례해 상위 액션 사용
    const tierIndex = Math.min(actions.length - 1, i + 1);
    const action = actions[tierIndex];
    const rate = goldPerHour(action);
    const hours = stage.price / rate;
    console.log(
      `    ${i + 1}단계 ${stage.name} (🪙 ${stage.price.toLocaleString()}): ` +
      `${action.name} 판매 기준 시간당 🪙 ${Math.round(rate).toLocaleString()} → 약 ${fmt(hours * 3_600_000)}`,
    );
  }
}

// ━━━ 마을 방어 손익표 (Phase 3.5: 웨이브 정산 밸런스) ━━━
// 가정: 정적 스냅샷 — 스탯 고정(웨이브 중 레벨업 무시), 보급품 없음(순수 HP 버티기).
// 실제로는 매 웨이브 처치 XP로 마을이 강해져 더 오래 버틴다(보수적 하한 추정).
// net = 웨이브당 받는 피해 - 자연회복. net≤0이면 무한 방어(안전 파밍 티어).
console.log('\n▶ 마을 방어 손익표 — 빌드 × 웨이브 티어 (정적 스냅샷, 보급품 없음)');
console.log(`  (웨이브 주기 ${WAVE_PERIOD_MS / 60000}분, 자연회복 분당 체력레벨×${REGEN_PER_MINUTE_PER_HP_LEVEL})`);

const wavesPerHour = 3_600_000 / WAVE_PERIOD_MS;
const regenPerWave = (hpLevel) =>
  Math.round((WAVE_PERIOD_MS / 60000) * hpLevel * REGEN_PER_MINUTE_PER_HP_LEVEL);

function buildState({ atk, hp, wall = 0, barracks = 0, weapon = null, armor = null }) {
  const s = createInitialState(0);
  s.skills.attack.xp = xpForLevel(atk);
  s.skills.hitpoints.xp = xpForLevel(hp);
  s.village.wallLevel = wall;
  let placed = 0;
  for (let i = 0; i < 9 && placed < barracks; i++) {
    if (i === 4) continue; // 본부
    s.village.buildings[i] = { id: 'barracks', damaged: false };
    placed++;
  }
  s.equipment.weapon = weapon;
  s.equipment.armor = armor;
  return s;
}

function lootGoldPerWave(monsters) {
  let gold = 0;
  for (const id of monsters) {
    for (const entry of getMonster(id).lootTable) {
      gold += (ITEMS.get(entry.itemId)?.sellPrice ?? 0) * entry.qty * entry.chance;
    }
  }
  return gold;
}

// 진행 단계를 대표하는 마을 빌드들 (초반→후반)
const BUILDS = [
  { name: '새 마을', atk: 1, hp: 10, wall: 0, barracks: 0 },
  { name: '성벽2+병영1', atk: 8, hp: 14, wall: 2, barracks: 1, weapon: 'copper_sword', armor: 'leather_armor' },
  { name: '철 빌드', atk: 16, hp: 20, wall: 4, barracks: 2, weapon: 'iron_sword', armor: 'iron_armor' },
  { name: '미스릴 빌드', atk: 32, hp: 32, wall: 6, barracks: 3, weapon: 'mithril_sword', armor: 'mithril_armor' },
  { name: '엔드 빌드', atk: 52, hp: 50, wall: 10, barracks: 5, weapon: 'orichalcum_sword', armor: 'orichalcum_armor' },
];

const stage1 = getStage(1);
for (const build of BUILDS) {
  const stats = computeVillageStats(buildState(build));
  console.log(
    `  ◆ ${build.name} (공Lv${build.atk}·체Lv${build.hp}·성벽${build.wall}·병영${build.barracks}` +
    ` → 공격력 ${stats.attackPower}, 방어 ${stats.defense}, 최대HP ${stats.maxHp})`,
  );
  for (const tier of stage1.tiers) {
    const gross = grossWaveDamage(stats, tier.monsters);
    const regen = regenPerWave(stats.hpLevel);
    const net = Number.isFinite(gross) ? Math.max(0, gross - regen) : Infinity;
    const attackXp = tier.monsters.reduce((a, id) => a + getMonster(id).xp, 0) * tier.rewardMultiplier;
    const hpXp = tier.monsters.reduce(
      (a, id) => a + hitpointsXpPerKill(damageTakenPerKill(stats, getMonster(id))), 0,
    ) * tier.rewardMultiplier;
    const xpPerHour = Math.round((attackXp + hpXp) * wavesPerHour);
    const goldPerWave = lootGoldPerWave(tier.monsters) + WAVE_GOLD_BASE * tier.rewardMultiplier;
    const goldPerHour = Math.round(goldPerWave * wavesPerHour);
    let hold;
    if (net <= 0) hold = '✅안전(무한 방어)';
    else {
      const w = Math.floor((stats.maxHp - 1) / net);
      hold = w <= 0 ? '⛔ 즉시 패배' : `⚠️ ${w}웨이브 (${fmt(w * WAVE_PERIOD_MS)})`;
    }
    console.log(
      `    T${tier.tier} ${tier.name.padEnd(8, ' ')} net ${String(net === Infinity ? '∞' : net).padStart(4)} ` +
      `· XP ${String(xpPerHour).padStart(6)}/h · 🪙 ${String(goldPerHour).padStart(5)}/h · ${hold}`,
    );
  }
}

// ━━━ 티어 해금 정렬 점검 (각 티어를 "열리는 시점의 실제 빌드"로 평가) ━━━
// 티어는 던전 클리어로 열린다(stages.ts unlockClears). 던전을 깨려면 그만한 전투력이
// 필요하므로, 티어를 여는 시점의 빌드는 새 마을이 아니라 그 던전 레벨대의 빌드다.
// 아래는 "해금 직후 대표 빌드"로 그 티어를 평가해, 표의 '즉시 패배' 착시를 걷어낸다.
console.log('\n▶ 티어 해금 정렬 점검 (해금 시점의 대표 빌드로 평가 — 목표: 5~30웨이브)');
console.log('  (던전 클리어로 티어 해금 → 그 던전 레벨대의 빌드를 가정)');

// 해금 시점 대표 빌드. 던전 레벨(thicket5/wolf12/goblin20/orc30)에 맞춰 추정.
const UNLOCK_BUILDS = {
  1: { label: '시작(새 마을)', atk: 1, hp: 10, wall: 0, barracks: 0 },
  2: { label: '던전1 클리어 직후', atk: 6, hp: 12, wall: 1, barracks: 1, weapon: 'copper_sword', armor: 'leather_armor' },
  3: { label: '던전2 클리어 직후', atk: 13, hp: 16, wall: 2, barracks: 1, weapon: 'copper_sword', armor: 'leather_armor' },
  4: { label: '던전3 클리어 직후', atk: 20, hp: 22, wall: 4, barracks: 2, weapon: 'iron_sword', armor: 'iron_armor' },
  5: { label: '던전4 클리어 직후', atk: 30, hp: 30, wall: 6, barracks: 3, weapon: 'mithril_sword', armor: 'mithril_armor' },
};

for (const tier of stage1.tiers) {
  const build = UNLOCK_BUILDS[tier.tier];
  const stats = computeVillageStats(buildState(build));
  const gross = grossWaveDamage(stats, tier.monsters);
  const regen = regenPerWave(stats.hpLevel);
  const net = Number.isFinite(gross) ? Math.max(0, gross - regen) : Infinity;
  let verdict, hold;
  if (net <= 0) {
    hold = '∞ 무한 방어';
    verdict = '🟦 너무 쉬움(해금 즉시 무한 안전)';
  } else {
    const w = Math.floor((stats.maxHp - 1) / net);
    hold = w <= 0 ? '0웨이브' : `${w}웨이브 (${fmt(w * WAVE_PERIOD_MS)})`;
    verdict = w <= 0 ? '🟥 너무 어려움(즉시 패배)' : w < 5 ? '🟧 빡빡함(<5웨이브)' : w <= 30 ? '🟩 적정(5~30웨이브)' : '🟦 너무 쉬움(>30웨이브)';
  }
  console.log(
    `  T${tier.tier} ${tier.name.padEnd(8, ' ')} [${build.label}] ` +
    `공Lv${build.atk}·체Lv${build.hp} → 공격력 ${String(stats.attackPower).padStart(3)}·방어 ${String(stats.defense).padStart(2)}·HP ${String(stats.maxHp).padStart(4)} ` +
    `· 피해 ${String(Number.isFinite(gross) ? gross : '∞').padStart(4)}/회복 ${String(regen).padStart(3)} ` +
    `→ net ${String(net === Infinity ? '∞' : net).padStart(4)} · ${hold.padEnd(16)} ${verdict}`,
  );
}

// ━━━ 성벽 강화 비용 곡선 ━━━
console.log('\n▶ 성벽 강화 비용 (레벨별 누적 골드·자원)');
for (let lv = 0; lv < 10; lv++) {
  const cost = wallReinforceCost(lv);
  if (!cost) break;
  const items = cost.items.map((it) => `${ITEMS.get(it.itemId)?.name ?? it.itemId}×${it.qty}`).join(', ');
  console.log(`  Lv${lv}→${lv + 1}: 🪙 ${cost.gold.toLocaleString()} + ${items}`);
}

// ━━━ 건물 정보 ━━━
console.log('\n▶ 건물 (마을 스탯 기여 / 건설 비용)');
for (const id of ['headquarters', 'barracks', 'rampart']) {
  const b = getBuilding(id);
  const cost = b.fixed
    ? '시작 시 존재'
    : `🪙 ${b.buildGold} + ${(b.buildItems ?? []).map((it) => `${ITEMS.get(it.itemId)?.name ?? it.itemId}×${it.qty}`).join(', ')}`;
  console.log(`  ${b.icon} ${b.name}: HP+${b.hp} 공+${b.attack} 방+${b.defense} · ${cost}`);
}
