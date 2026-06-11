import { COMBAT_SKILL_IDS, levelFromXp, SKILLS, xpProgress } from '@idle-rpg/core';
import { useGame, type Panel } from '../store';

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
  const skills = useGame((s) => s.game.skills);
  const inventory = useGame((s) => s.game.inventory);
  const panel = useGame((s) => s.panel);
  const setPanel = useGame((s) => s.setPanel);
  const activeActions = useGame((s) => s.game.activeActions);
  const hp = useGame((s) => s.game.hp);

  const attackLevel = levelFromXp(skills.attack.xp);
  const hpLevel = levelFromXp(skills.hitpoints.xp);
  const hunting = activeActions.some((a) => a.skillId === 'attack');

  return (
    <nav className="sidebar">
      <div className="sidebar-section">전투</div>
      <NavItem
        panel="character"
        icon="🧙"
        name="캐릭터"
        sub={`HP ${Math.floor(hp)}/${hpLevel * 10}`}
      />
      <NavItem panel="hunt" icon="⚔️" name="사냥터" sub={`공격 Lv ${attackLevel}`} pulse={hunting} />
      <NavItem panel="dungeon" icon="🏰" name="던전" />
      <NavItem panel="collection" icon="📖" name="도감" />

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
            <span className="sidebar-icon">{skill.icon}</span>
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
      <NavItem panel="settings" icon="⚙️" name="설정" bottom />
    </nav>
  );
}
