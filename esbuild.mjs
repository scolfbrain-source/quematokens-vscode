import * as esbuild from 'esbuild';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWatch = process.argv.includes('--watch');

const buildConfig = {
  entryPoints: [path.join(__dirname, 'src', 'extension.ts')],
  bundle: true,
  outfile: path.join(__dirname, 'out', 'extension.js'),
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'es2022',
  minify: !isWatch,
  sourcemap: !isWatch,
  logLevel: 'info',
};

if (isWatch) {
  const ctx = await esbuild.context(buildConfig);
  await ctx.watch();
  console.log('👀 Watching for changes...');
} else {
  await esbuild.build(buildConfig);
  console.log('✅ Build complete');
}
