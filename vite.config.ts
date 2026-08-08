import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'
import type { Connect } from 'vite'

// Custom plugin to handle ?import&react syntax (alias to ?react)
const svgImportPlugin = () => ({
  name: 'svg-import-alias',
  resolveId(id: string) {
    if (id.includes('?import&react')) {
      return id.replace('?import&react', '?react');
    }
    return null;
  },
});

// Health check endpoint plugin
const healthPlugin = () => ({
  name: 'health-check',
  configureServer(server: { middlewares: { use: (path: string, handler: Connect.NextHandleFunction) => void } }) {
    server.middlewares.use('/health', (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString(), version: '1.1.0' }));
    });
  },
});

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [
    react(),
    tailwindcss(),
    svgImportPlugin(),
    healthPlugin(),
    svgr({
      svgrOptions: {
        exportType: 'named',
        namedExport: 'ReactComponent',
        ref: true,
        svgo: false,
        titleProp: true,
      },
      include: '**/*.svg?react',
    }),
  ],
  server: {
    allowedHosts: true as const,
    hmr: false,
  },
}))
