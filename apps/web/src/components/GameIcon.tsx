import { iconUrl } from '../icons';

/**
 * 엔티티 아이콘. `src/assets/icons/<id>.(png|svg|webp)` 파일이 있으면 그 그림을,
 * 없으면 이모지를 렌더한다. 게임 어디서든 `{def.icon}` 대신 쓰면 사용자가
 * 직접 만든 아트로 점진 교체할 수 있다.
 */
export function GameIcon({
  id,
  emoji,
  size = 24,
  className,
  alt,
}: {
  id: string;
  emoji: string;
  size?: number;
  className?: string;
  alt?: string;
}) {
  const url = iconUrl(id);
  if (url) {
    return (
      <img
        src={url}
        alt={alt ?? ''}
        className={`game-icon ${className ?? ''}`}
        style={{ width: size, height: size }}
        draggable={false}
      />
    );
  }
  return (
    <span className={className} style={{ fontSize: size * 0.92, lineHeight: 1 }} aria-label={alt}>
      {emoji}
    </span>
  );
}
