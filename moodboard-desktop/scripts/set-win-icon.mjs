/* =========================================================================
 * set-win-icon.mjs — Injecte l'icône + les informations de version dans
 * l'exécutable Windows (Moodboard.exe) SANS wine.
 *
 * resedit édite les ressources PE (icônes, VersionInfo) en pur JavaScript
 * — c'est ce que rcedit+wine fait habituellement sous Linux chez
 * electron-builder. À exécuter après un build `--win` en mode
 * signAndEditExecutable:false.
 *
 * Usage : node scripts/set-win-icon.mjs [exe] [ico]
 * ========================================================================= */
import { NtExecutable, NtExecutableResource, Data, Resource } from 'resedit';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const here = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '..');
const exePath = process.argv[2] || path.join(root, 'dist', 'win-unpacked', 'Moodboard.exe');
const icoPath = process.argv[3] || path.join(root, 'build', 'icon-multi.ico');

if (!existsSync(exePath)) {
  console.error('[win-icon] exe introuvable : ' + exePath);
  process.exit(1);
}
if (!existsSync(icoPath)) {
  console.error('[win-icon] ico introuvable : ' + icoPath);
  process.exit(1);
}

const exe = NtExecutable.from(readFileSync(exePath));
const res = NtExecutableResource.from(exe);

/* --- icône : remplace chaque groupe d'icônes par le contenu du .ico ---
 * IconFile.icons = wrappers {width, height, …, data: IconItem|RawIconItem} ;
 * replaceIconsForResource attend les instances IconItem/RawIconItem. */
const iconFile = Data.IconFile.from(readFileSync(icoPath));
const icons = iconFile.icons.map((i) => i.data);
const groups = Resource.IconGroupEntry.fromEntries(res.entries);
if (!groups.length) {
  console.error('[win-icon] aucun groupe d’icônes trouvé dans l’exe');
  process.exit(1);
}
for (const g of groups) {
  Resource.IconGroupEntry.replaceIconsForResource(res.entries, g.id, g.lang, icons);
}

/* --- VersionInfo : ce que le Gestionnaire des tâches / propriétés montrent --- */
const viList = Resource.VersionInfo.fromEntries(res.entries);
if (viList.length) {
  const vi = viList[0];
  vi.setFileVersion(1, 1, 0, 0);
  vi.setProductVersion(1, 1, 0, 0);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    ProductName: 'Moodboard',
    FileDescription: 'Moodboard — table de travail spatiale pour designers',
    FileVersion: '1.1.0',
    ProductVersion: '1.1.0',
    CompanyName: 'Moodboard',
    LegalCopyright: 'Copyright © Moodboard',
    OriginalFilename: 'Moodboard.exe'
  });
  vi.outputToResourceEntries(res.entries);
}

res.outputResource(exe);
writeFileSync(exePath, Buffer.from(exe.generate()));
console.log(
  '[win-icon] ' + path.basename(exePath) + ' mis à jour : ' +
  groups.length + ' groupe(s) d’icônes remplacé(s) (' + icons.length + ' tailles), ' +
  'VersionInfo 1.1.0 — sans wine.'
);
