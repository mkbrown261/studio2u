import { defineConfig } from 'vite'
import { resolve } from 'node:path'
export default defineConfig({
  publicDir:false,
  oxc:{jsx:{runtime:'automatic',importSource:'react'}},
  build:{
    outDir:'public/label-world/app',emptyOutDir:true,target:'es2022',
    rolldownOptions:{input:resolve('src/client/label-world/main.tsx'),output:{entryFileNames:'main.js',chunkFileNames:'chunks/[name]-[hash].js',assetFileNames:'[name]-[hash][extname]'}}
  }
})
