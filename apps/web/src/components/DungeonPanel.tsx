import { allDungeons, getItem, getMonster } from '@idle-rpg/core';
import { formatDuration } from '../format';
import { useGame } from '../store';

export function DungeonPanel() {
  const game = useGame((s) => s.game);
  const enterDungeon = useGame((s) => s.enterDungeon);

  const hunting = game.activeActions.some((a) => a.skillId === 'attack');

  return (
    <div className="skill-panel">
      <div className="skill-header">
        <h2>🏰 던전</h2>
        <p className="skill-desc">
          몬스터를 연달아 상대하는 단발 도전입니다. 장비·음식을 준비하고 들어가세요. 패배해도
          잃는 것은 없지만, 보상은 클리어해야 나옵니다.
        </p>
      </div>

      <div className="action-grid dungeon-grid">
        {allDungeons().map((dungeon) => {
          const cooldownUntil = game.dungeonCooldowns[dungeon.id] ?? 0;
          const remaining = cooldownUntil - game.lastTickAt;
          const onCooldown = remaining > 0;

          return (
            <div key={dungeon.id} className="action-card dungeon-card">
              <div className="action-icon">{dungeon.icon}</div>
              <div className="action-name">{dungeon.name}</div>
              <p className="action-meta">{dungeon.description}</p>

              <div className="action-meta">등장 몬스터</div>
              <div className="action-outputs">
                {dungeon.monsters.map((monsterId, i) => {
                  const monster = getMonster(monsterId);
                  const isBoss = i === dungeon.monsters.length - 1;
                  return (
                    <span key={i} className={`output-chip ${isBoss ? 'boss-chip' : ''}`}>
                      {monster.icon} {monster.name}
                      {isBoss ? ' (보스)' : ''}
                    </span>
                  );
                })}
              </div>

              <div className="action-meta">클리어 보상</div>
              <div className="action-outputs">
                {dungeon.rewards.map((reward) => (
                  <span key={reward.itemId} className="output-chip">
                    {getItem(reward.itemId).icon} {getItem(reward.itemId).name} ×{reward.qty}
                    {reward.chance < 1 ? ` (${Math.round(reward.chance * 100)}%)` : ''}
                  </span>
                ))}
              </div>

              {hunting ? (
                <button className="btn" disabled>사냥 중에는 입장 불가</button>
              ) : onCooldown ? (
                <button className="btn" disabled>재정비 중 — {formatDuration(remaining)}</button>
              ) : (
                <button className="btn btn-primary" onClick={() => enterDungeon(dungeon.id)}>
                  도전하기
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
