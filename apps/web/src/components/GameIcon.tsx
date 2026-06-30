import type { CSSProperties } from 'react';
import { iconUrl } from '../icons';

/**
 * 엔티티 아이콘. `src/assets/icons/<id>.(png|svg|webp)` 파일이 있으면 그 그림을,
 * 없으면 이모지를 렌더한다. 게임 어디서든 `{def.icon}` 대신 쓰면 사용자가
 * 직접 만든 아트로 점진 교체할 수 있다.
 *
 * - `size`(px)를 주면 그 크기의 타일 아이콘(맵 건물·인벤토리 칸 등).
 * - `size`를 생략하면 **주변 글자 크기를 따라가는 인라인 아이콘**(칩·헤더·목록 줄 등).
 *   인라인 모드의 이모지 폴백은 기존 `{emoji}` 텍스트와 보이는 크기가 동일하다.
 */
export function GameIcon({
  id,
  emoji,
  size,
  className,
  alt,
}: {
  id: string;
  emoji: string;
  /** 생략 시 인라인(폰트 크기 상속) */
  size?: number;
  className?: string;
  alt?: string;
}) {
  const url = iconUrl(id);
  const inline = size === undefined;
  if (url) {
    const style: CSSProperties = inline
      ? { height: '1em', width: 'auto' }
      : { width: size, height: size };
    return (
      <img
        src={url}
        alt={alt ?? ''}
        className={`game-icon ${className ?? ''}`}
        style={style}
        draggable={false}
      />
    );
  }
  if (inline) {
    // 폰트 크기를 상속해 기존 이모지 텍스트와 동일하게 보이도록
    return (
      <span className={className} aria-label={alt}>
        {emoji}
      </span>
    );
  }
  return (
    <span className={className} style={{ fontSize: size * 0.92, lineHeight: 1 }} aria-label={alt}>
      {emoji}
    </span>
  );
}
