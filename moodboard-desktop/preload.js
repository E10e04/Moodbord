/* =========================================================================
 * preload.js — Pont sécurisé renderer ↔ processus principal.
 *
 * contextBridge expose window.mbDesktop, TOUT le reste reste isolé
 * (contextIsolation: true, nodeIntegration: false).
 *
 * Conventions :
 *   - fs synchrones (sendSync) : parité stricte avec cep.fs — les mêmes
 *     réponses { err, data } (0 = OK), pour que storage.js garde son
 *     architecture synchrone entre CEP et application ;
 *   - dialogues natifs : asynchrones (invoke) — interaction utilisateur.
 * ========================================================================= */
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mbDesktop', {
  platform: process.platform,

  /* ----- fs synchrones (parité cep.fs : { err, data }) ----- */
  dataDir: () => ipcRenderer.sendSync('desktop:dataDir'),
  read: (p, enc) => ipcRenderer.sendSync('fs:read', p, enc),
  write: (p, data, enc) => ipcRenderer.sendSync('fs:write', p, data, enc),
  mkdir: (p) => ipcRenderer.sendSync('fs:mkdir', p),
  unlink: (p) => ipcRenderer.sendSync('fs:unlink', p),

  /* ----- dialogues natifs (asynchrones) ----- */
  saveDialog: (opts) => ipcRenderer.invoke('dialog:save', opts || {}),
  openDialog: () => ipcRenderer.invoke('dialog:open'),

  /* ----- v1.4 : révéler dans le Finder / l'Explorateur ----- */
  reveal: (p) => ipcRenderer.invoke('shell:reveal', p),

  /* ----- v1.7 : Préférences & mises à jour ----- */
  /* Choix d'un dossier (Préférences — fichiers temporaires/autosaves). */
  pickDir: (opts) => ipcRenderer.invoke('dialog:pickDir', opts || {}),
  /* Téléchargement d'un installateur par le processus principal
   * (streaming disque) ; progression par événements 'update-progress'. */
  downloadUpdate: (url, dir) => ipcRenderer.invoke('update:download', url, dir),
  onUpdateProgress: (cb) => ipcRenderer.on('update-progress', (_e, p) => cb(p)),
  /* Lancer l'installateur téléchargé / ouvrir une page / quitter. */
  launch: (p) => ipcRenderer.invoke('shell:launch', p),
  openUrl: (url) => ipcRenderer.invoke('shell:openUrl', url),
  quit: () => ipcRenderer.send('app:quit'),

  /* ----- divers ----- */
  info: () => ipcRenderer.invoke('desktop:info'),
  onMenu: (cb) => ipcRenderer.on('menu-action', (_e, action) => cb(action))
});
