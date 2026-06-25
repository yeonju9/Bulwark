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
