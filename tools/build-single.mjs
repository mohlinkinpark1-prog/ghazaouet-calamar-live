/* Génère ghazaouet-calamar-live.html — version mono-fichier (CSS/JS/icône inline) */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = p => readFileSync(join(root, p), 'utf8');

const css = read('assets/css/style.css');
const engine = read('assets/js/engine.js');
const astro = read('assets/js/astro.js');
const app = read('assets/js/app.js');
const iconSvg = read('assets/icon.svg');
const iconDataUri = 'data:image/svg+xml;utf8,' + encodeURIComponent(iconSvg)
  .replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');

let html = read('index.html');

// CSS inline
html = html.replace(/<link rel="stylesheet" href="assets\/css\/style\.css[^"]*">/, () => `<style>\n${css}\n</style>`);
// JS inline (ordre : engine, astro puis app)
html = html.replace(/<script src="assets\/js\/engine\.js[^"]*"><\/script>/, () => `<script>\n${engine}\n</script>`);
html = html.replace(/<script src="assets\/js\/astro\.js[^"]*"><\/script>/, () => `<script>\n${astro}\n</script>`);
html = html.replace(/<script src="assets\/js\/app\.js[^"]*"><\/script>/, () => `<script>\n${app}\n</script>`);
// Icône en data URI partout
html = html.replaceAll('src="assets/icon.svg"', `src="${iconDataUri}"`);
html = html.replace('<link rel="icon" href="assets/icon.svg" type="image/svg+xml">',
                    () => `<link rel="icon" href="${iconDataUri}" type="image/svg+xml">`);
// Manifest non embarquable simplement → on le retire pour la version mono-fichier
html = html.replace('<link rel="manifest" href="manifest.webmanifest">\n', '');

const out = join(root, 'ghazaouet-calamar-live.html');
writeFileSync(out, html);
console.log('Écrit :', out, '—', Math.round(html.length / 1024), 'Ko');
