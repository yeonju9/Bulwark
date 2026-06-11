import { SKILLS, xpProgress } from '@idle-rpg/core';
import { useGame } from '../store';

export function Sidebar() {
  const skills = useGame((s) => s.game.skills);
  const inventory = useGame((s) => s.game.inventory);
  const panel = useGame((s) => s.panel);
  const setPanel = useGame((s) => s.setPanel);
  const active = useGame((s) => s.game.activeAction);

  const itemCount = Object.keys(inventory).length;

  return (
    <nav className="sidebar">
      {SKILLS.map((skill) => {
        const { level, into, needed } = xpProgress(skills[skill.id].xp);
        const pct = needed > 0 ? (into / needed) * 100 : 100;
        return (
          <button
            key={skill.id}
            className={`sidebar-item ${panel === skill.id ? 'selected' : ''}`}
            onClick={() => setPanel(skill.id)}
          >
            <span className="sidebar-icon">{skill.icon}</span>
            <span className="sidebar-info">
              <span className="sidebar-name">
                {skill.name}
                {active?.skillId === skill.id && <span className="pulse-dot" />}
              </span>
              <span className="sidebar-level">Lv {level}</span>
              <span className="xp-bar">
                <span className="xp-bar-fill" style={{ width: `${pct}%` }} />
              </span>
            </span>
          </button>
        );
      })}
      <button
        className={`sidebar-item ${panel === 'inventory' ? 'selected' : ''}`}
        onClick={() => setPanel('inventory')}
      >
        <span className="sidebar-icon">🎒</span>
        <span className="sidebar-info">
          <span className="sidebar-name">인벤토리</span>
          <span className="sidebar-level">{itemCount}종</span>
        </span>
      </button>
    </nav>
  );
}
