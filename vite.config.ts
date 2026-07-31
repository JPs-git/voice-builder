/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    projects: [
      {
        test: {
          name: 'dsp',
          environment: 'node',
          globals: true,
          include: ['js/__tests__/*.test.js'],
        },
      },
      {
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          include: ['src/__tests__/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
})
