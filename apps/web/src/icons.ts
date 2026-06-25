/**
 * 사용자 제공 아이콘 로더.
 *
 * `src/assets/icons/` 폴더에 PNG·SVG·WEBP 파일을 넣기만 하면 빌드 시 Vite가
 * 자동으로 수집한다. 파일명(확장자 제외)이 곧 엔티티 id이며, 해당 id의
 * 이모지 자리에 그림이 대신 렌더된다. (id 규칙은 같은 폴더의 README.md 참고)
 *
 * 예) `barracks.png`  → 건물 barracks
 *     `slime.svg`     → 몬스터 slime
 *     `oak_log.png`   → 아이템 oak_log
 *     `barracks_broken.png` → 병영 파손 상태(선택)
 *
 * 파일이 없으면 iconUrl(id)가 undefined를 반환하고, GameIcon이 이모지로 폴백한다.
 */
const modules = import.meta.glob('./assets/icons/*.{png,svg,webp,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const ICONS: Record<string, string> = {};
for (const [path, url] of Object.entries(modules)) {
  const file = path.split('/').pop();
  if (!file) continue;
  const id = file.replace(/\.[^.]+$/, '');
  ICONS[id] = url;
}

/** 주어진 id에 대응하는 사용자 아이콘 URL. 없으면 undefined. */
export function iconUrl(id: string): string | undefined {
  return ICONS[id];
}

/** 등록된 사용자 아이콘 id 목록 (디버그용). */
export function registeredIconIds(): string[] {
  return Object.keys(ICONS);
}
