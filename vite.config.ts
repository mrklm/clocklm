import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isTauriBuild = env.TAURI_ENV_PLATFORM != null;

  return {
    base: isTauriBuild ? './' : '/clocklm/',
    plugins: [react()],
  };
});
