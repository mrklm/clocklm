import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, '.', '');
    var isTauriBuild = env.TAURI_ENV_PLATFORM != null;
    var isProductionBuild = mode === 'production';
    return {
        // Relative asset URLs make the static web build portable across GitHub Pages,
        // local previews and manual hosting under a subdirectory.
        base: isProductionBuild || isTauriBuild ? './' : '/',
        plugins: [react()],
        build: {
            rollupOptions: {
                input: {
                    main: 'index.html',
                    vuMeter: 'vu-meter.html',
                },
            },
        },
    };
});
