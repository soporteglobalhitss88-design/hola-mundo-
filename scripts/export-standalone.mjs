import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
const result = await build({
  entryPoints: ['src/main.jsx'], bundle: true, minify: true, write: false,
  outfile: 'orbita-express.js', format: 'iife', platform: 'browser', target: ['es2020'],
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.woff2': 'dataurl', '.woff': 'dataurl' },
});
const js = result.outputFiles.find(f => f.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script');
const css = result.outputFiles.find(f => f.path.endsWith('.css')).text.replace(/<\/style/gi, '<\\/style');
const favicon = await readFile('public/favicon.svg', 'utf8');
const html = `<!doctype html>\n<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#123f39"><title>Órbita Express · Dashboard gerencial</title><link rel="icon" href="data:image/svg+xml,${encodeURIComponent(favicon)}"><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`;
await writeFile('orbita-express.html', html);
console.log('HTML autónomo generado: orbita-express.html (' + (Buffer.byteLength(html)/1024/1024).toFixed(2) + ' MB)');
