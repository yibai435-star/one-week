const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const directory = __dirname;
const english = JSON.parse(fs.readFileSync(path.join(directory, 'locales/en.json'), 'utf8'));
fs.writeFileSync(path.join(directory, 'locales/en.js'), `window.ONE_WEEK_EN = ${JSON.stringify(english)};\n`);
esbuild.buildSync({
  absWorkingDir: directory,
  entryPoints: ['plugin.js'],
  outfile: 'main.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'es2020',
  external: ['obsidian'],
  logLevel: 'info'
});
fs.mkdirSync(path.join(directory, 'dist'), { recursive: true });
fs.copyFileSync(path.join(directory, 'main.js'), path.join(directory, 'dist/main.js'));
for (const filename of ['styles.css', 'manifest.json', 'README.md']) fs.copyFileSync(path.join(directory, filename), path.join(directory, 'dist', filename));
