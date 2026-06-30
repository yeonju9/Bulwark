import { CALM_DURATION_MS, INVASION_DURATION_MS, WAVE_PERIOD_MS } from '@idle-rpg/core';
import { useEffect, useRef, useState } from 'react';
import { useGame } from './store';

export interface InvasionPhase {
  /** 침공(실시간 전투) 구간인가 */
  invading: boolean;
  /** 현재 단계가 끝날 때까지 남은 시간(ms) — 침공이면 격퇴까지, 잔잔이면 다음 침공까지 */
  remainingMs: number;
  /** 현재 단계 진행도 0~1 */
  progress: number;
}

/**
 * 주기 진행도(waveProgressMs)로 현재가 잔잔/침공 어느 단계인지 + 남은 시간을 계산한다.
 * 매 틱(200ms) waveProgressMs가 갱신되므로 카운트다운이 부드럽게 움직인다.
 */
export function useInvasionPhase(): InvasionPhase {
  const waveProgressMs = useGame((s) => s.game.village.waveProgressMs);
  const invading = waveProgressMs >= CALM_DURATION_MS;
  if (invading) {
    const into = waveProgressMs - CALM_DURATION_MS;
    return { invading: true, remainingMs: WAVE_PERIOD_MS - waveProgressMs, progress: into / INVASION_DURATION_MS };
  }
  return { invading: false, remainingMs: CALM_DURATION_MS - waveProgressMs, progress: waveProgressMs / CALM_DURATION_MS };
}

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
