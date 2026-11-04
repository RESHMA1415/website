import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    // API calls and uploaded photos both come from the backend
    proxy: { '/api': 'http://localhost:5000', '/uploads': 'http://localhost:5000' },
  },
});
