// Builds one of the two websites (pre-rendered, app.json web.output "static") and,
// with --deploy, publishes it to EAS Hosting:
//   node scripts/web-build.mjs customer [--deploy]   → nuva.expo.app        (eas deploy --prod)
//   node scripts/web-build.mjs admin [--deploy]      → nuva--admin.expo.app (eas deploy --alias admin)
// Both builds share public/, so the admin build gets its own robots.txt (Disallow: /)
// and no sitemap. 404.html is a copy of the not-found page.
// --clear is always passed: Metro's cache ignores EXPO_PUBLIC_SITE changes.
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const site = process.argv[2];
const deploy = process.argv.includes('--deploy');
if (site !== 'customer' && site !== 'admin') {
  console.error('Usage: node scripts/web-build.mjs customer|admin [--deploy]');
  process.exit(1);
}

// --out <dir> exports somewhere else (e.g. to inspect a build without touching dist/).
const outFlag = process.argv.indexOf('--out');
const OUT = outFlag > 0 && process.argv[outFlag + 1] ? process.argv[outFlag + 1] : 'dist';
const run = (cmd, env = {}) => execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } });

run(`npx expo export -p web --clear --output-dir "${OUT}"`, { EXPO_PUBLIC_SITE: site === 'admin' ? 'admin' : '' });

if (existsSync(join(OUT, '+not-found.html'))) copyFileSync(join(OUT, '+not-found.html'), join(OUT, '404.html'));
if (site === 'admin') {
  // The console is private: nothing on the admin host is crawled or listed.
  writeFileSync(join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  rmSync(join(OUT, 'sitemap.xml'), { force: true });
}
console.log(`\n${site} site exported to ${OUT}/`);

if (deploy) {
  run(`npx eas-cli@latest deploy ${site === 'admin' ? '--alias admin' : '--prod'} --export-dir "${OUT}"`, { EAS_NO_VCS: '1' });
}
