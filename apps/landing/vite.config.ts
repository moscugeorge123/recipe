import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const base = process.env.LANDING_BASE?.trim() || '/';

export default defineConfig({
  base,
  plugins: [react()],
});
