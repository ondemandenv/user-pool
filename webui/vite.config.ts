import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true,
            },
        },
    },
});