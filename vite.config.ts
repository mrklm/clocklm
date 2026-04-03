import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isTauriBuild = env.TAURI_ENV_PLATFORM != null;
  const isGithubPagesBuild = mode === 'production';

  return {
    base: isTauriBuild ? './' : isGithubPagesBuild ? '/clocklm/' : '/',
    plugins: [react()],
  };
});
