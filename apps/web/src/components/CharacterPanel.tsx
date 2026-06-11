import {
  computeStats,
  getItem,
  xpProgress,
  type EquipSlot,
  type ItemId,
} from '@idle-rpg/core';
import { formatNumber } from '../format';
import { useGame } from '../store';

const SLOT_LABEL: Record<EquipSlot, string> = { weapon: '무기', armor: '방어구' };

export function CharacterPanel() {
  const game = useGame((s) => s.game);
  const equip = useGame((s) => s.equip);
  const unequip = useGame((s) => s.unequip);
  const setFood = useGame((s) => s.setFood);

  const stats = computeStats(game);
  const attackProgress = xpProgress(game.skills.attack.xp);
  const hpProgress = xpProgress(game.skills.hitpoints.xp);
  const hpPct = (game.hp / stats.maxHp) * 100;

  const equippables = Object.keys(game.inventory).filter((id) => getItem(id).equip) as ItemId[];
  const foods = Object.keys(game.inventory).filter((id) => getItem(id).food) as ItemId[];

  return (
    <div className="skill-panel">
      <div className="skill-header">
        <h2>🧙 캐릭터</h2>
      </div>

      <section className="settings-section">
        <h3>스탯</h3>
        <div className="char-hp">
          <span>❤️ HP {Math.floor(game.hp)} / {stats.maxHp}</span>
          <div className="xp-bar xp-bar-large hp-bar">
            <span className="xp-bar-fill hp-bar-fill" style={{ width: `${hpPct}%` }} />
          </div>
          <span className="settings-desc">사냥 중이 아닐 때 분당 {stats.hpLevel} 회복</span>
        </div>
        <div className="char-stats">
          <div>⚔️ 공격력 <strong>{stats.attackPower}</strong></div>
          <div>🛡️ 방어력 <strong>{stats.defense}</strong></div>
          <div>공격 Lv <strong>{attackProgress.level}</strong></div>
          <div>체력 Lv <strong>{hpProgress.level}</strong></div>
        </div>
      </section>

      <section className="settings-section">
        <h3>장비</h3>
        {(Object.keys(SLOT_LABEL) as EquipSlot[]).map((slot) => {
          const equipped = game.equipment[slot];
          const item = equipped ? getItem(equipped) : null;
          return (
            <div key={slot} className="equip-row">
              <span className="equip-slot-label">{SLOT_LABEL[slot]}</span>
              {item ? (
                <>
                  <span className="equip-item">
                    {item.icon} {item.name}
                    <span className="equip-stat">
                      {item.equip!.attack ? ` 공격 +${item.equip!.attack}` : ''}
                      {item.equip!.defense ? ` 방어 +${item.equip!.defense}` : ''}
                    </span>
                  </span>
                  <button className="btn btn-small" onClick={() => unequip(slot)}>해제</button>
                </>
              ) : (
                <span className="equip-empty">비어 있음</span>
              )}
            </div>
          );
        })}
        {equippables.length > 0 && (
          <>
            <p className="settings-desc" style={{ marginTop: 12 }}>인벤토리의 장비:</p>
            {equippables.map((id) => {
              const item = getItem(id);
              const req = item.equip!.levelRequired ?? 1;
              const canEquip = stats.attackLevel >= req;
              return (
                <div key={id} className="equip-row">
                  <span className="equip-item">
                    {item.icon} {item.name} ×{game.inventory[id]}
                    <span className="equip-stat">
                      {item.equip!.attack ? ` 공격 +${item.equip!.attack}` : ''}
                      {item.equip!.defense ? ` 방어 +${item.equip!.defense}` : ''}
                      {req > 1 ? ` (공격 Lv ${req})` : ''}
                    </span>
                  </span>
                  <button className="btn btn-small" disabled={!canEquip} onClick={() => equip(id)}>
                    장착
                  </button>
                </div>
              );
            })}
          </>
        )}
      </section>

      <section className="settings-section">
        <h3>사냥 음식</h3>
        <p className="settings-desc">
          사냥 중 HP가 떨어지면 자동으로 먹습니다. 음식 없이 위험한 사냥을 하면 도중에 멈춥니다.
        </p>
        <div className="equip-row">
          <span className="equip-slot-label">지정됨</span>
          {game.combatFood ? (
            <>
              <span className="equip-item">
                {getItem(game.combatFood).icon} {getItem(game.combatFood).name} ×
                {formatNumber(game.inventory[game.combatFood] ?? 0)}
                <span className="equip-stat"> 회복 +{getItem(game.combatFood).food!.heal}</span>
              </span>
              <button className="btn btn-small" onClick={() => setFood(null)}>해제</button>
            </>
          ) : (
            <span className="equip-empty">없음</span>
          )}
        </div>
        {foods
          .filter((id) => id !== game.combatFood)
          .map((id) => {
            const item = getItem(id);
            return (
              <div key={id} className="equip-row">
                <span className="equip-item">
                  {item.icon} {item.name} ×{formatNumber(game.inventory[id] ?? 0)}
                  <span className="equip-stat"> 회복 +{item.food!.heal}</span>
                </span>
                <button className="btn btn-small" onClick={() => setFood(id)}>지정</button>
              </div>
            );
          })}
      </section>
    </div>
  );
}
