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
 * n'existe). v1.7 : connect-src autorise l'API GitHub pour la
 * vérification des mises à jour (le téléchargement des installateurs
 * vit dans le processus principal, hors CSP du renderer).
 * v1.9 : img-src autorise https: pour les aperçus de liens (og:image /
 * favicon chargées en <img> — la capture d'écran, elle, est une data URL).
 * La balise est REMPLACÉE si une version antérieure est déjà présente. */
const indexPath = path.join(dest, 'index.html');
let html = readFileSync(indexPath, 'utf8');
const csp =
  '<meta http-equiv="Content-Security-Policy" content="' +
  "default-src 'none'; " +
  "script-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; " +
  /* v1.14 : l'outil Preview rend le template web dans une iframe
   * locale (assets/preview-template) — frame-src l'y autorise (file:
   * en plus de 'self', les origines file: ne matchent pas toujours
   * 'self' selon les versions de Chromium). */
  "frame-src 'self' file:; " +
  "img-src 'self' data: blob: https:; " +
  "font-src 'self' data:; " +
  'connect-src &#39;self&#39; https://api.github.com https://github.com https://raw.githubusercontent.com https://objects.githubusercontent.com; ' +
  'base-uri &#39;none&#39;; form-action &#39;none&#39;' +
  '">';
if (/<meta[^>]+Content-Security-Policy/.test(html)) {
  html = html.replace(/<meta[^>]+Content-Security-Policy[^>]*>/, csp);
  writeFileSync(indexPath, html);
  console.log('[sync] CSP stricte mise à jour dans renderer/index.html (desktop uniquement)');
} else {
  html = html.replace(/<meta charset="utf-8">/, '<meta charset="utf-8">\n' + csp);
  writeFileSync(indexPath, html);
  console.log('[sync] CSP stricte injectée dans renderer/index.html (desktop uniquement)');
}

console.log('[sync] ' + src + ' → ' + dest + ' : OK');
