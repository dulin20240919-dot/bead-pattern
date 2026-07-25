import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// relative base so dist works on GitHub Pages subpaths and most static hosts
export default defineConfig({
  plugins: [react()],
  base: './',
})
