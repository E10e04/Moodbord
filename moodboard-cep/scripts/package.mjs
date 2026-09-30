#!/usr/bin/env node
/* =========================================================================
 * package.mjs — Construit une archive ZIP de l'extension (installation
 * manuelle dans le dossier des extensions CEP).
 * NOTE : un .zxp signé ( ZXPSignCmd ) n'est pas produisible ici ;
 * le zip suffit pour une installation locale / débogage.
 * ========================================================================= */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const manifest = readFileSync(join(root, 'CSXS', 'manifest.xml'), 'utf8');
const version = (manifest.match(/ExtensionBundleVersion="([^"]+)"/) || [])[1] || '1.0.0';
const out = join(dist, 'moodboard-cep-' + version + '.zip');

if (existsSync(out)) rmSync(out);
mkdirSync(dist, { recursive: true });

execFileSync(
  'zip',
  ['-r', '-q', out, 'CSXS', '.debug', 'client', 'README.md', 'package.json'],
  { cwd: root }
);

console.log('Archive : ' + out);
console.log('\nInstallation manuelle :');
console.log('  macOS   : ~/Library/Application Support/Adobe/CEP/extensions/moodboard-cep/');
console.log('  Windows : %APPDATA%\\Adobe\\CEP\\extensions\\moodboard-cep\\');
console.log('  (dézipper le contenu à la racine, CSXS/ visible)');
console.log('  + activer PlayerDebugMode (voir README) puis relancer Illustrator.');
