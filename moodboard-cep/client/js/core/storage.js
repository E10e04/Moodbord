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
  /* v1.7 — deux dossiers distincts :
   *   baseDir — dossier de données PAR DÉFAUT (résolu comme avant) ;
   *             prefs.json y vit TOUJOURS (pointeur stable partagé par
   *             l'application et l'extension) ;
   *   dataDir — dossier ACTIF pour les données (autosave, récents,
   *             journaux) : baseDir, ou dossier choisi dans les
   *             Préférences (« fichiers temporaires et autosaves »).
   * v1.8 — le dossier choisi s'applique à TOUS les moodboards : chaque
   *   projet enregistré possède SON slot d'autosave dans ce dossier
   *   (autosave-<clé>.moodboard) référencé par autosave-index.json ; le
   *   slot générique autosave.moodboard couvre les projets non
   *   enregistrés. Ouvrir un projet NE supprime plus l'autosave d'un
   *   autre (ancien comportement : un seul slot global écrasé à chaque
   *   changement de fichier). */
  var baseDir = '';
  var dataDir = '';
  var WEB_KEY = 'mb.autosave.v1';
  var WEB_FLAG = 'mb.demoLoaded';
  var fsWarned = false; // un seul toast d'échec d'autosave par session

  /* Fichiers de données qui suivent le dossier choisi dans les
   * Préférences (copiés lors du changement de dossier). Les slots
   * d'autosave par projet (v1.8) sont migrés via l'index. */
  var DATA_FILES = ['autosave.moodboard', 'recent.json', 'flag-demo.done', 'diagnostic.log'];
  var AUTOSAVE_INDEX = 'autosave-index.json';

  function joinPath(a, b) {
    return String(a || '').replace(/[\\/]+$/, '') + '/' + b;
  }

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

  /* v1.8 — slot d'autosave PAR PROJET : la clé dérive du chemin du
   * fichier (.moodboard) — basée sur un hash court pour rester
   * lisible ET unique (les chemins peuvent partager leur suffixe). */
  function hashPath(p) {
    var s = String(p).toLowerCase();
    var h = 5381;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    }
    var base = s.replace(/[\\/]+/g, '-').replace(/[^a-z0-9-]+/g, '').slice(-40);
    return (base ? base + '-' : '') + h.toString(36);
  }

  function slotFileFor(path) {
    if (!isAbsPath(path)) return 'autosave.moodboard';
    return 'autosave-' + hashPath(path) + '.moodboard';
  }

  function slotPath() {
    return dataDir + '/' + slotFileFor(MB.store.s().project.path);
  }

  /* Index des slots (autosave-index.json) : [{file, path, name,
   * savedAt}] — écrit à chaque autosave, lu pour la reprise de session
   * (slot le plus récent) et la migration de dossier. */
  function readAutosaveIndex() {
    if (!isFs()) return [];
    var r = readText(dataDir + '/' + AUTOSAVE_INDEX);
    if (r.error || !r.text) return [];
    try {
      var arr = JSON.parse(r.text);
      if (!Array.isArray(arr)) return [];
      return arr.filter(function (x) {
        return x && typeof x.file === 'string' && !/[\\/]/.test(x.file);
      });
    } catch (e) {
      return [];
    }
  }

  function writeAutosaveIndex(list) {
    if (!isFs()) return;
    try {
      writeText(dataDir + '/' + AUTOSAVE_INDEX, JSON.stringify(list.slice(0, 40)));
    } catch (e) {
      /* non bloquant */
    }
  }

  function updateAutosaveIndex() {
    if (!isFs()) return;
    var st = MB.store.s();
    var file = slotFileFor(st.project.path);
    var entry = {
      file: file,
      path: isAbsPath(st.project.path) ? st.project.path : '',
      name: st.project.name || 'Sans titre',
      savedAt: new Date().toISOString()
    };
    var list = readAutosaveIndex().filter(function (e) {
      return e.file !== file;
    });
    list.unshift(entry);
    writeAutosaveIndex(list);
  }

  /* Le slot d'autosave existant le plus récent (reprise de session) :
   * l'index d'abord (ordre savedAt), puis le slot générique legacy. */
  function latestAutosaveSlot() {
    if (!isFs()) return null;
    var idx = readAutosaveIndex();
    for (var i = 0; i < idx.length; i++) {
      var r = readText(dataDir + '/' + idx[i].file);
      if (!r.error && r.text && r.text.length > 2) {
        var out = {};
        for (var k in idx[i]) out[k] = idx[i][k];
        if (!out.savedAt) out.savedAt = '';
        return out;
      }
    }
    var legacy = readText(dataDir + '/autosave.moodboard');
    if (!legacy.error && legacy.text && legacy.text.length > 2) {
      return { file: 'autosave.moodboard', path: '', name: '', savedAt: '' };
    }
    return null;
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
      /* v1.8 — le slot du projet courant est référencé dans l'index
       * (reprise de session la plus récente + migration de dossier). */
      updateAutosaveIndex();
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
      return !!latestAutosaveSlot();
    }
    try {
      return !!localStorage.getItem(WEB_KEY);
    } catch (e) {
      return false;
    }
  }

  function loadAutosave() {
    if (isFs()) {
      var slot = latestAutosaveSlot();
      if (!slot) return { error: 'Aucun autosave.' };
      var r = readText(dataDir + '/' + slot.file);
      if (r.error) return { error: 'Aucun autosave.' };
      var parsed = parseDoc(r.text);
      if (parsed.error) return parsed;
      /* v1.8 — la session reprise se rattache à son fichier projet le
       * cas échéant : ⌘S enregistre là où l'utilisateur avait enregistré. */
      parsed.doc.path = isAbsPath(slot.path) ? slot.path : null;
      return parsed;
    }
    var raw = localStorage.getItem(WEB_KEY);
    if (!raw) return { error: 'Aucun autosave.' };
    var parsedWeb = parseDoc(raw);
    if (parsedWeb.error) return parsedWeb;
    parsedWeb.doc.path = null;
    return parsedWeb;
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
    var base = { lastDir: '', defaultFont: '', dataDir: '', fontFavs: [], lang: 'auto', shapeTool: 'rect' };
    if (baseDir) {
      var r = readText(baseDir + '/' + PREFS_FILE);
      if (!r.error && r.text) {
        try {
          var p = JSON.parse(r.text);
          if (p && typeof p === 'object') {
            return {
              lastDir: isAbsPath(p.lastDir || '') ? p.lastDir : '',
              defaultFont: typeof p.defaultFont === 'string' ? p.defaultFont : '',
              dataDir: isAbsPath(p.dataDir || '') ? p.dataDir : '',
              fontFavs: Array.isArray(p.fontFavs) ? p.fontFavs.filter(function (x) {
                return typeof x === 'string' && x;
              }) : [],
              /* v1.9 — langue de l'interface ('auto' suit le système) et
               * forme active de l'outil Forme. */
              lang: p.lang === 'fr' || p.lang === 'en' ? p.lang : 'auto',
              shapeTool: typeof p.shapeTool === 'string' ? p.shapeTool : 'rect'
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
        defaultFont: pj && typeof pj.defaultFont === 'string' ? pj.defaultFont : '',
        dataDir: pj && isAbsPath(pj.dataDir || '') ? pj.dataDir : '',
        fontFavs: pj && Array.isArray(pj.fontFavs) ? pj.fontFavs : [],
        lang: pj && (pj.lang === 'fr' || pj.lang === 'en') ? pj.lang : 'auto',
        shapeTool: pj && typeof pj.shapeTool === 'string' ? pj.shapeTool : 'rect'
      };
    } catch (e) {
      return base;
    }
  }

  function writePrefs(p) {
    try {
      var merged = Object.assign(readPrefs(), p || {});
      if (baseDir) writeText(baseDir + '/' + PREFS_FILE, JSON.stringify(merged));
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

  /* ------------------------------------------------- dossier de données (v1.7)
   * Préférence « fichiers temporaires et autosaves » : la valeur vit
   * dans prefs.json DU DOSSIER PAR DÉFAUT (baseDir) — les deux
   * environnements (application et extension) partagent le même
   * pointeur ; seules les DONNÉES déménagent. */

  /* Applique la préférence au démarrage : dossier valide + inscriptible
   * requis, sinon retour silencieux au dossier par défaut. */
  function applyDataDirPref() {
    dataDir = baseDir;
    if (!baseDir) return;
    var custom = readPrefs().dataDir;
    if (custom && isAbsPath(custom) && !samePath(custom, baseDir)) {
      ensureDir(custom);
      if (probeFs(custom)) {
        dataDir = custom;
        console.log('[Moodboard] Dossier de données personnalisé : ' + custom);
        return;
      }
      console.warn(
        '[Moodboard] Dossier personnalisé inaccessible (' + custom + ') — retour au dossier par défaut.'
      );
    }
  }

  /* Dialogue natif de choix d'un dossier — Promise<chemin|null>. */
  function pickDataDir() {
    var start = dataDir || baseDir || '';
    if (MODE === 'desktop') {
      if (MB.desktop && typeof MB.desktop.pickDir === 'function') {
        return MB.desktop.pickDir({
          prompt: 'Dossier des fichiers Moodboard',
          defaultDir: start
        }).then(
          function (r) {
            return r && r.err === 0 && r.path ? r.path : null;
          },
          function () {
            return null;
          }
        );
      }
      return Promise.resolve(null);
    }
    if (isCep() && window.cep && window.cep.fs && window.cep.fs.showOpenDialogEx) {
      try {
        var res = window.cep.fs.showOpenDialogEx(
          false,
          true,
          'Dossier des fichiers Moodboard',
          start || null
        );
        if (res && res.err === 0 && res.data && res.data.length) {
          return Promise.resolve(res.data[0]);
        }
      } catch (e) {
        /* signature non supportée par cette version de CEP */
      }
    }
    return Promise.resolve(null);
  }

  /* Change le dossier actif : valide, migre les fichiers de données
   * (autosave — y compris les slots par projet via l'index —, récents…),
   * mémorise la préférence. Retour {ok} ou {error}. prefValue permet
   * d'écrire '' lors d'une remise à défaut. */
  function setDataDir(newDir, prefValue) {
    if (!baseDir) return { error: 'Persistance fichier indisponible dans cet environnement.' };
    if (!isAbsPath(newDir)) return { error: 'Chemin invalide.' };
    if (samePath(newDir, dataDir)) return { ok: true, dir: newDir, unchanged: true };
    ensureDir(newDir);
    if (!probeFs(newDir)) return { error: 'Ce dossier n‘est pas accessible en écriture.' };
    var oldDir = dataDir;
    var moved = [];
    /* v1.8 — la migration emporte AUSSI les slots d'autosave par
     * projet (référencés par l'index) et l'index lui-même : le dossier
     * choisi contient les caches de TOUS les moodboards. */
    var files = DATA_FILES.slice();
    readAutosaveIndex().forEach(function (e) {
      if (files.indexOf(e.file) < 0) files.push(e.file);
    });
    files.push(AUTOSAVE_INDEX);
    files.forEach(function (f) {
      var r = oldDir ? readText(joinPath(oldDir, f)) : { error: 'aucun' };
      if (!r.error && r.text) {
        if (!writeText(joinPath(newDir, f), r.text).error) moved.push(f);
      }
    });
    dataDir = newDir;
    setPref('dataDir', prefValue === undefined ? newDir : prefValue);
    return { ok: true, dir: newDir, moved: moved };
  }

  /* Remise au dossier par défaut (Préférences ▸ « Dossier par défaut »). */
  function resetDataDir() {
    return setDataDir(baseDir, '');
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

  /* v1.7 — Politique d'enregistrement :
   *   - « Enregistrer » / ⌘S : si le projet PROVIENT d'un fichier (ouvert)
   *     ou a déjà été enregistré quelque part, on réécrit DIRECTEMENT ce
   *     fichier — plus de dialogue. Sinon (premier enregistrement), on
   *     choisit l'emplacement comme un « Enregistrer sous… ».
   *   - « Enregistrer sous… » / ⇧⌘S : choisit TOUJOURS un nouvel
   *     emplacement (nouveau fichier). */
  function save() {
    var st = MB.store.s();
    if (isFs() && isAbsPath(st.project.path)) {
      saveToPath(st.project.path);
      return;
    }
    saveAs();
  }

  /* Écrit le projet dans un chemin déjà connu (⌘S sur un fichier
   * ouvert/enregistré) : silencieux, sans dialogue. */
  function saveToPath(target) {
    var payload = JSON.stringify(serialize());
    var w = writeText(target, payload);
    if (w.error) {
      MB.ui.toast(
        'Échec de l‘enregistrement (' + w.error + ') — utilisez Fichier ▸ Enregistrer sous…',
        'error'
      );
      return;
    }
    afterSaved(target, 'Enregistré · ' + basename(target));
  }

  /* Suite commune à un enregistrement réussi (saveToPath / saveAs). */
  function afterSaved(target, message) {
    markSaved();
    /* Mémoire de l'emplacement pour le prochain enregistrement. */
    writePrefs({ lastDir: dirname(target) });
    rememberRecent(target);
    /* v1.4 — miniature de l'écran d'accueil (best effort, asynchrone :
     * la carte garde son motif par défaut si la rastérisation échoue).
     * v1.10 — rendu 640×400 (16:10) : UN élément héros plein cadre,
     * haute résolution (netteté sur écrans Retina). */
    if (MB.exporter && typeof MB.exporter.thumbnail === 'function') {
      MB.exporter.thumbnail(640, 400, function (dataUrl) {
        if (dataUrl) setRecentThumb(target, dataUrl);
      });
    }
    MB.ui.toast(message || 'Projet enregistré', 'success');
  }

  function saveAs() {
    var st = MB.store.s();
    var prefs = readPrefs();
    /* v1.8 — le nom proposé est TOUJOURS celui du projet (champ de la
     * barre supérieure) : renommer puis Enregistrer / Enregistrer sous…
     * propose le NOUVEAU nom (demande utilisateur). */
    var fname = safeName() + '.moodboard';
    /* Dossier proposé : dernier enregistrement, sinon dossier du fichier
     * courant, sinon dossier par défaut de l'OS. */
    var dir = prefs.lastDir || (st.project.path ? dirname(st.project.path) : '');

    function landed(target) {
      if (!target) return; // annulé
      /* v1.8 — le nom du fichier devient le nom du projet (champ haut,
       * fil d'Ariane, sérialisation) : les deux restent synchrones. */
      var name = basename(target).replace(/\.moodboard$/i, '') || 'Sans titre';
      MB.store.setProject({ path: target, name: name });
      var payload = JSON.stringify(serialize());
      var w = writeText(target, payload);
      if (w.error) {
        MB.ui.toast('Échec de l‘enregistrement : ' + w.error, 'error');
        return;
      }
      afterSaved(target, 'Projet enregistré');
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
      downloadFile(safeName() + '.moodboard', JSON.stringify(serialize()));
      markSaved();
      MB.ui.toast('Projet exporté (.moodboard)', 'success');
    }
  }

  function openFile(doc, path) {
    /* v1.8 — le dossier des caches (préférence) est RÉAPPLIQUÉ à chaque
     * ouverture : le choix reste celui de l'utilisateur pour TOUS les
     * moodboards, même après un changement de projet. */
    applyDataDirPref();
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
   * récents…) — retourne true si le projet est chargé.
   * v1.8 — si l'AUTOSAVE de CE projet (dossier des caches) est plus
   * récent que le fichier, c'est la version non enregistrée qui est
   * restaurée — c'est le rôle d'un autosave (aucun travail perdu). */
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
    if (isFs()) {
      var slotRaw = readText(dataDir + '/' + slotFileFor(p));
      if (slotRaw && !slotRaw.error && slotRaw.text && slotRaw.text.length > 2) {
        var slotParsed = parseDoc(slotRaw.text);
        var fileAt = Date.parse(parsed.doc.savedAt || '') || 0;
        var slotAt = Date.parse(slotParsed.doc ? slotParsed.doc.savedAt || '' : '') || 0;
        if (
          !slotParsed.error && slotParsed.doc && slotAt > fileAt &&
          Array.isArray(slotParsed.doc.elements) && slotParsed.doc.elements.length
        ) {
          openFile(slotParsed.doc, p);
          MB.ui.toast('Version non enregistrée restaurée (autosave plus récent que le fichier).', 'info');
          return true;
        }
      }
    }
    openFile(parsed.doc, p);
    return true;
  }

  /* Supprime l'autosave (fichier + stockage local) — utilisé par
   * « Nouveau moodboard » pour ne pas ressusciter l'ancien travail.
   * v1.8 — supprime le slot du projet COURANT (à appeler avant
   * loadDocument) et son entrée d'index ; le slot générique (projets
   * non enregistrés) est également nettoyé. */
  function clearAutosave() {
    if (isFs()) {
      var st = MB.store.s();
      var files = { 'autosave.moodboard': true };
      files[slotFileFor(st.project.path)] = true;
      try {
        for (var f in files) {
          var full = dataDir + '/' + f;
          if (MODE === 'desktop') MB.desktop.unlink(full);
          else if (window.cep && window.cep.fs && window.cep.fs.deleteFile) {
            window.cep.fs.deleteFile(full);
          }
        }
        writeAutosaveIndex(
          readAutosaveIndex().filter(function (e) {
            return !files[e.file];
          })
        );
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
        baseDir = '';
        dataDir = '';
        try {
          var d = MB.desktop.dataDir();
          if (isAbsPath(d)) {
            ensureDir(d);
            if (probeFs(d)) baseDir = d;
          }
        } catch (e) {
          baseDir = '';
        }
        /* v1.7 — applique la préférence « fichiers temporaires et
         * autosaves » (Préférences…), sinon dossier par défaut. */
        applyDataDirPref();
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
        baseDir = resolveDataDir();
        applyDataDirPref();
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
    /* v1.7 — Préférences : dossier des fichiers temporaires/autosaves. */
    dataDirDefault: function () {
      return baseDir;
    },
    dataDirIsCustom: function () {
      return !!(dataDir && baseDir && !samePath(dataDir, baseDir));
    },
    pickDataDir: pickDataDir,
    setDataDir: setDataDir,
    resetDataDir: resetDataDir,
    serialize: serialize,
    parseDoc: parseDoc,
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
