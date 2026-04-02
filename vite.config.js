import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, '.', '');
    var isTauriBuild = env.TAURI_ENV_PLATFORM != null;
    return {
        base: isTauriBuild ? './' : '/clocklm/',
        plugins: [react()],
    };
});
