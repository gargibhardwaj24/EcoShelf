import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': `http://localhost:${process.env.API_PORT || 3001}` },
    // never watch the backend/database folder: on Windows the watcher locks Postgres' files
    watch: { ignored: ['**/server/**'] },
  },
})
