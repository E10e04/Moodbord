/* =========================================================================
 * cep.js — Pont vers Adobe Illustrator via CSInterface / evalScript.
 * Toutes les commandes sont protégées : hors Illustrator (aperçu web),
 * chaque fonction explique l'indisponibilité au lieu d'échouer.
 *
 * Protocole JSX : chaînes délimitées (« ERR|message » en cas d'échec),
 * car ExtendScript ne fournit pas d'objet JSON natif.
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  var cs = null;
  var isCep = false;

  function evalScript(script) {
    return new Promise(function (resolve, reject) {
      if (!isCep) {
        reject(new Error('CEP indisponible'));
        return;
      }
      try {
        cs.evalScript(script, function (result) {
          if (result === 'EvalScript error' || (result || '').indexOf('EvalScript error') === 0) {
            reject(new Error(result));
          } else {
            resolve(result);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  function unwrap(result) {
    var r = String(result === undefined || result === null ? '' : result);
    if (r.indexOf('ERR|') === 0) {
      throw new Error(r.slice(4));
    }
    return r;
  }

  function guard() {
    if (!isCep) {
      MB.ui.toast('Cette action est disponible uniquement dans Illustrator (panneau CEP).', 'info');
      return false;
    }
    return true;
  }

  function init() {
    if (typeof window !== 'undefined' && window.__adobe_cep__) {
      isCep = true;
      cs = new CSInterface();
    }
  }

  /* ------------------------------------------------------ commandes */

  function importDocSwatches() {
    if (!guard()) return;
    evalScript('mbGetSwatches()')
      .then(function (raw) {
        var data = unwrap(raw);
        if (!data) throw new Error('Aucune nuance');
        var pairs = data.split(';').filter(Boolean).map(function (p) {
          var parts = p.split('|');
          return { name: parts[0] || 'Nuance', hex: U.normalizeHex(parts[1]) || '#CCCCCC' };
        });
        if (!pairs.length) throw new Error('Aucune nuance exploitable');
        var center = {
          x: (MB.camera.viewport().w / 2 - MB.store.s().camera.x) / MB.store.s().camera.zoom,
          y: (MB.camera.viewport().h / 2 - MB.store.s().camera.y) / MB.store.s().camera.zoom
        };
        MB.interact.createAt('palette', center, {
          name: 'Document Illustrator',
          colors: pairs
        });
        MB.ui.toast('Palette importée (' + pairs.length + ' couleurs)', 'success');
      })
      .catch(function (err) {
        MB.ui.toast('Import impossible : ' + err.message, 'error');
      });
  }

  function selectedColors() {
    var out = [];
    MB.store.selected().forEach(function (el) {
      if (el.type === 'color') {
        out.push({ name: el.data.name || el.data.hex, hex: el.data.hex });
      } else if (el.type === 'palette') {
        el.data.colors.forEach(function (c) {
          out.push({ name: c.name || c.hex, hex: c.hex });
        });
      }
    });
    return out;
  }

  function sendColorsToIllustrator() {
    if (!guard()) return;
    var colors = selectedColors();
    if (!colors.length) {
      MB.ui.toast('Sélectionnez une couleur ou une palette.', 'info');
      return;
    }
    var payload = colors
      .map(function (c) {
        return String(c.name).replace(/[|;]/g, ' ') + '|' + String(c.hex).replace('#', '');
      })
      .join(';');
    evalScript('mbAddSwatches("' + payload + '")')
      .then(function (raw) {
        unwrap(raw);
        MB.ui.toast(colors.length + ' nuance(s) ajoutée(s) au document Illustrator.', 'success');
      })
      .catch(function (err) {
        MB.ui.toast('Envoi impossible : ' + err.message, 'error');
      });
  }

  function placeSelectedImage() {
    if (!guard()) return;
    var sel = MB.store.selected().filter(function (e) {
      return e.type === 'image';
    });
    if (!sel.length) {
      MB.ui.toast('Sélectionnez une image.', 'info');
      return;
    }
    var el = sel[0];
    var src = el.data.src || '';
    if (src.indexOf('data:image/png;base64,') !== 0) {
      // convertit via canvas en PNG
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        try {
          var url = canvas.toDataURL('image/png');
          if (url.length < 100) throw new Error('conversion');
          placeDataUrlInIllustrator(url, el);
        } catch (e) {
          MB.ui.toast('Image non plaçable (canvas protégé).', 'error');
        }
      };
      img.onerror = function () {
        MB.ui.toast('Image illisible.', 'error');
      };
      img.src = src;
      return;
    }
    placeDataUrlInIllustrator(src, el);
  }

  function placeDataUrlInIllustrator(dataUrl, el) {
    var b64 = dataUrl.split(',')[1];
    var path = '';
    var temporary = false;
    if (MB.storage.dataDir()) {
      path = MB.storage.dataDir() + '/place-' + Date.now() + '.png';
      temporary = true;
    } else {
      // Aucun dossier de données inscriptible : l'utilisateur choisit où
      // enregistrer l'image avant placement (le fichier est conservé).
      path = MB.storage.saveDialog('Enregistrer l‘image à placer', 'moodboard-place.png', 'png');
      if (!path) return;
    }
    var res = window.cep.fs.writeFile(path, b64, 'Base64');
    if (res.err !== 0) {
      MB.ui.toast('Écriture temporaire impossible (' + res.err + ')', 'error');
      return;
    }
    evalScript('mbPlaceFile("' + path.replace(/\\/g, '/') + '")')
      .then(function (raw) {
        unwrap(raw);
        MB.ui.toast('Image placée dans Illustrator.', 'success');
        if (temporary) {
          setTimeout(function () {
            window.cep.fs.deleteFile && window.cep.fs.deleteFile(path);
          }, 8000);
        }
      })
      .catch(function (err) {
        MB.ui.toast('Placement impossible : ' + err.message, 'error');
      });
    void el;
  }

  function showDocInfo() {
    if (!guard()) return;
    evalScript('mbGetDocInfo()')
      .then(function (raw) {
        var data = unwrap(raw).split('|');
        MB.ui.dialog(
          '<div class="dialog-title">Document Illustrator</div>' +
          '<div class="dialog-body">' +
          '<table class="kbd-table">' +
          '<tr><td>Nom</td><td>' + U.escapeHtml(data[0] || '—') + '</td></tr>' +
          '<tr><td>Mode colorimétrique</td><td>' + U.escapeHtml(data[1] || '—') + '</td></tr>' +
          '<tr><td>Calques</td><td>' + U.escapeHtml(data[2] || '—') + '</td></tr>' +
          '<tr><td>Nuances</td><td>' + U.escapeHtml(data[3] || '—') + '</td></tr>' +
          '</table></div>',
          [{ label: 'Fermer', value: true, kind: 'primary' }]
        );
      })
      .catch(function (err) {
        MB.ui.toast('Lecture impossible : ' + err.message, 'error');
      });
  }

  function openURL(url) {
    if (isCep) {
      try {
        cs.openURLInDefaultBrowser(url);
        return;
      } catch (e) {
        /* repli */
      }
    }
    window.open(url, '_blank');
  }

  /* Informations d'hôte pour le rapport de diagnostic (Aide ▸
   * Diagnostics…) : application, version, version de l'API CEP.
   * Défensif : le moteur peut renvoyer une chaîne JSON, un objet,
   * ou des champs absents — chaque manque devient « ? » sans jamais
   * casser le rapport. */
  function cepApiVersion() {
    try {
      if (window.__adobe_cep__ && typeof window.__adobe_cep__.getCEPVersion === 'function') {
        return String(window.__adobe_cep__.getCEPVersion());
      }
      if (window.cep && typeof window.cep.getCEPVersion === 'function') {
        return String(window.cep.getCEPVersion());
      }
    } catch (e) {
      /* noop */
    }
    return '?';
  }

  function hostInfo() {
    if (!isCep || !cs) return null;
    var env = null;
    try {
      var raw = cs.getHostEnvironment ? cs.getHostEnvironment() : null;
      if (typeof raw === 'string') {
        try {
          env = JSON.parse(raw);
        } catch (e) {
          env = null;
        }
      } else if (raw && typeof raw === 'object') {
        env = raw;
      }
    } catch (e) {
      env = null;
    }
    var api = cepApiVersion();
    if (!env) {
      return { appId: '?', appName: '?', appVersion: '?', apiVersion: api };
    }
    return {
      appId: env.appId || '?',
      appName: env.appName || '?',
      appVersion: env.appVersion || '?',
      apiVersion: env.apiVersion || api
    };
  }

  MB.cep = {
    init: init,
    available: function () {
      return isCep;
    },
    hostInfo: hostInfo,
    importDocSwatches: importDocSwatches,
    sendColorsToIllustrator: sendColorsToIllustrator,
    placeSelectedImage: placeSelectedImage,
    showDocInfo: showDocInfo,
    openURL: openURL
  };
})();
