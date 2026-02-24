import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'fs';

await build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist-server/index.mjs',
  sourcemap: true,
  // Keep node_modules as external (loaded at runtime)
  packages: 'external',
});

// Copy schema.sql — migrate.ts reads it relative to __dirname,
// which in the bundle resolves to dist-server/
mkdirSync('dist-server', { recursive: true });
cpSync('server/db/schema.sql', 'dist-server/schema.sql');

console.log('Server build complete → dist-server/index.mjs');
