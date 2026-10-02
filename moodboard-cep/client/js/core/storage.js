/* =========================================================================
 * storage.js — Persistance.
 *
 * Trois adaptateurs :
 *   - Desktop : window.mbDesktop (application autonome Electron — IPC vers
 *               le processus principal : fichiers locaux, dialogues natifs) ;
 *   - CEP     : window.cep.fs (fichiers locaux, dialogues natifs) — Illustrator ;
 *   - Web     : localStorage (autosave) + téléchargement / sélecteur de fichiers.
 *
 * Dossier de données (Desktop) : <userData de l'app> (≈ ~/Library/Application
 *   Support/Moodboard sur macOS, %APPDATA%\Moodboard sur Windows — le MÊME
 *   dossier que l'extension CEP : les projets passent de l'un à l'autre).
 * Dossier de données (CEP) : <SystemPath.USER_DATA>/Moodboard
 *   USER_DATA est l'emplacement documenté Adobe, inscriptible par l'utilisateur
 *   (macOS : ~/Library/Application Support ; Windows : %APPDATA%).
 *   Repli : <SystemPath.EXTENSION>/data, sinon stockage local du panneau.
 *   NB : toute autre clé SystemPath (ex. « extensionData ») est refusée par le
 *   moteur CEP, qui répond « Invalid Input Params » — les chemins renvoyés
 *   sont donc TOUJOURS validés (absolu) avant usage, et l'inscriptibilité est
 *   prouvée par une sonde d'écriture.
 *
 * Format projet .moodboard (JSON versionné) :
 *   { version: 1, name, savedAt, camera, elements, settings }
 *
 * Autosave : 800 ms après la dernière modification (jamais pendant un drag).
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  var MODE = 'web';
  var cs = null;
  var dataDir = ''; // '' => persistance fichier indisponible (repli localStorage)
  var WEB_KEY = 'mb.autosave.v1';
  var WEB_FLAG = 'mb.demoLoaded';
  var fsWarned = false; // un seul toast d'échec d'autosave par session

  function isCep() {
    return MODE === 'cep';
  }

  function isDesktop() {
    return MODE === 'desktop';
  }

  /* Persistance fichier disponible : desktop actif + dossier, ou CEP actif
   * + dossier inscriptible. */
  function isFs() {
    if (MODE === 'desktop') return !!dataDir;
    return MODE === 'cep' && !!dataDir && !!(window.cep && window.cep.fs);
  }

  function fsErr(code) {
    return 'Erreur fichier CEP (' + code + ')';
  }

  /* Chemin absolu valide : « /… » (macOS) ou « X:/… » (Windows).
   * Rejette les réponses d'erreur du moteur CEP renvoyées telles quelles
   * quand le type de chemin demandé n'existe pas (ex. « Invalid Input Params »). */
  function isAbsPath(p) {
    return typeof p === 'string' && (p.charAt(0) === '/' || /^[A-Za-z]:[\\/]/.test(p));
  }

  function systemPath(type) {
    if (!cs) return '';
    try {
      return cs.getSystemPath(type);
    } catch (e) {
      return '';
    }
  }

  /* Sonde d'écriture : le seul test fiable d'inscriptibilité réelle. */
  function probeFs(dir) {
    var f = dir + '/.write-probe';
    if (MODE === 'desktop') {
      try {
        var w = MB.desktop.write(f, 'ok', 'UTF-8');
        if (!w || w.err !== 0) return false;
        var r = MB.desktop.read(f, 'UTF-8');
        try {
          MB.desktop.unlink(f);
        } catch (e) {
          /* non bloquant */
        }
        return !!r && r.err === 0 && r.data === 'ok';
      } catch (e) {
        return false;
      }
    }
    if (!window.cep || !window.cep.fs) return false;
    try {
      var w = window.cep.fs.writeFile(f, 'ok', 'UTF-8');
      if (!w || w.err !== 0) return false;
      var r = window.cep.fs.readFile(f, 'UTF-8');
      if (window.cep.fs.deleteFile) {
        try {
          window.cep.fs.deleteFile(f);
        } catch (e) {
          /* non bloquant */
        }
      }
      return !!r && r.err === 0 && r.data === 'ok';
    } catch (e) {
      return false;
    }
  }

  /* Crée un dossier segment par segment (err 0 = créé, 54 = déjà présent).
   * Retourne false dès qu'un segment est réellement impossible à créer. */
  function ensureDir(path) {
    if (!path) return false;
    if (MODE === 'desktop') {
      try {
        var rd = MB.desktop.mkdir(path);
        return !!rd && rd.err === 0;
      } catch (e) {
        return false;
      }
    }
    if (!isCep() || !window.cep || !window.cep.fs) return false;
    var p = String(path).replace(/\\/g, '/');
    var parts = p.split('/').filter(Boolean);
    var cur = '';
    for (var i = 0; i < parts.length; i++) {
      cur = cur ? cur + '/' + parts[i] : p.charAt(0) === '/' ? '/' + parts[i] : parts[i];
      if (/^[A-Za-z]:$/.test(cur)) continue; // racine du lecteur Windows : rien à créer
      var res;
      try {
        res = window.cep.fs.makedir(cur);
      } catch (e) {
        return false;
      }
      if (!res || (res.err !== 0 && res.err !== 54)) {
        console.warn('[Moodboard] Création du dossier impossible :', cur, res && res.err);
        return false;
      }
    }
    return true;
  }

  /* Dossier de données :
   *   1) <USER_DATA>/Moodboard (documenté Adobe, survit aux mises à jour
   *      de l'extension) ;
   *   2) <EXTENSION>/data (installation utilisateur / mode debug) ;
   *   3) aucun => repli localStorage (l'autosave reste fonctionnel). */
  function resolveDataDir() {
    var cands = [];
    var ud = systemPath(SystemPath.USER_DATA);
    if (isAbsPath(ud)) cands.push(ud.replace(/[\\/]+$/, '') + '/Moodboard');
    var ext = systemPath(SystemPath.EXTENSION);
    if (isAbsPath(ext)) cands.push(ext.replace(/[\\/]+$/, '') + '/data');
    for (var i = 0; i < cands.length; i++) {
      ensureDir(cands[i]); // création au mieux ; la sonde d'écriture tranche
      if (probeFs(cands[i])) return cands[i];
    }
    return '';
  }

  function slotPath() {
    return dataDir + '/autosave.moodboard';
  }

  function cleanElement(e) {
    var c = U.deepClone(e);
    delete c._rev;
    delete c._sized;
    return c;
  }

  function serialize() {
    /* v1.6 — planches liées : réécrire le document courant dans l'arbre
     * racine AVANT de sérialiser, puis sérialiser le RACINE (le fichier
     * embarque tout l'arbre — nom, caméra et éléments du document
     * racine, la planche ouverte étant emboîtée dans son élément). */
    if (MB.boards) MB.boards.syncUp();
    var st = MB.store.s();
    var inside = !!(MB.boards && MB.boards.insideBoard());
    var rootName = inside ? MB.boards.crumb()[0] : st.project.name;
    var rootEls = inside ? MB.boards.rootElements() : st.elements;
    var cam = inside ? MB.boards.rootCamera() : st.camera;
    return {
      version: 1,
      name: rootName,
      savedAt: new Date().toISOString(),
      camera: {
        x: U.round(cam.x, 2),
        y: U.round(cam.y, 2),
        zoom: U.round(cam.zoom, 4)
      },
      elements: rootEls.map(cleanElement),
      settings: {
        snap: st.ui.snap,
        grid: st.ui.grid
      }
    };
  }

  function parseDoc(raw) {
    var doc;
    try {
      doc = JSON.parse(raw);
    } catch (e) {
      return { error: 'Fichier illisible (JSON invalide).' };
    }
    if (!doc || doc.version !== 1 || !Array.isArray(doc.elements)) {
      return { error: 'Format .moodboard non reconnu (version attendue : 1).' };
    }
    for (var i = 0; i < doc.elements.length; i++) {
      var e = doc.elements[i];
      if (!e || !e.id || !e.type) {
        return { error: 'Élément invalide à la position ' + i + '.' };
      }
    }
    return { doc: doc };
  }

  function writeText(path, text) {
    if (MODE === 'desktop') {
      var rd = MB.desktop.write(path, text, 'UTF-8');
      if (!rd || rd.err !== 0) return { error: 'Erreur fichier (' + (rd && rd.err) + ')' };
      return { ok: true };
    }
    var res = window.cep.fs.writeFile(path, text, 'UTF-8');
    if (res.err !== 0) return { error: fsErr(res.err) };
    return { ok: true };
  }

  function readText(path) {
    if (MODE === 'desktop') {
      var rd = MB.desktop.read(path, 'UTF-8');
      if (!rd || rd.err !== 0) return { error: 'Erreur fichier (' + (rd && rd.err) + ')' };
      return { text: rd.data };
    }
    var res = window.cep.fs.readFile(path, 'UTF-8');
    if (res.err !== 0) return { error: fsErr(res.err) };
    return { text: res.data };
  }

  /* Lecture/écriture multi-encodages (UTF-8, Base64) — chemins du disque
   * (déposés par l'OS, exports PNG…). Parité stricte avec cep.fs :
   * retourne { err, data } ; disponible en modes desktop et CEP. */
  function readFileAny(path, enc) {
    if (MODE === 'desktop') return MB.desktop.read(path, enc);
    return window.cep.fs.readFile(path, enc);
  }

  function writeFileAny(path, data, enc) {
    if (MODE === 'desktop') return MB.desktop.write(path, data, enc);
    return window.cep.fs.writeFile(path, data, enc);
  }

  /* L'environnement fournit-il des chemins disque pour les fichiers déposés
   * depuis l'OS ? (Electron et CEP attachent file.path ; le web non.) */
  function hasOsPaths() {
    return MODE === 'desktop' || MODE === 'cep';
  }

  function downloadFile(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      a.remove();
    }, 400);
  }

  function safeName() {
    var n = (MB.store.s().project.name || 'moodboard').trim();
    if (!n) n = 'moodboard';
    return n.replace(/[\\/:*?"<>|]+/g, '-');
  }

  /* --------------------------------------------------- dialogues natifs */

  /* showSaveDialogEx accepte, selon la version de CEP, soit un objet de
   * paramètres, soit des paramètres positionnels. On tente la forme objet,
   * puis la forme positionnelle UNIQUEMENT si la première a échoué
   * techniquement (exception ou réponse anormale) — une annulation de
   * l'utilisateur n'ouvre jamais un second dialogue. */
  function saveDialog(prompt, filename, ext, dir) {
    if (!window.cep || !window.cep.fs || !window.cep.fs.showSaveDialogEx) return null;
    var r = null;
    try {
      var params = {
        prompt: prompt,
        displayFileName: filename,
        fileTypes: [
          {
            doctype: ext === 'moodboard' ? 'Projet Moodboard' : 'Fichier ' + ext.toUpperCase(),
            templates: [ext]
          }
        ]
      };
      /* v1.3 — ouvrir le dialogue au dernier dossier utilisé. */
      if (isAbsPath(dir)) params.initialLocation = dir;
      r = window.cep.fs.showSaveDialogEx(params);
    } catch (e) {
      r = null;
    }
    if (r && typeof r.err === 'number') {
      return r.err === 0 && r.data ? r.data : null; // réponse normale (annulation incluse)
    }
    try {
      var r2 = window.cep.fs.showSaveDialogEx(prompt, isAbsPath(dir) ? dir : dataDir || null, filename, [ext]);
      if (r2 && r2.err === 0 && r2.data) return r2.data;
    } catch (e) {
      /* signature positionnelle non supportée */
    }
    return null;
  }

  function openDialog() {
    if (!window.cep || !window.cep.fs || !window.cep.fs.showOpenDialogEx) return null;
    var r = null;
    try {
      r = window.cep.fs.showOpenDialogEx(false, false, 'Ouvrir un moodboard', null, [
        'moodboard',
        'json'
      ]);
    } catch (e) {
      r = null;
    }
    if (r && typeof r.err === 'number') {
      return r.err === 0 && r.data && r.data.length ? r.data[0] : null;
    }
    try {
      var r2 = window.cep.fs.showOpenDialogEx(false, false, 'Ouvrir un moodboard', null);
      if (r2 && r2.err === 0 && r2.data && r2.data.length) return r2.data[0];
    } catch (e) {
      /* signature non supportée */
    }
    return null;
  }

  /* Dialogue natif d'enregistrement pour les modes fichier (desktop/CEP) —
   * retourne Promise<chemin|null> (annulation incluse). v1.3 : sans
   * dossier explicite, le dernier dossier utilisé est proposé. */
  function pickSavePath(prompt, filename, ext, dir) {
    var d = dir === undefined ? readPrefs().lastDir : dir;
    if (MODE === 'desktop') {
      return MB.desktop.saveDialog({
        prompt: prompt,
        defaultName: filename,
        defaultDir: d,
        ext: ext
      });
    }
    return Promise.resolve(saveDialog(prompt, filename, ext, d));
  }

  /* ------------------------------------------------------- autosave */

  var autosaveTimer = null;

  function markSaved() {
    MB.store.setUI({ saveState: 'saved' });
  }

  function webStore(payload) {
    try {
      localStorage.setItem(WEB_KEY, payload);
      return true;
    } catch (e) {
      return false;
    }
  }

  function saveAutosave() {
    if (MB.store.s().ui.saveState === 'saved') return;
    MB.store.setUI({ saveState: 'saving' });
    var payload = JSON.stringify(serialize());
    if (isFs()) {
      var res = writeText(slotPath(), payload);
      if (res.error) {
        // Le dossier est devenu inaccessible : on ne perd pas les données,
        // le contenu bascule sur le stockage local du panneau.
        webStore(payload);
        MB.store.setUI({ saveState: 'unsaved' });
        if (MB.ui && !fsWarned) {
          fsWarned = true;
          MB.ui.toast(
            'Échec de l‘enregistrement automatique (' +
              res.error +
              ') — utilisez Fichier ▸ Enregistrer sous…',
            'error'
          );
        }
        return;
      }
    } else {
      if (!webStore(payload)) {
        MB.store.setUI({ saveState: 'unsaved' });
        if (MB.ui) {
          MB.ui.toast(
            'Espace local saturé — utilisez Fichier ▸ Enregistrer sous… pour exporter le projet.',
            'error'
          );
        }
        return;
      }
    }
    // petit délai visuel pour le retour d'état
    setTimeout(markSaved, 260);
  }

  function markDirty() {
    if (MB.store.s().ui.saveState === 'saving') return;
    MB.store.setUI({ saveState: 'unsaved' });
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(saveAutosave, 800);
  }

  function hasAutosave() {
    if (isFs()) {
      var r = readText(slotPath());
      return !r.error && !!r.text && r.text.length > 2;
    }
    try {
      return !!localStorage.getItem(WEB_KEY);
    } catch (e) {
      return false;
    }
  }

  function loadAutosave() {
    var raw;
    if (isFs()) {
      var r = readText(slotPath());
      if (r.error) return { error: 'Aucun autosave.' };
      raw = r.text;
    } else {
      raw = localStorage.getItem(WEB_KEY);
      if (!raw) return { error: 'Aucun autosave.' };
    }
    var parsed = parseDoc(raw);
    if (parsed.error) return parsed;
    parsed.doc.path = null;
    return parsed;
  }

  /* ------------------------------------------------------- opérations */

  /* v1.3 — Le dossier du dernier enregistrement est mémorisé (fichier
   * prefs.json dans le dossier de données, partagé par l'application et
   * l'extension ; repli localStorage en mode web) : le dialogue natif
   * s'ouvre directement au bon endroit au save suivant. */
  var PREFS_FILE = 'prefs.json';

  function basename(p) {
    var s = String(p || '');
    var i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
    return i < 0 ? s : s.slice(i + 1);
  }

  function dirname(p) {
    var s = String(p || '');
    var i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
    if (i < 1) return '';
    return s.slice(0, i) || '/';
  }

  function readPrefs() {
    var base = { lastDir: '', defaultFont: '' };
    if (isFs()) {
      var r = readText(dataDir + '/' + PREFS_FILE);
      if (!r.error && r.text) {
        try {
          var p = JSON.parse(r.text);
          if (p && typeof p === 'object') {
            return {
              lastDir: isAbsPath(p.lastDir || '') ? p.lastDir : '',
              defaultFont: typeof p.defaultFont === 'string' ? p.defaultFont : ''
            };
          }
        } catch (e) {
          /* prefs illisibles : valeurs par défaut */
        }
      }
      return base;
    }
    try {
      var raw = localStorage.getItem('mb.prefs.v1');
      var pj = raw ? JSON.parse(raw) : null;
      var lastDir = localStorage.getItem('mb.lastDir') || '';
      return {
        lastDir: lastDir,
        defaultFont: pj && typeof pj.defaultFont === 'string' ? pj.defaultFont : ''
      };
    } catch (e) {
      return base;
    }
  }

  function writePrefs(p) {
    try {
      var merged = Object.assign(readPrefs(), p || {});
      if (isFs()) writeText(dataDir + '/' + PREFS_FILE, JSON.stringify(merged));
      else {
        localStorage.setItem('mb.prefs.v1', JSON.stringify(merged));
        localStorage.setItem('mb.lastDir', merged.lastDir || '');
      }
    } catch (e) {
      /* non bloquant */
    }
  }

  /* v1.6 — préférence unitaire (police par défaut…) : fusion sans jamais
   * écraser les autres clés du fichier prefs. */
  function setPref(key, value) {
    var patch = {};
    patch[key] = value;
    writePrefs(patch);
  }

  /* ------------------------------------------------------- récents (v1.3/v1.4)
   * Liste des 20 derniers projets enregistrés/ouverts (fichier
   * recent.json du dossier de données) — alimente l'écran d'accueil
   * de l'application de bureau.
   * v1.4 — schéma enrichi par entrée :
   *   { path, name, savedAt, count,
   *     fav?: true,            — épinglé dans « Favoris »
   *     trashedAt?: iso,       — retiré de la liste → « Corbeille »
   *     thumb?: dataURL JPEG } — miniature du tableau au dernier save */
  var RECENTS_FILE = 'recent.json';
  var RECENTS_MAX = 20;
  var RECENTS_TRASH_MAX = 10;

  function samePath(a, b) {
    return String(a || '').toLowerCase() === String(b || '').toLowerCase();
  }

  function readRecents() {
    if (!isFs()) return [];
    var r = readText(dataDir + '/' + RECENTS_FILE);
    if (r.error || !r.text) return [];
    try {
      var arr = JSON.parse(r.text);
      if (!Array.isArray(arr)) return [];
      return arr.filter(function (x) {
        return x && isAbsPath(x.path) && typeof x.name === 'string';
      });
    } catch (e) {
      return [];
    }
  }

  function writeRecents(list) {
    if (!isFs()) return;
    /* 20 actifs (les plus récents d'abord) + 10 entrées de corbeille. */
    var act = [];
    var trs = [];
    for (var i = 0; i < list.length; i++) {
      (list[i].trashedAt ? trs : act).push(list[i]);
    }
    trs.sort(function (a, b) {
      return String(b.trashedAt || '').localeCompare(String(a.trashedAt || ''));
    });
    writeText(dataDir + '/' + RECENTS_FILE, JSON.stringify(act.slice(0, RECENTS_MAX).concat(trs.slice(0, RECENTS_TRASH_MAX))));
  }

  /* Enregistre un projet en tête de la liste (dédupliqué par chemin).
   * Favori/miniature d'une entrée précédente conservés ; une entrée
   * corbeillée qui re-sauvegarde revient dans la liste active. */
  function rememberRecent(path) {
    if (!isFs() || !isAbsPath(path)) return;
    var all = readRecents();
    var prev = null;
    var list = [];
    for (var i = 0; i < all.length; i++) {
      if (!prev && samePath(all[i].path, path)) {
        prev = all[i];
        continue;
      }
      list.push(all[i]);
    }
    list.unshift({
      path: path,
      name: basename(path).replace(/\.moodboard$/i, '') || 'Sans titre',
      savedAt: new Date().toISOString(),
      count: (MB.store.s().elements || []).length,
      fav: prev ? !!prev.fav : false,
      thumb: prev && typeof prev.thumb === 'string' ? prev.thumb : ''
    });
    writeRecents(list);
  }

  /* Listes exploitables par l'écran d'accueil :
   *   'recents' — vue par défaut, fichiers disparus purgés silencieusement ;
   *   'fav'     — favoris épinglés (existants) ;
   *   'trash'   — entrées retirées de la liste (restaurables). */
  function recentList(view) {
    var all = readRecents();
    if (view === 'trash') {
      return all
        .filter(function (x) {
          return !!x.trashedAt;
        })
        .slice(0, RECENTS_TRASH_MAX);
    }
    var list = all.filter(function (x) {
      if (view === 'fav') return !!x.fav && !x.trashedAt;
      return !x.trashedAt;
    });
    var alive = [];
    for (var i = 0; i < list.length; i++) {
      if (!readText(list[i].path).error) alive.push(list[i]);
    }
    if (view !== 'fav' && alive.length !== list.length) {
      /* purge des fichiers disparus (vue récents : source de vérité du
       * fichier — les entrées corbeille sont conservées). */
      var trashed = all.filter(function (x) {
        return !!x.trashedAt;
      });
      writeRecents(alive.concat(trashed));
    }
    return alive;
  }

  /* ------------------------------------------------ mutations (v1.4) */

  function mutateRecents(path, fn) {
    if (!isFs() || !isAbsPath(path)) return null;
    var list = readRecents();
    for (var i = 0; i < list.length; i++) {
      if (samePath(list[i].path, path)) {
        var r = fn(list[i]);
        writeRecents(list);
        return r;
      }
    }
    return null;
  }

  /* Épingle/retire des favoris → renvoie le nouvel état (boolean). */
  function toggleRecentFav(path) {
    var r = mutateRecents(path, function (e) {
      e.fav = !e.fav;
      if (!e.fav) delete e.fav;
      return !!e.fav;
    });
    return typeof r === 'boolean' ? r : null;
  }

  /* Retire l'entrée de la liste (→ corbeille) — le fichier reste intact. */
  function trashRecent(path) {
    return !!mutateRecents(path, function (e) {
      e.trashedAt = new Date().toISOString();
      return true;
    });
  }

  /* Restaure une entrée corbeillée dans la liste des récents. */
  function restoreRecent(path) {
    return !!mutateRecents(path, function (e) {
      delete e.trashedAt;
      e.savedAt = e.savedAt || new Date().toISOString();
      return true;
    });
  }

  /* Supprime définitivement l'entrée (fichier intact, liste seulement). */
  function deleteRecentForever(path) {
    if (!isFs() || !isAbsPath(path)) return false;
    var list = readRecents().filter(function (x) {
      return !samePath(x.path, path);
    });
    writeRecents(list);
    return true;
  }

  /* Miniature (JPEG dataURL) associée à une entrée récente. */
  function setRecentThumb(path, dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return;
    mutateRecents(path, function (e) {
      e.thumb = dataUrl;
      return true;
    });
  }

  /* v1.3 — Enregistrer, Enregistrer sous… et ⌘/Ctrl+S ouvrent TOUJOURS
   * l'explorateur / le Finder pour choisir l'emplacement du fichier,
   * pré-rempli du dernier dossier utilisé puis du nom courant. */
  function save() {
    saveAs();
  }

  function saveAs() {
    var payload = JSON.stringify(serialize());
    var st = MB.store.s();
    var prefs = readPrefs();
    /* Nom proposé : celui du fichier courant, sinon celui du projet. */
    var fname = st.project.path ? basename(st.project.path) : safeName() + '.moodboard';
    /* Dossier proposé : dernier enregistrement, sinon dossier du fichier
     * courant, sinon dossier par défaut de l'OS. */
    var dir = prefs.lastDir || (st.project.path ? dirname(st.project.path) : '');

    function landed(target) {
      if (!target) return; // annulé
      var w = writeText(target, payload);
      if (w.error) {
        MB.ui.toast('Échec de l‘enregistrement : ' + w.error, 'error');
        return;
      }
      MB.store.setProject({ path: target });
      markSaved();
      /* Mémoire de l'emplacement pour le prochain enregistrement. */
      writePrefs({ lastDir: dirname(target) });
      rememberRecent(target);
      /* v1.4 — miniature de l'écran d'accueil (best effort, asynchrone :
       * la carte garde son motif par défaut si la rastérisation échoue). */
      if (MB.exporter && typeof MB.exporter.thumbnail === 'function') {
        MB.exporter.thumbnail(480, 320, function (dataUrl) {
          if (dataUrl) setRecentThumb(target, dataUrl);
        });
      }
      MB.ui.toast('Projet enregistré', 'success');
    }

    if (isDesktop()) {
      MB.desktop
        .saveDialog({
          prompt: 'Enregistrer le moodboard',
          defaultName: fname,
          defaultDir: dir,
          ext: 'moodboard'
        })
        .then(landed);
      return;
    }
    if (isCep()) {
      var target = saveDialog('Enregistrer le moodboard', fname, 'moodboard', dir);
      landed(target);
    } else {
      downloadFile(safeName() + '.moodboard', payload);
      markSaved();
      MB.ui.toast('Projet exporté (.moodboard)', 'success');
    }
  }

  function openFile(doc, path) {
    /* v1.6 — ouvrir un AUTRE document : vider la pile de planches
     * (après syncUp, l'arbre courant reste cohérent en mémoire). */
    if (MB.boards) MB.boards.reset();
    MB.store.loadDocument({
      name: doc.name || 'Sans titre',
      path: path || null,
      elements: doc.elements,
      camera: doc.camera,
      settings: doc.settings
    });
    markSaved();
    if (path) rememberRecent(path);
    if (MB.camera) MB.camera.apply();
    if (MB.board) MB.board.refreshOverlay();
    /* L'écran d'accueil (application) se ferme à l'ouverture d'un projet. */
    if (MB.ui && MB.ui.home && MB.ui.home.visible()) MB.ui.home.hide();
    MB.ui.toast('Projet ouvert : ' + (doc.name || 'Sans titre'), 'success');
  }

  /* Ouvre un fichier .moodboard par son chemin (écran d'accueil,
   * récents…) — retourne true si le projet est chargé. */
  function openPath(p) {
    if (!isAbsPath(p)) return false;
    var r = readText(p);
    if (r.error) {
      MB.ui.toast(r.error, 'error');
      return false;
    }
    var parsed = parseDoc(r.text);
    if (parsed.error) {
      MB.ui.toast(parsed.error, 'error');
      return false;
    }
    openFile(parsed.doc, p);
    return true;
  }

  /* Supprime l'autosave (fichier + stockage local) — utilisé par
   * « Nouveau moodboard » pour ne pas ressusciter l'ancien travail. */
  function clearAutosave() {
    if (isFs()) {
      try {
        if (MODE === 'desktop') MB.desktop.unlink(slotPath());
        else if (window.cep && window.cep.fs && window.cep.fs.deleteFile)
          window.cep.fs.deleteFile(slotPath());
      } catch (e) {
        /* non bloquant */
      }
    }
    try {
      localStorage.removeItem(WEB_KEY);
    } catch (e) {
      /* non bloquant */
    }
  }

  function open() {
    if (isDesktop()) {
      MB.desktop.openDialog().then(function (p) {
        if (p) openPath(p); // toast d'erreur inclus
      });
      return;
    }
    if (isCep()) {
      var p = openDialog();
      if (p) openPath(p);
    } else {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.moodboard,.json,application/json';
      input.onchange = function () {
        var f = input.files && input.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          var parsed = parseDoc(String(reader.result));
          if (parsed.error) return MB.ui.toast(parsed.error, 'error');
          openFile(parsed.doc, null);
        };
        reader.onerror = function () {
          MB.ui.toast('Impossible de lire le fichier.', 'error');
        };
        reader.readAsText(f);
      };
      input.click();
    }
  }

  function firstRunFlag() {
    if (isFs()) {
      var r = readText(dataDir + '/flag-demo.done');
      return !!r.error;
    }
    try {
      return !localStorage.getItem(WEB_FLAG);
    } catch (e) {
      return true;
    }
  }

  function setFirstRunFlag() {
    if (isFs()) {
      writeText(dataDir + '/flag-demo.done', 'ok');
    } else {
      try {
        localStorage.setItem(WEB_FLAG, '1');
      } catch (e) {
        /* non bloquant */
      }
    }
  }

  MB.storage = {
    init: function () {
      /* Application autonome (Electron) : priorité absolue. */
      if (MB.desktop && MB.desktop.active) {
        MODE = 'desktop';
        dataDir = '';
        try {
          var d = MB.desktop.dataDir();
          if (isAbsPath(d)) {
            ensureDir(d);
            if (probeFs(d)) dataDir = d;
          }
        } catch (e) {
          dataDir = '';
        }
        if (dataDir) {
          console.log('[Moodboard] Dossier de données (application) : ' + dataDir);
        } else {
          console.warn(
            '[Moodboard] Dossier de données indisponible — autosave sur le stockage local de la session.'
          );
        }
        return;
      }
      if (typeof window !== 'undefined' && window.__adobe_cep__) {
        MODE = 'cep';
        try {
          cs = new CSInterface();
        } catch (e) {
          cs = null;
        }
        if (!cs) return;
        dataDir = resolveDataDir();
        if (dataDir) {
          console.log('[Moodboard] Dossier de données : ' + dataDir);
        } else {
          console.warn(
            '[Moodboard] Aucun dossier inscriptible trouvé — repli de l‘autosave sur le stockage local du panneau.'
          );
        }
      }
    },
    isCep: isCep,
    isDesktop: isDesktop,
    isFs: isFs,
    mode: function () {
      return MODE;
    },
    hasOsPaths: hasOsPaths,
    readFileAny: readFileAny,
    writeFileAny: writeFileAny,
    pickSavePath: pickSavePath,
    cs: function () {
      return cs;
    },
    dataDir: function () {
      return dataDir;
    },
    serialize: serialize,
    markDirty: markDirty,
    markSaved: markSaved,
    prefs: readPrefs,
    setPref: setPref,
    save: save,
    saveAs: saveAs,
    saveDialog: saveDialog,
    open: open,
    openFile: openFile,
    openPath: openPath,
    clearAutosave: clearAutosave,
    recentList: recentList,
    toggleRecentFav: toggleRecentFav,
    trashRecent: trashRecent,
    restoreRecent: restoreRecent,
    deleteRecentForever: deleteRecentForever,
    setRecentThumb: setRecentThumb,
    lastDir: function () {
      return readPrefs().lastDir;
    },
    hasAutosave: hasAutosave,
    loadAutosave: loadAutosave,
    firstRunFlag: firstRunFlag,
    setFirstRunFlag: setFirstRunFlag,
    downloadFile: downloadFile,
    writeText: writeText,
    readText: readText,
    ensureDir: ensureDir
  };
})();
