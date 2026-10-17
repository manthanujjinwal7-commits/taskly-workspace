import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // Agar tailwind v4 hai ya fir standard setup

export default defineConfig({
  plugins: [react()],
})