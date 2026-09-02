// One-shot bundle of the editor libraries → docs/vendor/editor.bundle.js (ESM, minified).
// Re-run only when upgrading the libraries: npm install && npm run vendor
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const versions = Object.entries(pkg.devDependencies).filter(([k]) => k !== 'esbuild');
await build({
  entryPoints: [new URL('./editor-entry.js', import.meta.url).pathname],
  bundle: true, minify: true, format: 'esm', target: ['es2020'],
  outfile: new URL('../docs/vendor/editor.bundle.js', import.meta.url).pathname,
  banner: { js: `/* editor bundle: ${versions.map(([k, v]) => k + '@' + v).join(', ')} — MIT-licensed libraries, see THIRD_PARTY_NOTICES.md */` },
  legalComments: 'none',
});
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)));
const resolved = versions.map(([k]) => `${k}@${(lock.packages['node_modules/' + k] || {}).version || '?'}`);
writeFileSync(new URL('../docs/vendor/EDITOR_VERSIONS.md', import.meta.url),
  '# Editor bundle\n\nBuilt by scripts/vendor.mjs (esbuild) from:\n\n' + resolved.map((r) => '- ' + r).join('\n') + '\n');
console.log('wrote docs/vendor/editor.bundle.js from', resolved.join(', '));
