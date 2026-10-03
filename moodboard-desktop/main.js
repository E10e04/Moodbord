/* =========================================================================
 * main.js — Processus principal de l'application Moodboard (Electron).
 *
 * Rôle :
 *   - fenêtre applicative (macOS : barre intégrée hiddenInset + traffic
 *     lights ; Windows : barre de titre overlay sombre native) ;
 *   - menu natif minimal (les raccourcis clavier restent gérés par la
 *     page — aucun accélérateur dupliqué) ;
 *   - couche fichiers IPC synchrones (parité cep.fs : { err, data }) et
 *     dialogues natifs asynchrones pour le renderer ;
 *   - garde de fermeture : confirmation native si modifications non
 *     enregistrées (l'autosave 800 ms les conservera de toute façon) ;
 *   - mode vérification E2E (MB_E2E=1) : assertions réelles headless.
 *
 * Dossier de données : app.getPath('userData')
 *   macOS   : ~/Library/Application Support/Moodboard
 *   Windows  : %APPDATA%\Moodboard
 *   → LE MÊME dossier que l'extension CEP côté Adobe (USER_DATA/Moodboard) :
 *     les projets/autosaves passent de l'un à l'autre sur la même machine.
 * ========================================================================= */
'use strict';

const { app, BrowserWindow, Menu, ipcMain, dialog, shell, session, WebContentsView } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

/* Chargement depuis file:// avec CSP stricte : les sous-ressources
 * relatives (js/, css/, assets/) doivent rester autorisées. */
app.commandLine.appendSwitch('allow-file-access-from-files');

const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';
const E2E = process.env.MB_E2E === '1';

let win = null;
const consoleErrors = []; // collectées dès le chargement (mode E2E)

/* ----------------------------------------------------------- mode E2E */

if (E2E) {
  // Dossier de données jetable : premier lancement déterministe (démo).
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'moodboard-e2e-'));
  app.setPath('userData', tmp);
}

/* ----------------------------------------------------- verrou instance */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

/* ------------------------------------------------------------- fenêtre */

function createWindow() {
  const opts = {
    width: 1480,
    height: 940,
    minWidth: 980,
    minHeight: 600,
    backgroundColor: '#1E1E1E',
    show: false,
    title: 'Moodboard',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  };

  if (IS_MAC) {
    // Traffic lights intégrés à la barre supérieure de l'app (zone de
    // déplacement via CSS -webkit-app-region, cf. panel.css).
    opts.titleBarStyle = 'hiddenInset';
  } else if (IS_WIN) {
    // Barre de titre overlay native sombre (min/max/fermer) — le contenu
    // de la fenêtre démarre sous cette barre, aucun CSS requis.
    opts.frame = false;
    opts.titleBarOverlay = {
      color: '#232323',
      symbolColor: '#CFCFCF',
      height: 34
    };
  }
  // Linux : barre de titre standard (overlay non garanti hors Windows).

  win = new BrowserWindow(opts);

  if (E2E) {
    win.webContents.on('console-message', (_e, level, message) => {
      if (level >= 2) consoleErrors.push(String(message).slice(0, 300));
    });
  }

  win.once('ready-to-show', () => {
    win.show();
    if (E2E) runE2e();
  });

  win.on('close', (e) => {
    if (win.__forceClose || win.isDestroyed()) return;
    // Garde de fermeture : l'état de sauvegarde est lu DANS la page.
    e.preventDefault();
    const js = '(window.MB && MB.store) ? MB.store.s().ui.saveState : "saved"';
    Promise.resolve(win.webContents.executeJavaScript(js, true))
      .then((state) => {
        if (win.isDestroyed()) return;
        if (state === 'saved') {
          win.__forceClose = true;
          win.close();
          return;
        }
        const choice = dialog.showMessageBoxSync(win, {
          type: 'question',
          message: 'Des modifications ne sont pas encore enregistrées.',
          detail:
            "L'enregistrement automatique les a conservées — elles seront restaurées " +
            'au prochain lancement de l’application.',
          buttons: ['Quitter', 'Annuler'],
          defaultId: 0,
          cancelId: 1,
          noLink: true
        });
        if (choice === 0) {
          win.__forceClose = true;
          win.close();
        }
      })
      .catch(() => {
        if (!win.isDestroyed()) {
          win.__forceClose = true;
          win.close();
        }
      });
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

/* ---------------------------------------------------------------- menu */

function send(action) {
  if (win && !win.isDestroyed()) win.webContents.send('menu-action', action);
}

function buildMenu() {
  const template = [];

  if (IS_MAC) {
    template.push({
      label: app.name,
      submenu: [
        { label: 'À propos de Moodboard', click: () => send('help:about') },
        { type: 'separator' },
        { role: 'services', label: 'Services' },
        { type: 'separator' },
        { role: 'hide', label: 'Masquer Moodboard' },
        { role: 'hideOthers', label: 'Masquer les autres' },
        { role: 'unhide', label: 'Tout afficher' },
        { type: 'separator' },
        { role: 'quit', label: 'Quitter Moodboard' }
      ]
    });
  }

  template.push({
    label: 'Fichier',
    submenu: [
      { label: 'Nouveau moodboard', click: () => send('file:new') },
      { label: 'Ouvrir…', click: () => send('file:open') },
      { label: 'Enregistrer', click: () => send('file:save') },
      { label: 'Enregistrer sous…', click: () => send('file:saveas') },
      { type: 'separator' },
      /* v1.7 — Préférences : dossier des fichiers temporaires et
       * autosaves (délégué à la page, raccourci ⌘, géré par elle). */
      { label: 'Préférences…', click: () => send('app:preferences') },
      { type: 'separator' },
      { label: 'Importer des images…', click: () => send('file:import-images') },
      { label: 'Charger le tableau de démonstration', click: () => send('file:demo') },
      { type: 'separator' },
      { label: 'Exporter le PNG…', click: () => send('file:export-png') },
      { label: 'Exporter le SVG…', click: () => send('file:export-svg') },
      { type: 'separator' },
      { role: 'close', label: 'Fermer la fenêtre' }
    ]
  });

  /* v1.6 — menu Édition : les RÔLES natifs sont indispensables sur macOS
   * (sans menu d'édition, ⌘C/⌘X/⌘V/⌘A n'atteignent jamais le renderer —
   * comportement documenté d'Electron). Les rôles ciblent l'élément
   * focalisé (champ d'inspecteur, édition canvas) et fonctionnent aussi
   * sur Windows/Linux. */
  template.push({
    label: 'Édition',
    submenu: [
      { role: 'undo', label: 'Annuler' },
      { role: 'redo', label: 'Rétablir' },
      { type: 'separator' },
      { role: 'cut', label: 'Couper' },
      { role: 'copy', label: 'Copier' },
      { role: 'paste', label: 'Coller' },
      { role: 'selectAll', label: 'Tout sélectionner' }
    ]
  });

  template.push({
    label: 'Affichage',
    submenu: [
      { role: 'reload', label: 'Recharger' },
      { role: 'toggleDevTools', label: 'Outils de développement' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Basculer en plein écran' }
    ]
  });

  template.push({
    label: 'Fenêtre',
    submenu: [{ role: 'minimize', label: 'Réduire' }, { role: 'zoom', label: 'Agrandir' }]
  });

  template.push({
    label: 'Aide',
    submenu: [
      { label: 'Raccourcis clavier', click: () => send('help:shortcuts') },
      { label: 'Diagnostics…', click: () => send('help:diagnostics') },
      ...(IS_MAC ? [] : [{ type: 'separator' }, { label: 'À propos de Moodboard', click: () => send('help:about') }])
    ]
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* --------------------------------------------------------- couche fs IPC
 * Parité cep.fs : réponses synchrones { err, data } (0 = OK).
 * Chemins absolus uniquement — un chemin relatif est une erreur (err 1). */

function errnoOf(err) {
  if (!err) return 1;
  if (err.code === 'ENOENT') return 2;
  if (err.code === 'EACCES' || err.code === 'EPERM') return 13;
  if (err.code === 'EISDIR' || err.code === 'ENOTDIR') return 21;
  if (err.code === 'EEXIST') return 54;
  return 1;
}

function validPath(p) {
  return typeof p === 'string' && p.length > 0 && path.isAbsolute(p);
}

ipcMain.on('fs:read', (e, p, enc) => {
  if (!validPath(p)) {
    e.returnValue = { err: 1 };
    return;
  }
  try {
    const data = fs.readFileSync(p, enc === 'Base64' ? 'base64' : 'utf8');
    e.returnValue = { err: 0, data };
  } catch (err) {
    e.returnValue = { err: errnoOf(err) };
  }
});

ipcMain.on('fs:write', (e, p, data, enc) => {
  if (!validPath(p) || typeof data !== 'string') {
    e.returnValue = { err: 1 };
    return;
  }
  try {
    if (enc === 'Base64') {
      fs.writeFileSync(p, Buffer.from(data, 'base64'));
    } else {
      fs.writeFileSync(p, data, 'utf8');
    }
    e.returnValue = { err: 0 };
  } catch (err) {
    e.returnValue = { err: errnoOf(err) };
  }
});

ipcMain.on('fs:mkdir', (e, p) => {
  if (!validPath(p)) {
    e.returnValue = { err: 1 };
    return;
  }
  try {
    fs.mkdirSync(p, { recursive: true });
    e.returnValue = { err: 0 };
  } catch (err) {
    e.returnValue = { err: errnoOf(err) };
  }
});

ipcMain.on('fs:unlink', (e, p) => {
  if (!validPath(p)) {
    e.returnValue = { err: 1 };
    return;
  }
  try {
    fs.unlinkSync(p);
    e.returnValue = { err: 0 };
  } catch (err) {
    // Fichier déjà absent : toléré (sémantique idempotente de la sonde).
    e.returnValue = { err: err && err.code === 'ENOENT' ? 0 : errnoOf(err) };
  }
});

ipcMain.on('desktop:dataDir', (e) => {
  try {
    const dir = app.getPath('userData');
    fs.mkdirSync(dir, { recursive: true });
    e.returnValue = dir;
  } catch (err) {
    e.returnValue = '';
  }
});

/* ------------------------------------------------------ dialogues natifs */

ipcMain.handle('dialog:save', async (ev, opts) => {
  const o = opts || {};
  const ext = o.ext || 'moodboard';
  const cfg = {
    title: o.prompt || 'Enregistrer',
    filters: [
      {
        name: ext === 'moodboard' ? 'Projet Moodboard' : 'Fichier ' + ext.toUpperCase(),
        extensions: [ext]
      }
    ]
  };
  if (o.defaultName) {
    // v1.3 — le dialogue s'ouvre dans le dernier dossier utilisé (mémorisé
    // par la page, cf. prefs.json) ; repli : dossier Documents.
    let base = null;
    if (typeof o.defaultDir === 'string' && path.isAbsolute(o.defaultDir)) {
      try {
        if (fs.existsSync(o.defaultDir)) base = o.defaultDir;
      } catch (err) {
        base = null;
      }
    }
    try {
      cfg.defaultPath = base
        ? path.join(base, o.defaultName)
        : path.join(app.getPath('documents'), o.defaultName);
    } catch (err) {
      cfg.defaultPath = o.defaultName;
    }
  }
  if (!win || win.isDestroyed()) return null;
  const r = await dialog.showSaveDialog(win, cfg);
  return r.canceled || !r.filePath ? null : r.filePath;
});

ipcMain.handle('dialog:open', async () => {
  if (!win || win.isDestroyed()) return null;
  const r = await dialog.showOpenDialog(win, {
    title: 'Ouvrir un moodboard',
    properties: ['openFile'],
    filters: [{ name: 'Projet Moodboard', extensions: ['moodboard', 'json'] }]
  });
  return r.canceled || !r.filePaths || !r.filePaths.length ? null : r.filePaths[0];
});

/* v1.7 — Préférences : dialogue natif de choix d'un DOSSIER (dossier des
 * fichiers temporaires et autosaves). Retour { err, path }. */
ipcMain.handle('dialog:pickDir', async (ev, opts) => {
  const o = opts || {};
  if (!win || win.isDestroyed()) return { err: 1 };
  const cfg = {
    title: (o && o.prompt) || 'Choisir un dossier',
    properties: ['openDirectory', 'createDirectory']
  };
  if (typeof o.defaultDir === 'string' && path.isAbsolute(o.defaultDir)) {
    try {
      if (fs.existsSync(o.defaultDir)) cfg.defaultPath = o.defaultDir;
    } catch (err) {
      /* sans dossier initial */
    }
  }
  const r = await dialog.showOpenDialog(win, cfg);
  if (r.canceled || !r.filePaths || !r.filePaths.length) return { err: 1 };
  return { err: 0, path: r.filePaths[0] };
});

ipcMain.handle('desktop:info', () => ({
  platform: process.platform,
  arch: process.arch, /* v1.7 — sélection de l'installateur (dmg x64/arm64) */
  versions: process.versions,
  userData: app.getPath('userData')
}));

/* v1.4 — Révéler un fichier dans le Finder / l'Explorateur (écran
 * d'accueil, menu ⋯ d'une carte récente). Chemin absolu uniquement. */
ipcMain.handle('shell:reveal', async (_e, p) => {
  if (typeof p !== 'string' || !path.isAbsolute(p)) return { err: 1 };
  try {
    shell.showItemInFolder(p);
    return { err: 0 };
  } catch (err) {
    return { err: 1 };
  }
});

/* ------------------------------------------------- v1.7 — mises à jour
 * Le téléchargement des installateurs (dizaines de Mo) vit dans le
 * processus principal : streaming direct vers le disque (pas de chaîne
 * IPC géante), progression envoyée au renderer par événements. */

/* Lancer un fichier téléchargé (installateur .exe / image disque .dmg). */
ipcMain.handle('shell:launch', async (_e, p) => {
  if (typeof p !== 'string' || !path.isAbsolute(p)) return { err: 1 };
  try {
    const errMsg = await shell.openPath(p);
    return { err: errMsg ? 1 : 0 };
  } catch (err) {
    return { err: 1 };
  }
});

/* Ouvrir une URL dans le navigateur par défaut (page des releases). */
ipcMain.handle('shell:openUrl', async (_e, url) => {
  if (typeof url !== 'string' || !/^https:\/\/(api\.)?github\.com\//.test(url)) {
    return { err: 1 };
  }
  try {
    await shell.openExternal(url);
    return { err: 0 };
  } catch (err) {
    return { err: 1 };
  }
});

/* Quitter proprement (après lancement d'un installateur). */
ipcMain.on('app:quit', () => {
  if (win && !win.isDestroyed()) win.__forceClose = true;
  app.quit();
});

/* ------------------------------------------------- v1.9 — aperçu de lien
 * Capture STATIQUE d'une page web pour les cartes de lien : la page
 * est chargée dans une WebContentsView hors écran (vrai Chromium, avec
 * son rendu réel), on attend l'affichage, puis capturePage() → PNG
 * redimensionné (480 px de large) → data URL. Repli si le site refuse :
 * og:image (même mécanique de repli côté renderer ensuite).
 * Jamais animé : c'est une image figée au moment de la capture. */
ipcMain.handle('link:preview', async (_e, url) => {
  if (typeof url !== 'string' || !/^https?:\/\/[^\s]+$/i.test(url)) return { err: 1 };
  if (!win || win.isDestroyed() || !win.contentView) return { err: 1 };

  let view = null;
  const cleanup = () => {
    try {
      if (view) {
        win.contentView.removeChildView(view);
        if (!view.webContents.isDestroyed()) view.webContents.close();
      }
    } catch (err) { /* déjà détruite */ }
  };

  try {
    view = new WebContentsView({
      webPreferences: {
        offscreen: true,
        sandbox: true,
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      }
    });
    win.contentView.addChildView(view);
    view.setBounds({ x: 0, y: 0, width: 1024, height: 640 });
    view.setBackgroundColor('#FFFFFF');

    const loaded = new Promise((resolve) => {
      view.webContents.once('did-stop-loading', () => resolve(true));
      view.webContents.once('did-fail-load', (_ev, code) => resolve(code === -3));
      setTimeout(() => resolve(false), 12000);
    });
    view.webContents.loadURL(url).catch(() => {});
    await loaded;
    /* Laisser les images/réseaux finir de se peindre. */
    await new Promise((r) => setTimeout(r, 1800));
    if (!win || win.isDestroyed()) return { err: 1 };

    const image = await view.webContents.capturePage();
    if (image && !image.isEmpty()) {
      const resized = image.resize({ width: 480 });
      const dataUrl = resized.toDataURL();
      cleanup();
      if (dataUrl && dataUrl.length > 200) return { err: 0, dataUrl };
    }
    cleanup();
    return { err: 1 };
  } catch (err) {
    cleanup();
    return { err: 1 };
  }
});

/* Télécharge `url` (release GitHub — redirections suivies) dans `dir` ;
 * événements 'update-progress' { received, total, pct } vers le renderer.
 * Retour { err, path, size } ou { err, message }. */
ipcMain.handle('update:download', async (ev, url, dir) => {
  if (typeof url !== 'string' || !/^https:\/\//.test(url)) return { err: 1 };
  if (typeof dir !== 'string' || !path.isAbsolute(dir)) return { err: 1 };
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    return { err: 1 };
  }
  let name = 'installateur';
  try {
    name = decodeURIComponent(new URL(url).pathname.split('/').pop()) || name;
  } catch (err) {
    /* nom par défaut */
  }
  const dest = path.join(dir, name);
  const sendProgress = (received, total) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('update-progress', {
        received: received,
        total: total,
        pct: total ? Math.min(100, (received / total) * 100) : 0
      });
    }
  };
  try {
    await new Promise((resolve, reject) => {
      const get = (u, depth) => {
        if (depth > 6) {
          reject(new Error('trop de redirections'));
          return;
        }
        const req = https.get(u, { headers: { 'User-Agent': 'Moodboard-Updater' } }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            get(new URL(res.headers.location, u).href, depth + 1);
            return;
          }
          if (res.statusCode !== 200) {
            res.resume();
            reject(new Error('HTTP ' + res.statusCode));
            return;
          }
          const total = parseInt(res.headers['content-length'] || '0', 10);
          let received = 0;
          let lastSent = 0;
          const out = fs.createWriteStream(dest);
          res.on('data', (chunk) => {
            received += chunk.length;
            const now = Date.now();
            if (now - lastSent > 120) {
              lastSent = now;
              sendProgress(received, total);
            }
          });
          res.on('error', reject);
          out.on('error', reject);
          out.on('finish', () => {
            sendProgress(received, total);
            resolve();
          });
          res.pipe(out);
        });
        req.on('error', reject);
      };
      get(url, 0);
    });
    return { err: 0, path: dest, size: fs.statSync(dest).size };
  } catch (err) {
    try {
      fs.unlinkSync(dest);
    } catch (e) {
      /* fichier peut-être absent */
    }
    return { err: 1, message: String((err && err.message) || err) };
  }
});

/* ------------------------------------------------------------- cycle app */

app.whenReady().then(() => {
  /* v1.6 — polices du système (Local Font Access) : permission accordée
   * à notre propre renderer — MB.fonts énumère TOUTES les polices
   * installées sur l'ordinateur via window.queryLocalFonts(). */
  const sess = session.defaultSession;
  sess.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'local-fonts');
  });
  sess.setPermissionCheckHandler((_wc, permission) => permission === 'local-fonts');

  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ------------------------------------------------------------- mode E2E
 * Vérification RÉELLE headless (xvfb) : boot, erreurs console, mode
 * desktop, déplacement d'un élément par événements synthétiques,
 * autosave écrit sur le disque par IPC, action du menu natif. */

async function runE2e() {
  const results = [];

  const ok = (name, pass, detail) => {
    results.push({ name, pass: !!pass, detail: detail || '' });
  };

  const exec = (js) => win.webContents.executeJavaScript(js, true);

  try {
    await new Promise((r) => setTimeout(r, 1400)); // chargement + démo

    // 1. Version et mode
    const ver = await exec('(window.MB && MB.VERSION) || ""');
    ok('version ' + (require('./package.json').version), ver === require('./package.json').version, 'MB.VERSION=' + ver);
    const mode = await exec('(MB.storage && MB.storage.mode) ? MB.storage.mode() : "?"');
    ok('mode desktop actif', mode === 'desktop', 'mode=' + mode);
    const dir = await exec('(MB.storage.dataDir && MB.storage.dataDir()) || ""');
    ok('dossier de données résolu', typeof dir === 'string' && dir.length > 0, dir);
    const bodyCls = await exec('document.body.className');
    ok('classes body desktop', /mb-desktop/.test(bodyCls), bodyCls);

    // 2. v1.3 — écran d'accueil au démarrage (application de bureau)
    const homeShown = await exec('var h = document.getElementById("home-screen"); !!h && !h.hidden');
    ok('écran d‘accueil au démarrage', !!homeShown, homeShown ? 'affiché' : 'absent / masqué');
    const hasNewBtn = await exec('!!document.getElementById("home-new")');
    ok('bouton « Nouveau moodboard » présent', !!hasNewBtn);
    const emptyMsg = await exec('!document.getElementById("home-empty").hidden');
    ok('premier lancement : message « aucun récent »', !!emptyMsg);
    const noSession = await exec('!document.querySelector(".home-card--session")');
    ok('aucune session à reprendre (premier lancement)', !!noSession);

    // « Nouveau moodboard » → tableau vierge, écran d'accueil fermé
    await exec('document.getElementById("home-new").click()');
    await new Promise((r) => setTimeout(r, 250));
    const homeClosed = await exec('var h = document.getElementById("home-screen"); !!h && h.hidden');
    ok('« Nouveau » ferme l‘accueil', !!homeClosed);
    const nEmpty = await exec('MB.store.s().elements.length');
    ok('tableau vierge créé', nEmpty === 0, nEmpty + ' élément(s)');

    // Bouton Accueil de la barre supérieure (bureau uniquement)
    const homeBtnVisible = await exec('var b = document.getElementById("btn-home"); !!b && !b.hidden');
    ok('bouton Accueil visible (barre supérieure)', !!homeBtnVisible);
    await exec('document.getElementById("btn-home").click()');
    await new Promise((r) => setTimeout(r, 200));
    const homeBack = await exec('var h = document.getElementById("home-screen"); !!h && !h.hidden');
    ok('bouton Accueil → retour à l‘écran d‘accueil', !!homeBack);

    // Charger la démonstration depuis l'accueil (premier lancement E2E :
    // la démo ne se charge plus automatiquement, elle se choisit)
    await exec('document.getElementById("home-demo").click()');
    await new Promise((r) => setTimeout(r, 350));
    const homeAfterDemo = await exec('var h = document.getElementById("home-screen"); !!h && h.hidden');
    ok('démo → accueil fermé', !!homeAfterDemo);
    const n = await exec('MB.store.s().elements.length');
    ok('démo chargée depuis l‘accueil', n >= 15, n + ' éléments');

    // 3. Déplacement réel d'un élément (pointerdown sur la vue,
    //    pointermove/up sur window — même chaîne que la vraie souris).
    const drag = await exec(`(async () => {
      const st = MB.store.s();
      // Aimantage désactivé le temps du geste : mesure du delta monde EXACT.
      const snapWasOn = st.ui.snap;
      if (snapWasOn) MB.store.setUI({ snap: false });
      const img = st.elements.find(el => el.type === 'image');
      if (!img) return { fail: 'pas d’image' };
      const before = { x: img.x, y: img.y };
      const node = document.querySelector('#world [data-id="' + img.id + '"]');
      if (!node) return { fail: 'pas de vue DOM' };
      const r = node.getBoundingClientRect();
      const sx = Math.round(r.left + r.width / 2);
      const sy = Math.round(r.top + r.height / 2);
      const ev = (type, x, y) => new PointerEvent(type, {
        bubbles: true, cancelable: true, composed: true,
        pointerId: 1, pointerType: 'mouse', isPrimary: true,
        clientX: x, clientY: y, button: 0, buttons: 1
      });
      node.dispatchEvent(ev('pointerdown', sx, sy));
      const steps = [[sx + 30, sy + 22], [sx + 61, sy + 45], [sx + 90, sy + 70]];
      for (const [x, y] of steps) {
        window.dispatchEvent(ev('pointermove', x, y));
        await new Promise(r2 => setTimeout(r2, 20));
      }
      window.dispatchEvent(ev('pointerup', sx + 90, sy + 70));
      if (snapWasOn) MB.store.setUI({ snap: true });
      const after = MB.store.s().elements.find(el => el.id === img.id);
      const z = MB.store.s().camera.zoom;
      return {
        before, after,
        expected: { x: before.x + 90 / z, y: before.y + 70 / z }
      };
    })()`);
    if (drag && drag.fail) {
      ok('déplacement élément (drag)', false, drag.fail);
    } else if (drag && drag.after) {
      const dx = Math.abs(drag.after.x - drag.expected.x);
      const dy = Math.abs(drag.after.y - drag.expected.y);
      ok('déplacement élément (drag)', dx <= 1.5 && dy <= 1.5,
        'Δ monde attendu (' + drag.expected.x.toFixed(2) + ', ' + drag.expected.y.toFixed(2) +
        ') obtenu (' + drag.after.x.toFixed(2) + ', ' + drag.after.y.toFixed(2) + ')');
    } else {
      ok('déplacement élément (drag)', false, 'résultat invalide');
    }

    // 4. Autosave écrit sur disque via IPC (attendre le debounce 800 ms)
    await new Promise((r) => setTimeout(r, 1600));
    const asPath = path.join(app.getPath('userData'), 'autosave.moodboard');
    let savedOk = false;
    let savedDetail = '';
    try {
      const raw = fs.readFileSync(asPath, 'utf8');
      const doc = JSON.parse(raw);
      const moved = doc.elements.find((el) => el.id === (drag && drag.after && drag.after.id));
      savedOk = doc.version === 1 && Array.isArray(doc.elements) && doc.elements.length >= 15 &&
        !!moved;
      savedDetail = moved
        ? 'autosave.moodboard — ' + doc.elements.length + ' éléments, élément déplacé persisté @ (' +
          moved.x.toFixed(1) + ', ' + moved.y.toFixed(1) + ')'
        : 'élément déplacé introuvable dans l’autosave';
    } catch (err) {
      savedDetail = 'lecture impossible : ' + err.message;
    }
    ok('autosave persisté sur disque (IPC)', savedOk, savedDetail);

    // 5. Journal de diagnostic écrit (desktop fs)
    const diagPath = path.join(app.getPath('userData'), 'diagnostic.log');
    const diagOk = fs.existsSync(diagPath);
    ok('diagnostic.log écrit (desktop fs)', diagOk, diagPath);

    // 6. Action du menu natif → dialogue À propos de la page
    send('help:about');
    await new Promise((r) => setTimeout(r, 350));
    const hasDialog = await exec('!!document.querySelector(".dialog")');
    ok('menu natif → dialogue À propos', !!hasDialog, 'dialogue détecté=' + hasDialog);
    await exec('(function(){var b=document.querySelector(".dialog .dialog-actions button"); if(b) b.click(); return true;})()');
    await new Promise((r) => setTimeout(r, 200));

    // 7. Erreurs console
    ok('zéro erreur console', consoleErrors.length === 0,
      consoleErrors.slice(0, 3).join(' | ') || 'aucune');
  } catch (err) {
    ok('exécution du harnais', false, String((err && err.message) || err));
  }

  const passed = results.filter((r) => r.pass).length;
  console.log('\n===== E2E MOODBOARD DESKTOP =====');
  results.forEach((r) => {
    console.log((r.pass ? 'PASS' : 'FAIL') + ' — ' + r.name + (r.detail ? '  [' + r.detail + ']' : ''));
  });
  console.log('===== ' + passed + '/' + results.length + ' PASSÉS =====\n');
  app.exit(passed === results.length ? 0 : 1);
}
