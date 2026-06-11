import { useRef, useState } from 'react';
import { exportSave, importSave } from '../save';
import { useGame } from '../store';

export function SettingsPanel() {
  const game = useGame((s) => s.game);
  const importGame = useGame((s) => s.importGame);
  const resetGame = useGame((s) => s.resetGame);
  const pushToast = useGame((s) => s.pushToast);

  const [importText, setImportText] = useState('');
  const [resetArmed, setResetArmed] = useState(false);
  const disarmTimer = useRef<number | undefined>(undefined);

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportSave(game));
      pushToast('📋 세이브를 클립보드에 복사했습니다');
    } catch {
      pushToast('❌ 클립보드 복사에 실패했습니다 — 파일 저장을 이용하세요');
    }
  };

  const downloadExport = () => {
    const blob = new Blob([exportSave(game)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `idle-rpg-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = () => {
    const state = importSave(importText);
    if (state) {
      importGame(state);
      setImportText('');
    } else {
      pushToast('❌ 세이브 형식이 올바르지 않습니다');
    }
  };

  const doReset = () => {
    if (!resetArmed) {
      setResetArmed(true);
      window.clearTimeout(disarmTimer.current);
      disarmTimer.current = window.setTimeout(() => setResetArmed(false), 5000);
      return;
    }
    window.clearTimeout(disarmTimer.current);
    setResetArmed(false);
    resetGame();
  };

  return (
    <div className="skill-panel">
      <div className="skill-header">
        <h2>⚙️ 설정</h2>
      </div>

      <section className="settings-section">
        <h3>세이브 내보내기</h3>
        <p className="settings-desc">서버 저장이 도입되기 전까지는 주기적으로 백업해두세요.</p>
        <div className="settings-row">
          <button className="btn btn-inline" onClick={copyExport}>클립보드에 복사</button>
          <button className="btn btn-inline" onClick={downloadExport}>파일로 저장</button>
        </div>
      </section>

      <section className="settings-section">
        <h3>세이브 가져오기</h3>
        <p className="settings-desc">내보낸 세이브 텍스트를 붙여넣으세요. 현재 진행을 덮어씁니다.</p>
        <textarea
          className="settings-textarea"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder='{"version":2,...}'
          rows={4}
        />
        <div className="settings-row">
          <button className="btn btn-inline" disabled={importText.trim() === ''} onClick={doImport}>
            가져오기
          </button>
        </div>
      </section>

      <section className="settings-section settings-danger">
        <h3>진행 초기화</h3>
        <p className="settings-desc">모든 진행이 삭제됩니다. 되돌릴 수 없습니다.</p>
        <div className="settings-row">
          <button className={`btn btn-inline ${resetArmed ? 'btn-danger' : ''}`} onClick={doReset}>
            {resetArmed ? '⚠️ 한 번 더 누르면 초기화됩니다' : '진행 초기화'}
          </button>
        </div>
      </section>
    </div>
  );
}
