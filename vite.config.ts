import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isTauriBuild = env.TAURI_ENV_PLATFORM != null;
  const isProductionBuild = mode === 'production';

  return {
    // Relative asset URLs make the static web build portable across GitHub Pages,
    // local previews and manual hosting under a subdirectory.
    base: isProductionBuild || isTauriBuild ? './' : '/',
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          vuMeter: resolve(__dirname, 'vu-meter.html'),
        },
      },
    },
  };
});
