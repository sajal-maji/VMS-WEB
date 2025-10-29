import { defineConfig } from 'vite';
import { angular } from '@angular/build/plugin-vite';

export default defineConfig({
  plugins: [angular()],
  server: {
    port: 4200,
    proxy: {
      '/api': {
        target: 'https://172.16.2.172:7443/api',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''), // 🔥 removes "/api"
      },
    },
  },
});
