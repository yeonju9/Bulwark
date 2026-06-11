import { getAction } from '@idle-rpg/core';
import { useEffect } from 'react';
import { CharacterPanel } from './components/CharacterPanel';
import { CollectionPanel } from './components/CollectionPanel';
import { DungeonPanel } from './components/DungeonPanel';
import { DungeonResultModal } from './components/DungeonResultModal';
import { HuntPanel } from './components/HuntPanel';
import { InventoryPanel } from './components/InventoryPanel';
import { OfflineModal } from './components/OfflineModal';
import { SettingsPanel } from './components/SettingsPanel';
import { Sidebar } from './components/Sidebar';
import { SkillPanel } from './components/SkillPanel';
import { Toasts } from './components/Toasts';
import { TopBar } from './components/TopBar';
import { useGame, type Panel } from './store';

const TICK_MS = 200;
const AUTOSAVE_MS = 5000;

function MainPanel({ panel }: { panel: Panel }) {
  switch (panel) {
    case 'inventory':
      return <InventoryPanel />;
    case 'settings':
      return <SettingsPanel />;
    case 'character':
      return <CharacterPanel />;
    case 'hunt':
    case 'attack':
    case 'hitpoints':
      return <HuntPanel />;
    case 'dungeon':
      return <DungeonPanel />;
    case 'collection':
      return <CollectionPanel />;
    default:
      return <SkillPanel skillId={panel} />;
  }
}

export default function App() {
  const panel = useGame((s) => s.panel);
  const offline = useGame((s) => s.offline);
  const dungeonResult = useGame((s) => s.dungeonResult);
  const activeKey = useGame((s) => s.game.activeActions.map((a) => a.actionId).join(','));

  useEffect(() => {
    const ids = activeKey === '' ? [] : activeKey.split(',');
    document.title =
      ids.length === 0
        ? 'Winterforge — 윈터포지'
        : ids.length === 1
          ? `[${getAction(ids[0]).name}] Winterforge`
          : `[작업 ${ids.length}개] Winterforge`;
  }, [activeKey]);

  useEffect(() => {
    const tickId = setInterval(() => useGame.getState().tick(), TICK_MS);
    const saveId = setInterval(() => useGame.getState().save(), AUTOSAVE_MS);
    const onHide = () => {
      if (document.visibilityState === 'hidden') useGame.getState().save();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onHide);
    return () => {
      clearInterval(tickId);
      clearInterval(saveId);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onHide);
    };
  }, []);

  return (
    <div className="app">
      <TopBar />
      <div className="layout">
        <Sidebar />
        <main className="main">
          <MainPanel panel={panel} />
        </main>
      </div>
      <Toasts />
      {dungeonResult && <DungeonResultModal result={dungeonResult} />}
      {offline && <OfflineModal gains={offline} />}
    </div>
  );
}
