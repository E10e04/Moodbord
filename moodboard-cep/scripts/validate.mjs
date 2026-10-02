#!/usr/bin/env node
/* =========================================================================
 * validate.mjs — Vérification statique de l'extension :
 *   1. manifest.xml bien formé + champs requis + cohérence des chemins
 *   2. syntaxe de chaque fichier JS (node --check)
 *   3. ressources référencées par index.html présentes
 *   4. absence de références réseau externes (CDN interdits : offline CEP)
 * Code sortie non nul en cas d'échec.
 * ========================================================================= */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const client = join(root, 'client');
let failures = 0;
const fail = (msg) => { console.error('  ✗ ' + msg); failures++; };
const ok = (msg) => console.log('  ✓ ' + msg);

console.log('== Moodboard CEP — validation ==\n');

/* ---------------------------------------------------------- manifest */

console.log('[manifest.xml]');
const manifestPath = join(root, 'CSXS', 'manifest.xml');
if (!existsSync(manifestPath)) {
  fail('CSXS/manifest.xml introuvable');
} else {
  const xml = readFileSync(manifestPath, 'utf8');
  const checks = [
    ['ExtensionManifest racine', /<ExtensionManifest[\s>]/.test(xml)],
    ['Host ILST (Illustrator)', /<Host Name="ILST"/.test(xml)],
    ['Version hôte [25.0,99.9]', /Version="\[25\.0,99\.9\]"/.test(xml)],
    ['RequiredRuntime CSXS', /<RequiredRuntime Name="CSXS"/.test(xml)],
    ['Extension (Panel)', /<Type>Panel<\/Type>/.test(xml)],
  ];
  const mainPath = xml.match(/<MainPath>([^<]+)<\/MainPath>/);
  checks.push(['MainPath défini', !!mainPath]);
  if (mainPath) {
    const p = join(root, mainPath[1].replace('./', ''));
    checks.push(['MainPath existe (' + mainPath[1] + ')', existsSync(p)]);
  }
  const scriptPath = xml.match(/<ScriptPath>([^<]+)<\/ScriptPath>/);
  checks.push(['ScriptPath défini', !!scriptPath]);
  if (scriptPath) {
    const p = join(root, scriptPath[1].replace('./', ''));
    checks.push(['ScriptPath existe (' + scriptPath[1] + ')', existsSync(p)]);
  }
  checks.forEach(([label, passed]) => {
    if (passed) ok(label);
    else fail(label);
  });
}
console.log('');

/* -------------------------------------------------------- JS syntax */

console.log('[syntaxe JS] (node --check)');
function walkJs(dir, acc) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkJs(p, acc);
    else if (p.endsWith('.js')) acc.push(p);
  }
  return acc;
}
const jsFiles = walkJs(client, []);
for (const f of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    ok(f.replace(root + '/', ''));
  } catch (err) {
    fail(f.replace(root + '/', '') + ' — ' + String(err.stderr || err.message).split('\n')[0]);
  }
}
console.log('');

/* ----------------------------------------------------- index.html refs */

console.log('[index.html]');
const htmlPath = join(client, 'index.html');
const rawHtml = readFileSync(htmlPath, 'utf8');
// le scan ne porte que sur le HTML statique (les <script> génèrent des refs dynamiques,
// ex. <base href="/moodboard/"> pour la preview web)
const html = rawHtml.replace(/<script[\s\S]*?<\/script>/g, '');
const refs = [...html.matchAll(/(?:src|href)="(?!https?:|#|data:|\/moodboard\/)([^"]+)"/g)].map((m) => m[1]);
if (!refs.length) fail('aucune ressource locale référencée (suspect)');
for (const ref of refs) {
  const p = join(client, ref);
  if (existsSync(p)) ok(ref);
  else fail('référence cassée : ' + ref);
}
const net = html.match(/(?:src|href)="https?:\/\/[^"]+"/g);
if (net) fail('références réseau externes interdites : ' + net.join(', '));
else ok('aucune dépendance réseau externe (offline OK)');
console.log('');

/* ------------------------------------------------------------ demo */

console.log('[assets démo]');
const demoDir = join(client, 'assets', 'demo');
const demoFiles = existsSync(demoDir) ? readdirSync(demoDir).filter((f) => f.startsWith('demo-')) : [];
if (demoFiles.length >= 5) ok(demoFiles.length + ' images de démonstration');
else fail('images de démonstration manquantes (' + demoFiles.length + '/5) — lancez la génération');
console.log('');

/* ------------------------------------------------------------ JSX */

console.log('[host.script.jsx]');
const jsxPath = join(client, 'js', 'adobe', 'host.script.jsx');
if (!existsSync(jsxPath)) fail('host.script.jsx introuvable');
else {
  const jsx = readFileSync(jsxPath, 'utf8');
  ['mbPing', 'mbGetDocInfo', 'mbGetSwatches', 'mbAddSwatches', 'mbPlaceFile'].forEach((fn) => {
    (new RegExp('function ' + fn + '\\(').test(jsx) ? ok('fonction ' + fn) : fail('fonction ' + fn + ' absente'));
  });
}
console.log('');

if (failures) {
  console.error('ÉCHEC : ' + failures + ' problème(s).');
  process.exit(1);
}
console.log('VALIDATION OK — ' + jsFiles.length + ' fichiers JS, 0 erreur.');
