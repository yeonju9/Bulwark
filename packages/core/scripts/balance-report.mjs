// 밸런스 리포트: 각 스킬을 "그 시점의 최고 XP 효율 액션"으로만 돌렸을 때
// 해금 포인트별 도달 시간을 출력한다. 수치 조정 후 매번 재실행해 곡선을 확인할 것.
// 실행: npm run balance -w @idle-rpg/core  (코어 빌드 포함)
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { SKILLS, SLOT_UNLOCKS, actionsForSkill, xpForLevel, MAX_LEVEL } = require('../dist/index.js');

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

console.log('▶ 작업 슬롯 해금 (총 레벨 = 모든 스킬 레벨 합, 시작값 14)');
console.log('  (그리디 = 매번 가장 싼 레벨을 올리는 이론상 최단 경로. 실플레이는 이보다 느림)');
for (const unlock of SLOT_UNLOCKS) {
  console.log(
    `  슬롯 ${unlock.slots} (총 Lv ${unlock.totalLevel}): 그리디 최단 약 ${fmt(greedyTotalLevelTime(unlock.totalLevel))}`,
  );
}
