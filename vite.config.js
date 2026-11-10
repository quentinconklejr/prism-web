import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// Two pages: the national siting map at / and the Illinois rules tracker at
// /illinois. Each builds to its own index.html.
//
// Vite only serves the second page at /illinois/ (with the slash); without it
// the SPA fallback hands back the national map. This mirrors the rewrite in
// vercel.json so `npm run dev` and `npm run preview` behave like production.
const illinoisRoute = () => {
  const rewrite = (req, _res, next) => {
    if (req.url === '/illinois' || req.url?.startsWith('/illinois?')) {
      req.url = req.url.replace('/illinois', '/illinois/index.html')
    }
    next()
  }
  return {
    name: 'illinois-route',
    configureServer: (server) => { server.middlewares.use(rewrite) },
    configurePreviewServer: (server) => { server.middlewares.use(rewrite) },
  }
}

export default defineConfig({
  plugins: [illinoisRoute(), react(), tailwindcss()],
  build: {
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        illinois: fileURLToPath(new URL('./illinois/index.html', import.meta.url)),
      },
    },
  },
})
