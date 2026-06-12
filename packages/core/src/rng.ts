/**
 * 시드 주입 난수 (mulberry32).
 * 코어는 Math.random()을 쓰지 않는다 — 같은 시드면 같은 결과가 나와야
 * 오프라인 정산과 서버 측 재검증이 가능하다.
 */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * "키 + 전역 순번"을 시드로 쓰는 난수 스트림.
 * 같은 키의 n번째 사건은 언제 어떤 틱 패턴으로 정산되어도 같은 결과를 준다
 * → 실시간 틱과 오프라인 일괄 정산의 결과가 완전히 일치한다.
 * 키: 몬스터 id(전리품), 액션 id(채집 부산물) 등.
 */
export function seededRolls(key: string, index: number): () => number {
  return mulberry32(hashString(key) ^ Math.imul(index + 1, 2654435761));
}

/** 몬스터별 전역 처치 순번 시드 전리품 난수 (seededRolls의 별칭) */
export const lootRollsForKill = seededRolls;
