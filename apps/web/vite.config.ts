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
});
