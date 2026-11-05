import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// DEV_PORT and API_TARGET let a separate test copy run alongside (e.g. for browser testing)
const api = process.env.API_TARGET || 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.DEV_PORT) || 5173,
    strictPort: true,
    // API calls and uploaded photos both come from the backend
    proxy: { '/api': api, '/uploads': api },
  },
});
