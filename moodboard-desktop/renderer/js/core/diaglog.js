/* =========================================================================
 * diaglog.js — Journal de diagnostic persistant.
 *
 * BUT : quand quelque chose se passe mal dans Illustrator (machine de
 * l'utilisateur), obtenir les faits SANS DevTools :
 *   - chaque événement d'erreur JS (window.onerror, promesses rejetées)
 *     est consigné avec sa pile ;
 *   - les compteurs d'événements (pointer vs souris) sont photographiés
 *     toutes les 5 s quand ils changent : on sait exactement quelle
 *     famille le moteur CEP livre ;
 *   - le cycle de vie des gestes (démarrage, fin, annulation) est tracé.
 *
 * Écriture : <dossier de données>/diagnostic.log (cep.fs ou IPC desktop) —
 * rotation à 96 Ko (on garde la fin). Hors CEP/desktop : mémoire seule, le
 * rapport reste disponible dans Aide ▸ Diagnostics…
 *
 * Ce module est chargé EN PREMIER (juste après CSInterface.js) pour
 * attraper les erreurs des scripts suivants, et ne doit JAMAIS faire
 * échouer l'application : tout est enveloppé de try/catch.
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});

  var enabled = false; // écriture fichier active (CEP + cep.fs + dossier)
  var filePath = '';
  var buffer = ''; // contenu courant du fichier
  var pending = ''; // lignes à écrire
  var flushTimer = null;
  var ring = []; // mémoire récente (web comme CEP) pour le rapport
  var RING_MAX = 90;
  var MAX_FILE = 96 * 1024;
  var KEEP_FILE = 48 * 1024;
  var lastCountersLine = '';
  var errorCount = 0;

  function now() {
    return new Date().toISOString().replace('T', ' ').replace('Z', '');
  }

  function pushRing(line) {
    ring.push(line);
    if (ring.length > RING_MAX) ring.splice(0, ring.length - RING_MAX);
  }

  /* Une ligne de journal : toujours en mémoire (rapport), sur fichier
     si actif. Aucune exception ne doit fuir d'ici. */
  function log(tag, msg) {
    try {
      var line = '[' + now() + '] [' + tag + '] ' + msg;
      pushRing(line);
      if (enabled) {
        pending += line + '\n';
        if (!flushTimer) {
          flushTimer = setTimeout(flush, 400);
        }
      }
    } catch (e) {
      /* le diagnostic ne doit jamais casser l'application */
    }
  }

  function trace(msg) {
    log('trace', msg);
  }

  /* Écrit fichier selon l'environnement (CEP : cep.fs ; application :
   * IPC desktop) — retourne { err } comme cep.fs, ou null si indisponible. */
  function writeFileSafe(path, data) {
    try {
      if (window.cep && window.cep.fs) return window.cep.fs.writeFile(path, data, 'UTF-8');
      if (MB.desktop && MB.desktop.active) return MB.desktop.write(path, data, 'UTF-8');
    } catch (e) {
      return null;
    }
    return null;
  }

  function readFileSafe(path) {
    try {
      if (window.cep && window.cep.fs) return window.cep.fs.readFile(path, 'UTF-8');
      if (MB.desktop && MB.desktop.active) return MB.desktop.read(path, 'UTF-8');
    } catch (e) {
      return null;
    }
    return null;
  }

  function flush() {
    flushTimer = null;
    if (!enabled || !pending) return;
    try {
      buffer += pending;
      pending = '';
      if (buffer.length > MAX_FILE) {
        buffer =
          '[' + now() + '] [rotation] journal tronqué (fin conservée)\n' +
          buffer.slice(-KEEP_FILE);
      }
      var res = writeFileSafe(filePath, buffer);
      if (!res || res.err !== 0) {
        // Écriture impossible : on ne tente plus rien cette session,
        // la mémoire (rapport) continue de fonctionner.
        enabled = false;
      }
    } catch (e) {
      enabled = false;
    }
  }

  /* -------------------------------------------------- capture erreurs */

  function stackOf(err) {
    try {
      if (err && err.stack) return String(err.stack).split('\n').slice(0, 5).join(' | ');
      if (err && err.message) return String(err.message);
    } catch (e) {
      /* noop */
    }
    return 'n/a';
  }

  window.addEventListener('error', function (ev) {
    try {
      errorCount++;
      var where = '';
      if (ev.filename) where = ' @ ' + ev.filename + ':' + (ev.lineno || 0);
      log('erreur', (ev.message || 'Erreur inconnue') + where + ' — ' + stackOf(ev.error));
    } catch (e) {
      /* noop */
    }
  });

  window.addEventListener('unhandledrejection', function (ev) {
    try {
      errorCount++;
      var r = ev && ev.reason;
      var msg = r && (r.message || r);
      log('promesse', 'rejet non géré : ' + (typeof msg === 'string' ? msg : stackOf(r)));
    } catch (e) {
      /* noop */
    }
  });

  /* -------------------------------------------------- compteurs 5 s */

  function countersLine() {
    var d = MB.EVT_DIAG || {};
    var parts = Object.keys(d).map(function (k) {
      return k + '=' + d[k];
    });
    var tool = '';
    try {
      if (MB.store) tool = ' outil=' + MB.store.s().tool;
    } catch (e) {
      /* store pas encore prêt */
    }
    return parts.join(' ') + tool;
  }

  function snapshotCounters() {
    try {
      var line = countersLine();
      if (line !== lastCountersLine) {
        lastCountersLine = line;
        log('compteurs', line);
      }
    } catch (e) {
      /* noop */
    }
  }

  /* -------------------------------------------------- clavier (sonde) */

  /* Diagnostic clavier : les compteurs pointer/souris ne disaient rien des
   * touches — impossible de savoir si un keydown atteignait la page. On
   * compte maintenant chaque touche reçue (famille mesurée AVANT toute
   * logique applicative, phase capture) et on journalise les premières
   * avec leur cible : « touche: "z" ⌘ (dans un champ — proj-name) »
   * répondra définitivement à « pourquoi mes raccourcis ne marchent pas »
   * (focus piégé dans un champ d'interface, touches jamais livrées…). */
  /* NB (v1.2.0) : les compteurs keydown/keyup/focusInInput sont tenus
   * par la couche centralisée de utils.js (tapEvents — un événement =
   * +1, une seule fois). Cette sonde ne fait que JOURNALISER les
   * premières touches reçues avec leur contexte. */
  window.addEventListener('keydown', function (e) {
    try {
      var d = MB.EVT_DIAG;
      if (!d || (d.keydown || 0) > 24) return;
      var t = e.target;
      var inField = !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable));
      var combo = JSON.stringify(e.key) +
        (e.metaKey ? ' ⌘' : '') + (e.ctrlKey ? ' Ctrl' : '') +
        (e.shiftKey ? ' ⇧' : '') + (e.altKey ? ' ⌥' : '');
      var where = inField
        ? ' (dans un champ — ' + String(t.id || t.className || t.tagName).slice(0, 40) + ')'
        : '';
      log('touche', combo + where);
    } catch (err) {
      /* le diagnostic ne doit jamais casser l'application */
    }
  }, true);

  /* ------------------------------------------------------ rapport */

  function report() {
    var out = [];
    try {
      out.push('Moodboard v' + (MB.VERSION || '?') + ' — rapport de diagnostic');
      out.push('Date : ' + now());
      var cep = !!(typeof window !== 'undefined' && window.__adobe_cep__);
      var desktop = !!(MB.desktop && MB.desktop.active);
      out.push(
        'Environnement : ' +
          (desktop ? 'application autonome (Electron)' : cep ? 'Adobe CEP (Illustrator)' : 'navigateur/aperçu web')
      );
      /* Focus clavier : c'est LUI qui décide si les raccourcis vivent
         dans un panneau CEP — le rapport doit le montrer. */
      var ae = '';
      try {
        ae = (document.activeElement && document.activeElement.tagName) || '?';
      } catch (e2) {
        ae = '?';
      }
      out.push(
        'Focus clavier : ' +
          (typeof document.hasFocus === 'function' && document.hasFocus() ? 'panneau' : 'HORS panneau') +
          ' · élément actif=' + ae
      );
      if (cep && MB.cep && MB.cep.hostInfo) {
        var hi = MB.cep.hostInfo();
        if (hi) {
          out.push(
            'Hôte : ' + (hi.appName || '?') + ' ' + (hi.appVersion || '?') +
            ' · appId=' + (hi.appId || '?') + ' · API CEP=' + (hi.apiVersion || '?')
          );
        }
      }
      out.push('Moteur : ' + navigator.userAgent);
      out.push('Écran : ' + window.innerWidth + '×' + window.innerHeight + ' · DPR=' + window.devicePixelRatio);
      if (MB.storage) {
        var modeEnv = '';
        var dir = '';
        try {
          modeEnv = MB.storage.mode ? MB.storage.mode() : (MB.storage.isCep() ? 'cep' : 'web');
          dir = (MB.storage.dataDir && MB.storage.dataDir()) || '';
        } catch (e) {
          /* noop */
        }
        out.push(
          'Persistance : ' +
            (dir
              ? 'fichiers (' + modeEnv + ') — ' + dir
              : modeEnv === 'cep'
                ? 'localStorage (repli CEP sans dossier)'
                : 'localStorage web')
        );
      }
      out.push('Compteurs d’événements : ' + countersLine());
      out.push('Erreurs JS capturées (session) : ' + errorCount);
      out.push('');
      out.push('--- Journal récent ---');
      out.push(ring.length ? ring.slice(-40).join('\n') : '(vide)');
      if (enabled && filePath) {
        out.push('');
        out.push('(journal complet : ' + filePath + ')');
      }
    } catch (e) {
      out.push('Rapport interrompu : ' + stackOf(e));
    }
    return out.join('\n');
  }

  /* ------------------------------------------------------ init */

  function init() {
    try {
      if (!(MB.storage && MB.storage.isFs && MB.storage.isFs())) {
        log('boot', 'Moodboard v' + (MB.VERSION || '?') + ' — mode sans fichier (journal mémoire uniquement)');
        return;
      }
      filePath = (MB.storage.dataDir && MB.storage.dataDir() || '') + '/diagnostic.log';
      if (!filePath || filePath.indexOf('//') >= 0 || filePath.slice(-1) === '/') {
        filePath = '';
        log('boot', 'dossier de données indisponible — journal mémoire uniquement');
        return;
      }
      // Récupère le journal existant (limité), puis bannière de session.
      var r = readFileSafe(filePath);
      buffer = r && r.err === 0 && r.data ? String(r.data) : '';
      if (buffer.length > KEEP_FILE) {
        buffer = '[boot] journal précédent tronqué\n' + buffer.slice(-KEEP_FILE);
      }
      enabled = true;
      log(
        'boot',
        '=== Moodboard v' + (MB.VERSION || '?') + ' — session ouverte ===' +
          ' · dossier : ' + MB.storage.dataDir()
      );
      setInterval(snapshotCounters, 5000);
      flush();
    } catch (e) {
      enabled = false;
    }
  }

  MB.diaglog = {
    init: init,
    log: log,
    trace: trace,
    report: report,
    errorCount: function () {
      return errorCount;
    },
    filePath: function () {
      return filePath;
    },
    isEnabled: function () {
      return enabled;
    }
  };
})();
