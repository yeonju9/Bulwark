import { useEffect, useRef, useState } from 'react';
import { useGame } from './store';

/**
 * 웨이브를 막아낼 때마다(= village.wavesProcessed 증가) 잠깐 true가 되는 펄스.
 * 배너 번쩍임·HP 바 흔들림 같은 1회성 연출의 트리거로 쓴다.
 * 마운트 시점 값으로 prev를 초기화하므로 오프라인 복귀로 카운트가 점프해도 헛발동하지 않는다.
 */
export function useWavePulse(durationMs = 700): boolean {
  const wavesProcessed = useGame((s) => s.game.village.wavesProcessed);
  const prev = useRef(wavesProcessed);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (wavesProcessed > prev.current) {
      prev.current = wavesProcessed;
      setPulse(true);
      const id = setTimeout(() => setPulse(false), durationMs);
      return () => clearTimeout(id);
    }
    prev.current = wavesProcessed; // 리셋(새 게임) 등 동일·감소는 동기화만
  }, [wavesProcessed, durationMs]);

  return pulse;
}

export interface Invasion {
  /** 애니메이션 리마운트용 단조 증가 키 (매 침공마다 +1) */
  key: number;
  /** 이번 침공으로 마을이 뚫렸는가(농성 진입) — 돌파 연출로 분기 */
  breached: boolean;
}

/**
 * 웨이브가 발동할 때마다 잠깐 동안 활성화되는 침공 인스턴스. 몬스터 돌격 애니메이션 트리거.
 * 막아낸 웨이브(wavesProcessed 증가)뿐 아니라 첫 웨이브에 바로 함락(농성 진입)되는 경우도
 * 잡는다 — 후자는 wavesProcessed가 안 오르므로 underSiege 전환(false→true)으로 감지.
 */
export function useWaveInvasion(durationMs = 1700): Invasion | null {
  const wavesProcessed = useGame((s) => s.game.village.wavesProcessed);
  const underSiege = useGame((s) => s.game.village.underSiege);
  const prevW = useRef(wavesProcessed);
  const prevS = useRef(underSiege);
  const seq = useRef(0);
  const [invasion, setInvasion] = useState<Invasion | null>(null);

  useEffect(() => {
    const wonWave = wavesProcessed > prevW.current;
    const justBreached = underSiege && !prevS.current;
    prevW.current = wavesProcessed;
    prevS.current = underSiege;
    if (wonWave || justBreached) {
      seq.current += 1;
      setInvasion({ key: seq.current, breached: underSiege });
      const id = setTimeout(() => setInvasion(null), durationMs);
      return () => clearTimeout(id);
    }
  }, [wavesProcessed, underSiege, durationMs]);

  return invasion;
}
