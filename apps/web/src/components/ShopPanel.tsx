import { getSkill, UPGRADE_SPEED_PER_STAGE, UPGRADES } from '@idle-rpg/core';
import { formatNumber } from '../format';
import { useGame } from '../store';

export function ShopPanel() {
  const gold = useGame((s) => s.game.gold);
  const upgrades = useGame((s) => s.game.upgrades);
  const buy = useGame((s) => s.buy);

  return (
    <div className="skill-panel">
      <div className="skill-header">
        <h2>🏪 상점</h2>
        <p className="skill-desc">
          영구 도구 업그레이드 — 단계마다 해당 스킬의 채집 속도가{' '}
          {Math.round((1 - UPGRADE_SPEED_PER_STAGE) * 100)}%씩 빨라집니다 (중첩 시 곱연산).
        </p>
      </div>
      <div className="action-grid">
        {UPGRADES.map((upgrade) => {
          const stage = upgrades[upgrade.skillId] ?? 0;
          const next = upgrade.stages[stage];
          const maxed = next === undefined;
          const current = stage > 0 ? upgrade.stages[stage - 1].name : '기본 도구';
          const speedPct = Math.round((1 - Math.pow(UPGRADE_SPEED_PER_STAGE, stage)) * 100);
          return (
            <div key={upgrade.skillId} className="action-card">
              <div className="action-icon">{upgrade.icon}</div>
              <div className="action-name">
                {getSkill(upgrade.skillId).name} {upgrade.name}
              </div>
              <div className="action-meta">
                현재: {current} ({stage}/{upgrade.stages.length}단계)
              </div>
              <div className="action-meta action-rate">
                {speedPct > 0 ? `채집 속도 +${speedPct}%` : '업그레이드 없음'}
              </div>
              {maxed ? (
                <button className="btn" disabled>
                  최대 단계
                </button>
              ) : (
                <button className="btn" disabled={gold < next.price} onClick={() => buy(upgrade.skillId)}>
                  {next.name} — 🪙 {formatNumber(next.price)}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
