import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // 코어는 빌드 산출물이 아니라 TS 소스를 직접 사용한다 (개발 중 즉시 반영)
      '@idle-rpg/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
  build: {
    // Vercel은 저장소 루트에서 빌드하고 산출물을 루트의 dist에서 찾는다.
    // vite의 CWD가 apps/web이라 기본값이면 apps/web/dist가 되어 어긋나므로 루트 dist로 내보낸다.
    outDir: fileURLToPath(new URL('../../dist', import.meta.url)),
    emptyOutDir: true,
  },
});
