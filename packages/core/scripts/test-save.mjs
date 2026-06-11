// 개발용 테스트 세이브 생성기. 출력된 JSON을 게임의 설정 → 세이브 가져오기에 붙여넣는다.
// 실행: node scripts/test-save.mjs [stage]   (stage: wolf | goblin | orc, 기본 wolf)
// 주의: 코어 빌드(dist) 기준이므로 데이터 변경 후에는 npm run build 먼저.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createInitialState, xpForLevel } = require('../dist/index.js');

const stage = process.argv[2] ?? 'wolf';

const presets = {
  // 늑대(공격 Lv10) 단계: 철 검 + 가죽 갑옷 + 음식
  wolf: {
    attack: 12, hitpoints: 15, smithing: 15, woodcutting: 12, mining: 12,
    equipment: { weapon: 'iron_sword', armor: 'leather_armor' },
    inventory: { dried_meat: 50, leather: 10, iron_bar: 10, oak_log: 10 },
    gold: 500,
  },
  // 고블린(Lv15)~던전 도전 단계: 은 검 + 철 갑옷
  goblin: {
    attack: 20, hitpoints: 22, smithing: 24, woodcutting: 20, mining: 22,
    equipment: { weapon: 'silver_sword', armor: 'iron_armor' },
    inventory: { dried_meat: 80, leather: 20, silver_bar: 10, iron_bar: 10 },
    gold: 2000,
  },
  // 오크(Lv30)~미스릴 단계
  orc: {
    attack: 32, hitpoints: 32, smithing: 36, woodcutting: 30, mining: 32,
    equipment: { weapon: 'silver_sword', armor: 'iron_armor' },
    inventory: { dried_meat: 150, mithril_bar: 10, maple_log: 10, leather: 30, magic_stone: 5 },
    gold: 10000,
  },
};

const preset = presets[stage];
if (!preset) {
  console.error(`알 수 없는 stage: ${stage} (wolf | goblin | orc)`);
  process.exit(1);
}

const state = createInitialState(Date.now());
for (const skill of ['attack', 'hitpoints', 'smithing', 'woodcutting', 'mining']) {
  state.skills[skill].xp = xpForLevel(preset[skill]);
}
state.hp = preset.hitpoints * 10;
state.equipment = preset.equipment;
state.combatFood = 'dried_meat';
state.inventory = preset.inventory;
state.gold = preset.gold;

console.log(JSON.stringify(state));
