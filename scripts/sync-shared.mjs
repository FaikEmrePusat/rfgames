/**
 * Copy built @rfgames/shared into client/server node_modules.
 * Needed on symlink-hostile hosts (file: install fails or goes stale after build).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharedRoot = path.join(root, 'shared');
const distSrc = path.join(sharedRoot, 'dist');
const pkgSrc = path.join(sharedRoot, 'package.json');

if (!fs.existsSync(path.join(distSrc, 'index.js'))) {
  console.error('shared/dist missing — run shared build first');
  process.exit(1);
}

const targets = [
  path.join(root, 'client', 'node_modules', '@rfgames', 'shared'),
  path.join(root, 'server', 'node_modules', '@rfgames', 'shared'),
];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

for (const dest of targets) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.copyFileSync(pkgSrc, path.join(dest, 'package.json'));
  copyDir(distSrc, path.join(dest, 'dist'));
  console.log(`Synced @rfgames/shared → ${path.relative(root, dest)}`);
}
