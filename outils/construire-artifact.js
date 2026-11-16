// Assemble l'app en une seule page (sans fichiers séparés) pour l'héberger sur claude.ai.
// Usage : node outils/construire-artifact.js  → dist/potager.html
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const lire = f => fs.readFileSync(path.join(R, f), 'utf8');
const html = lire('index.html');
const corps = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
const scripts = [...corps.matchAll(/<script src="([^"?]+)(?:\?[^"]*)?"><\/script>/g)].map(m => m[1]);
const sansScripts = corps.replace(/\s*<!--[^>]*-->/g, '').replace(/\s*<script src="[^"]+"><\/script>/g, '').replace(/\s*<noscript>.*?<\/noscript>/, '');
const sortie = '<title>Mon potager</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>\n' + lire('css/style.css') + '</style>\n' +
  sansScripts.trim() + '\n' + scripts.map(s => '<script>\n' + lire(s).replace(/<\/script/gi, '<\\/script') + '\n</script>').join('\n') + '\n';
fs.mkdirSync(path.join(R, 'dist'), { recursive: true });
fs.writeFileSync(path.join(R, 'dist/potager.html'), sortie);
console.log('dist/potager.html', Math.round(sortie.length / 1024) + ' Ko, ' + scripts.length + ' scripts intégrés');
