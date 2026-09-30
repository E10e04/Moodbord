/* =========================================================================
 * sync-client.mjs — Copie le client de l'extension (source unique) vers le
 * renderer de l'application.
 *
 * Source unique du code : ../moodboard-cep/client (partagé avec le panneau
 * CEP et l'aperçu web — les trois cibles exécutent le MÊME moteur).
 * Ce script produit ./renderer (copie autonome sans lien symbolique, pour
 * un empaquetage electron-builder fiable sur Windows comme macOS).
 * ========================================================================= */
import { cpSync, rmSync, existsSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '..', '..', 'moodboard-cep', 'client');
const dest = path.resolve(here, '..', 'renderer');

if (!existsSync(src) || !statSync(src).isDirectory()) {
  console.error('[sync] Source introuvable : ' + src);
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true, dereference: true });

/* Différence intentionnelle avec le client CEP/web : la copie desktop
 * embarque une CSP stricte (Electron le réclame ; les styles inline de
 * l'app imposent 'unsafe-inline' pour style-src, aucun script inline
 * n'existe). Le fichier d'origine (CEP/web) reste inchangé. */
const indexPath = path.join(dest, 'index.html');
let html = readFileSync(indexPath, 'utf8');
if (!/Content-Security-Policy/.test(html)) {
  const csp =
    '<meta http-equiv="Content-Security-Policy" content="' +
    "default-src 'none'; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; " +
    "font-src 'self' data:; " +
    'base-uri &#39;none&#39;; form-action &#39;none&#39;' +
    '">';
  html = html.replace(
    /<meta charset="utf-8">/,
    '<meta charset="utf-8">\n' + csp
  );
  writeFileSync(indexPath, html);
  console.log('[sync] CSP stricte injectée dans renderer/index.html (desktop uniquement)');
}

console.log('[sync] ' + src + ' → ' + dest + ' : OK');
