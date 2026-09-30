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

  /* ----- divers ----- */
  info: () => ipcRenderer.invoke('desktop:info'),
  onMenu: (cb) => ipcRenderer.on('menu-action', (_e, action) => cb(action))
});
