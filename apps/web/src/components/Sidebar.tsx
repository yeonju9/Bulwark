import { COMBAT_SKILL_IDS, computeVillageStats, levelFromXp, SKILLS, xpProgress } from '@idle-rpg/core';
import { useGame, type Panel } from '../store';
import { GameIcon } from './GameIcon';

function NavItem({
  panel,
  icon,
  name,
  sub,
  pulse,
  bottom,
}: {
  panel: Panel;
  icon: string;
  name: string;
  sub?: string;
  pulse?: boolean;
  bottom?: boolean;
}) {
  const selected = useGame((s) => s.panel === panel);
  const setPanel = useGame((s) => s.setPanel);
  return (
    <button
      className={`sidebar-item ${selected ? 'selected' : ''} ${bottom ? 'sidebar-bottom' : ''}`}
      onClick={() => setPanel(panel)}
    >
      <span className="sidebar-icon">{icon}</span>
      <span className="sidebar-info">
        <span className="sidebar-name">
          {name}
          {pulse && <span className="pulse-dot" />}
        </span>
        {sub && <span className="sidebar-level">{sub}</span>}
      </span>
    </button>
  );
}

export function Sidebar() {
  const game = useGame((s) => s.game);
  const skills = game.skills;
  const inventory = game.inventory;
  const panel = useGame((s) => s.panel);
  const setPanel = useGame((s) => s.setPanel);
  const activeActions = game.activeActions;
  const village = game.village;

  const attackLevel = levelFromXp(skills.attack.xp);
  const maxHp = computeVillageStats(game).maxHp;

  return (
    <nav className="sidebar">
      <div className="sidebar-section">마을</div>
      <NavItem
        panel="map"
        icon="🗺️"
        name="마을 지도"
        sub={`HP ${Math.floor(village.hp)}/${maxHp}`}
        pulse={village.underSiege}
      />
      <NavItem panel="collection" icon="📖" name="도감" sub={`공격 Lv ${attackLevel}`} />

      <div className="sidebar-section">스킬</div>
      {SKILLS.filter((skill) => !COMBAT_SKILL_IDS.includes(skill.id)).map((skill) => {
        const { level, into, needed } = xpProgress(skills[skill.id].xp);
        const pct = needed > 0 ? (into / needed) * 100 : 100;
        return (
          <button
            key={skill.id}
            className={`sidebar-item ${panel === skill.id ? 'selected' : ''}`}
            onClick={() => setPanel(skill.id)}
          >
            <span className="sidebar-icon"><GameIcon id={skill.id} emoji={skill.icon} /></span>
            <span className="sidebar-info">
              <span className="sidebar-name">
                {skill.name}
                {activeActions.some((a) => a.skillId === skill.id) && (
                  <span className="pulse-dot" />
                )}
              </span>
              <span className="sidebar-level" key={level}>Lv {level}</span>
              <span className="xp-bar">
                <span className="xp-bar-fill" style={{ width: `${pct}%` }} />
              </span>
            </span>
          </button>
        );
      })}
      <NavItem panel="inventory" icon="🎒" name="인벤토리" sub={`${Object.keys(inventory).length}종`} />
      <NavItem panel="shop" icon="🏪" name="상점" />
      <NavItem panel="settings" icon="⚙️" name="설정" bottom />
    </nav>
  );
}
