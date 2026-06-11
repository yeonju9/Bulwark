import { getItem } from '@idle-rpg/core';
import { formatNumber } from '../format';
import { useGame } from '../store';

export function InventoryPanel() {
  const inventory = useGame((s) => s.game.inventory);
  const sell = useGame((s) => s.sell);

  const entries = Object.entries(inventory).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="skill-panel">
      <div className="skill-header">
        <h2>🎒 인벤토리</h2>
        <p className="skill-desc">아이템을 판매해 골드를 얻을 수 있습니다.</p>
      </div>
      {entries.length === 0 ? (
        <p className="inventory-empty">아직 아이템이 없습니다. 스킬을 시작해보세요!</p>
      ) : (
        <div className="inventory-grid">
          {entries.map(([itemId, qty]) => {
            const item = getItem(itemId);
            return (
              <div key={itemId} className="inventory-card">
                <div className="action-icon">{item.icon}</div>
                <div className="action-name">{item.name}</div>
                <div className="action-meta">×{formatNumber(qty)}</div>
                <div className="action-meta">개당 🪙 {formatNumber(item.sellPrice)}</div>
                <div className="inventory-actions">
                  <button className="btn btn-small" onClick={() => sell(itemId, 1)}>
                    1개 판매
                  </button>
                  <button className="btn btn-small" onClick={() => sell(itemId, 'all')}>
                    전부 판매
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
