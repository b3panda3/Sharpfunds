import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'
import type { Connect } from 'vite'

// Custom plugin to handle ?import&react syntax (alias to ?react)
const svgImportPlugin = () => ({
  name: 'svg-import-alias',
  resolveId(id: string) {
    // Transform ?import&react to ?react for vite-plugin-svgr
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
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' }));
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
      // Support named ReactComponent export (for ?react syntax)
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
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fflycxbmbibuldwijkvs.supabase.co'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmbHljeGJtYmlidWxkd2lqa3ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTA3MTUsImV4cCI6MjEwMTU4NjcxNX0.tPF_kby-cgNFqGDIMgEpTYt7ptpxZsLhO2yqZ8kB-4s'),
  },
  server: {
    allowedHosts: true as const,
    hmr: false,
  },
}))
