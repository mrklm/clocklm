import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(function (_a) {
    var mode = _a.mode;
    loadEnv(mode, '.', '');
    return {
        base: './',
        plugins: [react()],
    };
});
