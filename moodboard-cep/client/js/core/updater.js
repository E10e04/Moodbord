/* =========================================================================
 * updater.js — Mises à jour depuis le dépôt GitHub (v1.7).
 *
 * Connecte l'application ET l'extension au dépôt des releases :
 *   - au DÉMARRAGE (machine connectée) : vérification silencieuse de la
 *     dernière release ; si une nouvelle version existe, un popup la
 *     signale et propose la mise à jour ;
 *   - « Plus tard » : le numéro de version (barre d'état, en bas) reste
 *     cliquable pour relancer la mise à jour à tout moment ;
 *   - MISE À JOUR : téléchargement avec progression à l'écran, puis :
 *       · application (Electron) : l'installateur de la plateforme est
 *         téléchargé (streaming par le processus principal) puis lancé ;
 *       · extension (CEP/Illustrator) : les fichiers de l'extension sont
 *         remplacés dans son dossier d'installation, puis le panneau se
 *         recharge (location.reload).
 *
 * Les appels réseau ciblent l'API publique GitHub (aucune dépendance
 * externe, aucun CDN : les URL ne vivent que dans ce module).
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  var REPO = 'E10e04/Moodbord';
  var API = 'https://api.github.com/repos/' + REPO;
  var RAW = 'https://raw.githubusercontent.com/' + REPO;
  var RELEASES_URL = 'https://github.com/' + REPO + '/releases';

  var latest = null; // dernière release interrogée (cache)
  var pending = false; // une mise à jour est disponible (pastille version)
  var running = false; // une mise à jour est en cours
  var progressSink = null; // progression courante → dialogue ouvert

  /* ------------------------------------------------------- utilitaires */

  function currentVersion() {
    return String(MB.VERSION || '0.0.0');
  }

  function parseVer(v) {
    var m = String(v || '').trim().replace(/^v/i, '').match(/(\d+)\.(\d+)\.(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : null;
  }

  function isNewer(a, b) {
    var va = parseVer(a);
    var vb = parseVer(b);
    if (!va || !vb) return false;
    for (var i = 0; i < 3; i++) {
      if (va[i] !== vb[i]) return va[i] > vb[i];
    }
    return false;
  }

  function fetchJson(url) {
    return fetch(url, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store'
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function fmtBytes(n) {
    if (!isFinite(n) || n < 0) return '—';
    if (n < 1024) return Math.round(n) + ' o';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' Ko';
    return (n / 1048576).toFixed(1) + ' Mo';
  }

  function fmtDate(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString();
    } catch (e) {
      return '';
    }
  }

  /* Extrait la première section exploitable des notes de release
   * (markdown brut — affiché tel quel, échappé). */
  function notesExcerpt(body, max) {
    var t = String(body || '')
      .split('\r\n')
      .join('\n')
      .replace(/[\s\S]*?##?\s*Nouveaut[eé]s\s*:?\s*\n/i, '')
      .trim();
    if (t.length > (max || 420)) t = t.slice(0, max || 420) + '…';
    return t;
  }

  function environment() {
    if (MB.desktop && MB.desktop.active) return 'app';
    if (MB.storage && MB.storage.isCep && MB.storage.isCep()) return 'cep';
    return 'web';
  }

  function envLabel() {
    var e = environment();
    return e === 'app' ? 'application autonome' : e === 'cep' ? 'extension Illustrator' : 'aperçu navigateur';
  }

  /* Ouvre une URL dans le navigateur par défaut (CEP : utilitaire
   * dédié ; application : pont Electron ; web : nouvel onglet). */
  function openReleasesPage() {
    try {
      if (environment() === 'cep' && window.cep && window.cep.util && window.cep.util.openURLInDefaultBrowser) {
        window.cep.util.openURLInDefaultBrowser(RELEASES_URL);
        return;
      }
      if (MB.desktop && MB.desktop.canOpenUrl) {
        MB.desktop.openUrl(RELEASES_URL);
        return;
      }
      window.open(RELEASES_URL, '_blank');
    } catch (e) {
      MB.ui.toast('Impossible d‘ouvrir la page : ' + RELEASES_URL, 'info');
    }
  }

  /* ------------------------------------------------- pastille de version */

  function refreshVersionChip() {
    var chip = document.getElementById('sb-version');
    if (!chip) return;
    if (pending) {
      chip.classList.add('is-pending');
      chip.textContent = 'v' + currentVersion() + ' · maj dispo';
      chip.setAttribute('title', 'Moodboard ' + (latest ? latest.tag : '?') + ' est disponible — cliquez pour mettre à jour');
    } else {
      chip.classList.remove('is-pending');
      chip.textContent =
        'v' + currentVersion() + (MB.desktop && MB.desktop.active ? ' · Desktop' : '');
      chip.setAttribute('title', 'Version installée — cliquez pour vérifier les mises à jour');
    }
  }

  /* ------------------------------------------------------- vérification */

  /* Repli : version lue directement dans le dépôt (raw.githubusercontent
   * — CORS ouvert, sans quota horaire) quand l'API publique est
   * indisponible (limite 60 req/h/IP atteinte, proxy…). Les notes et
   * installateurs sont reconstruits : nomenclature stable de la CI. */
  function checkRaw() {
    return fetch(RAW + '/main/moodboard-cep/package.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (pkg) {
        var tag = String((pkg && pkg.version) || '');
        if (!parseVer(tag)) throw new Error('version illisible');
        var dl = 'https://github.com/' + REPO + '/releases/download/v' + tag + '/';
        latest = {
          tag: tag,
          name: 'v' + tag,
          notes: '',
          url: RELEASES_URL + '/tag/v' + tag,
          publishedAt: '',
          assets: [
            { name: 'Moodboard-Setup-' + tag + '.exe', size: 0, url: dl + 'Moodboard-Setup-' + tag + '.exe' },
            { name: 'Moodboard-' + tag + '-x64.dmg', size: 0, url: dl + 'Moodboard-' + tag + '-x64.dmg' },
            { name: 'Moodboard-' + tag + '-arm64.dmg', size: 0, url: dl + 'Moodboard-' + tag + '-arm64.dmg' }
          ]
        };
        pending = isNewer(latest.tag, currentVersion());
        refreshVersionChip();
        return { update: pending, current: currentVersion(), latest: latest };
      });
  }

  /* Interroge la dernière release du dépôt (API, puis dépôt brut en
   * repli). → Promise<{ update:boolean, current, latest, error? }> */
  function check() {
    return fetchJson(API + '/releases/latest')
      .then(
        function (rel) {
          latest = {
            tag: String(rel.tag_name || '').replace(/^v/i, ''),
            name: rel.name || '',
            notes: rel.body || '',
            url: rel.html_url || RELEASES_URL,
            publishedAt: rel.published_at || '',
            assets: (rel.assets || []).map(function (a) {
              return { name: a.name, url: a.browser_download_url, size: a.size };
            })
          };
          pending = isNewer(latest.tag, currentVersion());
          refreshVersionChip();
          return { update: pending, current: currentVersion(), latest: latest };
        },
        function (err) {
          /* API indisponible (quota, réseau…) : repli silencieux. */
          return checkRaw().catch(function (err2) {
            return {
              update: false,
              current: currentVersion(),
              latest: null,
              error: String((err && err.message) || err) + ' / ' + String((err2 && err2.message) || err2)
            };
          });
        }
      )
      .catch(function (err) {
        return { update: false, current: currentVersion(), latest: null, error: String(err && err.message || err) };
      });
  }

  /* Vérification de DÉMARRAGE : à chaque lancement, si la machine est
   * connectée, on interroge les releases ; une nouvelle version déclenche
   * le popup de proposition. */
  function startupCheck() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return; // hors ligne
    setTimeout(function () {
      check().then(function (r) {
        if (r.error) {
          console.log('[Moodboard] Vérification de mise à jour impossible (' + r.error + ').');
          return;
        }
        if (r.update) notifyDialog(r.latest);
      });
    }, 1400);
  }

  /* Popup de démarrage : « une nouvelle version est disponible ». */
  function notifyDialog(info) {
    var notes = notesExcerpt(info.notes);
    MB.ui.dialog(
      '<div class="dialog-title">Mise à jour disponible</div>' +
      '<div class="dialog-body">' +
      '<p><strong>Moodboard ' + U.escapeHtml(info.tag) + '</strong> est disponible ' +
      (info.publishedAt ? '(' + U.escapeHtml(fmtDate(info.publishedAt)) + ') ' : '') +
      '— vous utilisez la version ' + U.escapeHtml(currentVersion()) +
      ' (' + U.escapeHtml(envLabel()) + ').</p>' +
      (notes
        ? '<div class="field-label" style="margin-top:10px">Nouveautés</div>' +
          '<pre class="upd-notes">' + U.escapeHtml(notes) + '</pre>'
        : '') +
      '</div>',
      [
        { label: 'Plus tard', value: false, kind: 'ghost' },
        { label: 'Mettre à jour maintenant', value: true, kind: 'primary' }
      ]
    ).then(function (go) {
      if (go) runUpdate();
    });
  }

  /* ------------------------------------------- dialogue manuel (version) */

  /* Clic sur le numéro de version (barre d'état) : état + vérification +
   * mise à jour manuelle de l'application / de l'extension. */
  function dialog() {
    var box = null;
    var closeDlg = null;

    function render(state) {
      /* state: 'idle' | 'checking' | 'known' */
      var l = latest;
      var html =
        '<div class="dialog-title">Mises à jour</div>' +
        '<div class="dialog-body">' +
        '<div class="upd-row"><span class="upd-key">Version installée</span>' +
        '<strong>v' + U.escapeHtml(currentVersion()) + '</strong></div>' +
        '<div class="upd-row"><span class="upd-key">Environnement</span>' +
        '<span>' + U.escapeHtml(envLabel()) + '</span></div>' +
        '<div class="upd-row"><span class="upd-key">Dernière version</span>' +
        (state === 'checking'
          ? '<span class="upd-dim">vérification en cours…</span>'
          : l
            ? '<strong class="' + (pending ? 'upd-new' : '') + '">v' + U.escapeHtml(l.tag) + '</strong>' +
              (l.publishedAt ? ' <span class="upd-dim">(' + U.escapeHtml(fmtDate(l.publishedAt)) + ')</span>' : '')
            : '<span class="upd-dim">inconnue</span>') +
        '</div>';

      if (state !== 'checking' && l) {
        if (pending) {
          var notes = notesExcerpt(l.notes);
          html +=
            '<div class="upd-available">Une nouvelle version est disponible.</div>' +
            (notes ? '<div class="field-label" style="margin-top:8px">Nouveautés</div><pre class="upd-notes">' + U.escapeHtml(notes) + '</pre>' : '');
        } else {
          html += '<div class="upd-ok">Vous êtes à jour.</div>';
        }
      }
      if (state !== 'checking' && !l) {
        html +=
          '<p class="upd-dim">Aucune information récupérée pour l‘instant — ' +
          'la vérification nécessite une connexion internet.</p>';
      }
      if (environment() === 'web') {
        html +=
          '<p class="upd-dim">Les mises à jour automatiques s‘appliquent à ' +
          'l‘application et à l‘extension Illustrator.</p>';
      }
      html += '</div>';

      /* actions */
      var actions = [];
      if (state !== 'checking') {
        if (pending) actions.push({ label: 'Mettre à jour maintenant', value: 'update', kind: 'primary' });
        actions.push({ label: 'Vérifier les mises à jour', value: 'check', kind: pending ? 'ghost' : 'primary' });
        actions.push({ label: 'Ouvrir la page des versions', value: 'page', kind: 'ghost' });
        actions.push({ label: 'Fermer', value: null, kind: 'ghost' });
      }
      html += '<div class="dialog-actions" id="upd-actions"></div>';
      box.innerHTML = html;

      var foot = box.querySelector('#upd-actions');
      actions.forEach(function (a) {
        var b = U.el(
          'button',
          'btn ' + (a.kind === 'primary' ? 'btn-primary' : 'btn-ghost'),
          a.label
        );
        b.type = 'button';
        b.addEventListener('click', function () {
          if (a.value === 'update') {
            closeDlg();
            runUpdate();
          } else if (a.value === 'check') {
            render('checking');
            check().then(function () {
              render('known');
            });
          } else if (a.value === 'page') {
            openReleasesPage();
          } else {
            closeDlg();
          }
        });
        foot.appendChild(b);
      });
    }

    MB.ui.dialog('', [], {
      bind: function (b, close) {
        box = b;
        closeDlg = close;
        render(latest ? 'known' : 'idle');
        if (!latest) {
          /* première ouverture : vérifie automatiquement. */
          render('checking');
          check().then(function () {
            render('known');
          });
        }
      }
    });
  }

  /* --------------------------------------------- progression à l'écran */

  /* Dialogue de progression piloté par update() : barre + libellés. */
  function progressDialog(opts) {
    /* opts: { title, label } — update(p) : { pct, detail, sub } */
    var box = null;

    function update(p) {
      if (!box) return;
      var fill = box.querySelector('.upd-fill');
      var pct = Math.max(0, Math.min(100, Math.round(p.pct || 0)));
      if (fill) fill.style.width = pct + '%';
      var pctEl = box.querySelector('.upd-pct');
      if (pctEl) pctEl.textContent = pct + ' %';
      var d = box.querySelector('.upd-detail');
      if (d && p.detail !== undefined) d.textContent = p.detail;
      var s = box.querySelector('.upd-sub');
      if (s && p.sub !== undefined) s.textContent = p.sub;
    }

    function fail(message) {
      if (!box) return;
      progressSink = null;
      running = false;
      box.innerHTML =
        '<div class="dialog-title">Échec de la mise à jour</div>' +
        '<div class="dialog-body"><p>' + U.escapeHtml(message) + '</p>' +
        '<p class="upd-dim">Vous pouvez réessayer plus tard (clic sur le numéro de version) ' +
        'ou télécharger manuellement la nouvelle version depuis la page des releases.</p></div>' +
        '<div class="dialog-actions">' +
        '<button type="button" class="btn btn-ghost" data-a="page">Ouvrir la page</button>' +
        '<button type="button" class="btn btn-primary" data-a="close">Fermer</button>' +
        '</div>';
      bindFooter(box);
    }

    function bindFooter(b) {
      b.querySelector('[data-a="close"]').addEventListener('click', function () {
        if (b._close) b._close();
        else if (b.parentNode && b.parentNode.parentNode) b.parentNode.parentNode.removeChild(b.parentNode);
      });
      var pg = b.querySelector('[data-a="page"]');
      if (pg) pg.addEventListener('click', openReleasesPage);
    }

    var p = new Promise(function (resolve) {
      var dlg = MB.ui.dialog(
        '<div class="dialog-title">' + U.escapeHtml(opts.title) + '</div>' +
        '<div class="dialog-body">' +
        '<p class="upd-detail">' + U.escapeHtml(opts.label) + '</p>' +
        '<div class="upd-bar"><div class="upd-fill"></div></div>' +
        '<div class="upd-meta"><span class="upd-pct">0 %</span>' +
        '<span class="upd-sub"></span></div>' +
        '</div>',
        [],
        {
          bind: function (b, close) {
            box = b;
            b._close = close;
            /* Événements de progression du processus principal (application)
             * → ce dialogue tant qu'il est ouvert. */
            progressSink = update;
            resolve({ update: update, fail: fail, close: close });
          }
        }
      );
      void dlg;
    });
    return p;
  }

  /* ---------------------------------------------- mise à jour — bureau */

  function desktopAsset(platform, arch, assets) {
    var found = null;
    assets.forEach(function (a) {
      var n = a.name || '';
      if (platform === 'win32') {
        if (/^Moodboard-Setup-.*\.exe$/i.test(n)) found = a;
      } else if (platform === 'darwin') {
        if (arch === 'arm64' && /-arm64\.dmg$/i.test(n)) found = a;
        if (arch === 'x64' && /-x64\.dmg$/i.test(n)) found = a;
      }
    });
    return found;
  }

  /* `release` : infos de la release GitHub ; l'architecture vient du pont
   * desktop (api.info() — processus principal, fiable dès v1.7). */
  function updateDesktop(release, ui) {
    var platform = (MB.desktop && MB.desktop.platform) || '';

    var withArch = function (arch) {
      function go(asset) {
        var dir = (MB.storage.dataDir() || '') + '/updates';
        MB.storage.ensureDir(dir);
        ui.update({ pct: 2, detail: 'Téléchargement de ' + asset.name, sub: '' });
        MB.desktop
          .downloadUpdate(asset.url, dir)
          .then(function (r) {
            if (!r || r.err !== 0 || !r.path) {
              ui.fail('Le téléchargement de l‘installateur a échoué.');
              running = false;
              return;
            }
            ui.update({ pct: 100, detail: 'Téléchargement terminé', sub: fmtBytes(asset.size || 0) });
            /* Lancement de l'installateur, puis invitation à quitter. */
            var launch = MB.desktop.canLaunch
              ? MB.desktop.launch(r.path)
              : Promise.resolve({ err: 1 });
            launch.then(function (lr) {
              running = false;
              if (lr && lr.err === 0) {
                MB.ui.dialog(
                  '<div class="dialog-title">Mise à jour prête</div>' +
                  '<div class="dialog-body"><p>L‘installateur <strong>' + U.escapeHtml(asset.name) +
                  '</strong> a été lancé.</p><p>Quittez Moodboard pour laisser l‘installation se terminer, ' +
                  'puis rouvrez l‘application.</p></div>',
                  [
                    { label: 'Plus tard', value: false, kind: 'ghost' },
                    { label: 'Quitter Moodboard', value: true, kind: 'primary' }
                  ]
                ).then(function (quit) {
                  if (quit && MB.desktop.quit) MB.desktop.quit();
                });
              } else if (MB.desktop.canReveal) {
                MB.desktop.reveal(r.path);
                MB.ui.dialog(
                  '<div class="dialog-title">Installateur téléchargé</div>' +
                  '<div class="dialog-body"><p>L‘installateur <strong>' + U.escapeHtml(asset.name) +
                  '</strong> a été téléchargé et révélé dans son dossier.</p>' +
                  '<p>Double-cliquez-le pour installer la nouvelle version.</p></div>',
                  [{ label: 'Fermer', value: true, kind: 'primary' }]
                );
              } else {
                MB.ui.dialog(
                  '<div class="dialog-title">Installateur téléchargé</div>' +
                  '<div class="dialog-body"><p>Installateur : <code>' + U.escapeHtml(r.path) + '</code></p></div>',
                  [{ label: 'Fermer', value: true, kind: 'primary' }]
                );
              }
            });
          })
          .catch(function () {
            running = false;
            ui.fail('Le téléchargement de l‘installateur a échoué.');
          });
      }

      var asset = desktopAsset(platform, arch, release.assets);
      if (asset) {
        go(asset);
        return;
      }
      if (platform === 'darwin' && !arch) {
        /* Architecture inconnue (application antérieure au pont v1.7) :
         * choix explicite entre Apple Silicon et Intel. */
        var a64 = null;
        var x64 = null;
        release.assets.forEach(function (a) {
          if (/-arm64\.dmg$/i.test(a.name)) a64 = a;
          if (/-x64\.dmg$/i.test(a.name)) x64 = a;
        });
        if (a64 || x64) {
          ui.close();
          MB.ui.dialog(
            '<div class="dialog-title">Mise à jour — modèle de Mac</div>' +
            '<div class="dialog-body"><p>Quel est votre Mac ?</p></div>',
            [
              a64 ? { label: 'Apple Silicon (M1, M2, M3…)', value: a64, kind: 'primary' } : null,
              x64 ? { label: 'Intel', value: x64, kind: 'ghost' } : null
            ].filter(Boolean)
          ).then(function (chosen) {
            if (!chosen) {
              running = false;
              return;
            }
            running = true;
            progressDialog({
              title: 'Mise à jour de l‘application',
              label: 'Téléchargement de ' + chosen.name + '…'
            }).then(function (ui2) {
              go(chosen);
            });
          });
          return;
        }
      }
      ui.fail('Aucun installateur correspondant à cette machine n‘a été trouvé dans la release.');
    };

    /* Interroge le pont pour l'architecture (dmg x64/arm64). */
    if (MB.desktop.info) {
      MB.desktop.info().then(
        function (dinfo) {
          withArch((dinfo && dinfo.arch) || '');
        },
        function () {
          withArch('');
        }
      );
    } else {
      withArch('');
    }
  }

  /* --------------------------------------------- mise à jour — extension */

  function extensionDir() {
    try {
      var csi = MB.storage && MB.storage.cs ? MB.storage.cs() : null;
      if (csi && typeof SystemPath !== 'undefined') {
        var p = csi.getSystemPath(SystemPath.EXTENSION);
        if (typeof p === 'string' && (p.charAt(0) === '/' || /^[A-Za-z]:[\\/]/.test(p))) {
          return p.replace(/[\\/]+$/, '');
        }
      }
    } catch (e) {
      /* hors Illustrator */
    }
    return '';
  }

  var BIN_EXT = {
    png: 1, jpg: 1, jpeg: 1, gif: 1, webp: 1, bmp: 1, ico: 1, icns: 1,
    zip: 1, gz: 1, woff: 1, woff2: 1, ttf: 1, otf: 1
  };

  function isBinaryPath(p) {
    var m = String(p).toLowerCase().match(/\.([a-z0-9]+)$/);
    return !!(m && BIN_EXT[m[1]]);
  }

  function bufToBase64(buf) {
    var bytes = new Uint8Array(buf);
    var out = '';
    var CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    }
    return btoa(out);
  }

  function fetchRaw(url, binary) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return binary ? r.arrayBuffer() : r.text();
    });
  }

  /* Liste des fichiers du dépôt au tag donné.
   *   1. API git/trees de GitHub (informations complètes) ;
   *   2. repli : data.jsdelivr.com (CDN public, CORS ouvert, hors quota
   *      de l'API — utile quand la limite horaire 60 req/h/IP est
   *      atteinte) — arbre imbriqué aplati au même format.
   * → Promise<{ tree: [{ path, type, size }] }> */
  function fetchTree(tagRef) {
    return fetchJson(API + '/git/trees/' + tagRef + '?recursive=1').catch(function () {
      return fetch('https://data.jsdelivr.com/v1/packages/gh/' + REPO + '@' + tagRef, {
        cache: 'no-store'
      })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (root) {
          var flat = [];
          (function walk(nodes, prefix) {
            (nodes || []).forEach(function (n) {
              var p = prefix ? prefix + '/' + n.name : n.name;
              if (n.type === 'directory') walk(n.files, p);
              else if (n.type === 'file') flat.push({ path: p, type: 'blob', size: n.size || 0 });
            });
          })(root.files, '');
          return { tree: flat };
        });
    });
  }

  /* Télécharge et installe les fichiers de l'extension depuis le tag de
   * la release (arbre complet, filtré au dossier moodboard-cep/ —
   * exactement le contenu du zip officiel), puis propose le rechargement
   * du panneau. */
  function updateCep(info, ui) {
    var ext = extensionDir();
    if (!ext) {
      ui.fail('Le dossier d‘installation de l‘extension est introuvable.');
      return;
    }
    /* Le dossier d'installation est-il inscriptible ? */
    var probePath = ext + '/.update-probe';
    var probe = MB.storage.writeText(probePath, 'ok');
    if (probe.error) {
      ui.fail(
        'Le dossier de l‘extension n‘est pas accessible en écriture (' + probe.error +
        ') — installez la mise à jour manuellement depuis la page des versions.'
      );
      return;
    }
    try {
      MB.storage.readText(probePath);
    } catch (e) {
      /* non bloquant */
    }

    var tagRef = 'v' + info.tag;
    ui.update({ pct: 3, detail: 'Liste des fichiers de la release ' + tagRef + '…', sub: '' });

    fetchTree(tagRef)
      .then(function (tree) {
        var files = [];
        (tree.tree || []).forEach(function (t) {
          if (t.type !== 'blob') return;
          if (t.path.indexOf('moodboard-cep/') !== 0) return;
          var rel = t.path.slice('moodboard-cep/'.length);
          if (!rel || rel.indexOf('dist/') === 0 || rel.indexOf('scripts/') === 0) return;
          files.push({ rel: rel, size: t.size || 0 });
        });
        if (!files.length) throw new Error('aucun fichier trouvé dans le tag ' + tagRef);

        var total = files.reduce(function (acc, f) {
          return acc + f.size;
        }, 0);
        var done = 0;

        /* Téléchargement séquentiel : la progression reste lisible et
         * l'écriture des fichiers ne se mélange pas. */
        var chain = Promise.resolve();
        files.forEach(function (f) {
          chain = chain.then(function () {
            var bin = isBinaryPath(f.rel);
            return fetchRaw(RAW + '/' + tagRef + '/moodboard-cep/' + f.rel, bin).then(function (data) {
              var dest = ext + '/' + f.rel;
              var di = dest.lastIndexOf('/');
              if (di > 0) MB.storage.ensureDir(dest.slice(0, di));
              var w = bin
                ? MB.storage.writeFileAny(dest, bufToBase64(data), 'Base64')
                : MB.storage.writeText(dest, data);
              if (w && w.error) throw new Error('écriture impossible : ' + f.rel);
              done += f.size;
              ui.update({
                pct: 3 + (done / Math.max(total, 1)) * 92,
                detail: 'Installation de ' + f.rel,
                sub: fmtBytes(done) + ' / ' + fmtBytes(total)
              });
            });
          });
        });
        return chain;
      })
      .then(function () {
        try {
          /* sonde nettoyée */
          var csi = MB.storage.cs();
          if (window.cep && window.cep.fs && window.cep.fs.deleteFile) {
            window.cep.fs.deleteFile(probePath);
          }
          void csi;
        } catch (e) {
          /* non bloquant */
        }
        ui.update({ pct: 100, detail: 'Extension mise à jour', sub: '' });
        running = false;
        MB.ui.dialog(
          '<div class="dialog-title">Extension mise à jour</div>' +
          '<div class="dialog-body"><p>L‘extension Moodboard est passée en version <strong>' +
          U.escapeHtml(info.tag) + '</strong>.</p>' +
          '<p>Rechargez le panneau pour activer la nouvelle version ' +
          '(ou relancez Illustrator si nécessaire).</p></div>',
          [
            { label: 'Plus tard', value: false, kind: 'ghost' },
            { label: 'Recharger maintenant', value: true, kind: 'primary' }
          ]
        ).then(function (reload) {
          if (reload) {
            try {
              window.location.reload();
            } catch (e) {
              MB.ui.toast('Rechargez le panneau (ou Illustrator) pour activer la mise à jour.', 'info');
            }
          }
        });
      })
      .catch(function (err) {
        running = false;
        ui.fail('La mise à jour de l‘extension a échoué (' + String(err && err.message ? err.message : err) + ').');
      });
  }

  /* ------------------------------------------------------- orchestration */

  function runUpdate() {
    if (running) {
      MB.ui.toast('Une mise à jour est déjà en cours.', 'info');
      return;
    }
    var env = environment();
    if (env === 'web') {
      /* Aperçu navigateur : rien à mettre à jour ici. */
      MB.ui.dialog(
        '<div class="dialog-title">Mises à jour</div>' +
        '<div class="dialog-body"><p>Cet aperçu navigateur ne se met pas à jour lui-même : ' +
        'les mises à jour s‘appliquent à l‘application de bureau et à l‘extension Illustrator.</p>' +
        '<p>Téléchargez la dernière version depuis la page des releases du dépôt.</p></div>',
        [
          { label: 'Fermer', value: false, kind: 'ghost' },
          { label: 'Ouvrir la page des versions', value: true, kind: 'primary' }
        ]
      ).then(function (open) {
        if (open) openReleasesPage();
      });
      return;
    }

    var start = function (info) {
      running = true;
      progressDialog({
        title: env === 'app' ? 'Mise à jour de l‘application' : 'Mise à jour de l‘extension',
        label: 'Préparation…'
      }).then(function (ui) {
        if (env === 'app') updateDesktop(info, ui);
        else updateCep(info, ui);
      });
    };

    if (latest) {
      start(latest);
      return;
    }
    check().then(function (r) {
      if (r.error || !r.latest) {
        MB.ui.toast('Vérification impossible — êtes-vous connecté à internet ?', 'error');
        return;
      }
      if (!r.update) {
        MB.ui.toast('Vous êtes déjà à jour (v' + currentVersion() + ').', 'success');
        return;
      }
      start(r.latest);
    });
  }

  /* ------------------------------------------------------------- init */

  function init() {
    /* Progression du téléchargement (application) : le processus
     * principal diffuse des événements ; le dialogue ouvert les affiche. */
    if (MB.desktop && MB.desktop.onUpdateProgress) {
      MB.desktop.onUpdateProgress(function (p) {
        if (progressSink) progressSink(p);
      });
    }
    refreshVersionChip();
  }

  MB.updater = {
    init: init,
    check: check,
    startupCheck: startupCheck,
    dialog: dialog,
    runUpdate: runUpdate,
    refreshVersionChip: refreshVersionChip,
    isPending: function () {
      return pending;
    }
  };
})();
