import { getDungeon, getItem, getMonster, getSkill, type DungeonResult, type SkillId } from '@idle-rpg/core';
import { formatNumber } from '../format';
import { useGame } from '../store';

export function DungeonResultModal({ result }: { result: DungeonResult }) {
  const dismiss = useGame((s) => s.dismissDungeonResult);
  const dungeon = getDungeon(result.dungeonId);

  const xpEntries = Object.entries(result.xp) as [SkillId, number][];
  const rewardEntries = Object.entries(result.rewards);

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>{result.success ? '🏆 던전 클리어!' : '💀 패배…'}</h2>
        <p className="modal-sub">
          {dungeon.icon} {dungeon.name}
          {result.success
            ? ` — ${(result.totalMs / 1000).toFixed(0)}초 만에 돌파했습니다`
            : ' — 다음에는 더 좋은 장비와 음식을 준비하세요'}
        </p>

        <div className="modal-section">
          {result.fights.map((fight, i) => {
            const monster = getMonster(fight.monsterId);
            return (
              <div key={i} className={fight.defeated ? '' : 'modal-warn'}>
                {fight.defeated ? '✅' : '💀'} {monster.icon} {monster.name}
                {fight.defeated
                  ? ` — ${(fight.timeMs / 1000).toFixed(1)}초, 피해 ${fight.damageTaken}${fight.foodUsed > 0 ? `, 음식 ${fight.foodUsed}개` : ''}`
                  : ' — 여기서 쓰러졌습니다'}
              </div>
            );
          })}
        </div>

        {xpEntries.length > 0 && (
          <div className="modal-section">
            {xpEntries.map(([skillId, xp]) => (
              <div key={skillId}>
                {getSkill(skillId).icon} {getSkill(skillId).name} +{formatNumber(xp)} XP
              </div>
            ))}
          </div>
        )}

        {rewardEntries.length > 0 && (
          <div className="modal-section">
            {rewardEntries.map(([itemId, qty]) => (
              <div key={itemId} className="modal-levelup">
                {getItem(itemId).icon} {getItem(itemId).name} ×{formatNumber(qty)}
              </div>
            ))}
          </div>
        )}

        <div className="modal-section">
          ❤️ 남은 HP: {Math.floor(result.hpAfter)}
        </div>

        <button className="btn btn-primary" onClick={dismiss}>확인</button>
      </div>
    </div>
  );
}
