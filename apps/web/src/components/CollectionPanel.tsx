import { MONSTERS } from '@idle-rpg/core';
import { formatNumber } from '../format';
import { useGame } from '../store';
import { GameIcon } from './GameIcon';

export function CollectionPanel() {
  const kills = useGame((s) => s.game.monsterKills);

  const monsters = [...MONSTERS.values()];
  const discovered = monsters.filter((m) => (kills[m.id] ?? 0) > 0).length;

  return (
    <div className="skill-panel">
      <div className="skill-header">
        <h2>📖 도감</h2>
        <p className="skill-desc">
          처치한 몬스터가 기록됩니다. ({discovered}/{monsters.length} 발견)
        </p>
      </div>
      <div className="action-grid">
        {monsters.map((monster) => {
          const count = kills[monster.id] ?? 0;
          const found = count > 0;
          return (
            <div key={monster.id} className={`action-card ${found ? '' : 'locked'}`}>
              <div className="action-icon">
                {found ? <GameIcon id={monster.id} emoji={monster.icon} /> : '❓'}
              </div>
              <div className="action-name">{found ? monster.name : '???'}</div>
              <div className="action-meta">
                {found ? `처치 ${formatNumber(count)}회` : '아직 만나지 못함'}
              </div>
              {found && (
                <div className="action-meta">
                  HP {monster.hp} · 공격 {monster.attack} · 방어 {monster.defense}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
