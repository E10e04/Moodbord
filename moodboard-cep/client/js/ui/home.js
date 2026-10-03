/* =========================================================================
 * home.js — Écran d'accueil de l'application de bureau (v1.3, design v1.5).
 *
 * Première vue de l'app autonome (Electron) au lieu du canvas :
 *   - barre latérale : Accueil (actif), Nouveau, Ouvrir, Importer,
 *     puis les vues Récents / Favoris / Corbeille, et Aide ;
 *   - en-tête : identité (logo officiel) + recherche instantanée
 *     (v1.5 : plus de bouton « Nouveau » ici — redondant avec la barre
 *     latérale et les actions rapides) ;
 *   - actions rapides : Nouveau moodboard / Ouvrir… / Démonstration ;
 *   - grille des fichiers récents (20 max) — miniature du tableau,
 *     date relative, nombre d'éléments, menu ⋯ (favori, corbeille,
 *     révéler dans le Finder/Explorateur) ;
 *   - carte « Reprendre la session » si un travail non enregistré
 *     attend dans l'autosave.
 *
 * Inactif dans le panneau CEP et dans le navigateur (l'autosave y est
 * restauré directement) — sauf mode aperçu web `?home=1` qui montre
 * l'écran avec des données de démonstration pour visualiser le design.
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  /* v1.9 — écran d'accueil localisé. */
  function T(k, v) {
    return MB.i18n ? MB.i18n.t(k, v) : k;
  }

  var root = null;
  var gridEl = null;
  var emptyEl = null;
  var countEl = null;
  var titleEl = null;
  var searchEl = null;
  var open_ = false;

  var view = 'recents'; // 'recents' | 'fav' | 'trash'
  var query = '';
  var previewMode = false; // web ?home=1 : données de démonstration

  /* ==================================================== dates relatives */

  function relDate(iso) {
    var t = Date.parse(iso);
    if (!t) return '';
    var min = Math.floor((Date.now() - t) / 60000);
    if (min < 1) return 'à l‘instant';
    if (min < 60) return 'il y a ' + min + ' min';
    var h = Math.floor(min / 60);
    if (h < 24) return 'il y a ' + h + ' h';
    var j = Math.floor(h / 24);
    if (j === 1) return 'hier';
    if (j < 7) return 'il y a ' + j + ' jours';
    try {
      return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return '';
    }
  }

  /* ============================================== aperçu web (?home=1) */

  function svgThumb(inner) {
    return (
      'data:image/svg+xml;charset=utf-8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">' +
          inner +
          '</svg>'
      )
    );
  }

  /* Trois tableaux de démonstration reproduisant les cartes du design. */
  var THUMB_BRANDING = svgThumb(
    '<rect width="320" height="200" fill="#E9DFCC"/>' +
      '<rect x="16" y="16" width="104" height="168" rx="12" fill="#B98A5E"/>' +
      '<path d="M16 130 C 50 108 92 162 120 118 V172 a12 12 0 0 1-12 12 H28 a12 12 0 0 1-12-12 Z" fill="#8A6F4B" opacity="0.5"/>' +
      '<circle cx="38" cy="40" r="7" fill="#E9DFCC" opacity="0.85"/>' +
      '<rect x="136" y="16" width="84" height="80" rx="10" fill="#5C6B4C"/>' +
      '<rect x="136" y="106" width="84" height="78" rx="10" fill="#3E4637"/>' +
      '<rect x="234" y="18" width="70" height="8" rx="4" fill="#453E33"/>' +
      '<rect x="234" y="34" width="52" height="8" rx="4" fill="#453E33" opacity="0.55"/>' +
      '<rect x="234" y="50" width="60" height="8" rx="4" fill="#453E33" opacity="0.3"/>' +
      '<circle cx="250" cy="102" r="16" fill="#D9C7A7"/>' +
      '<circle cx="284" cy="102" r="16" fill="#6B7A55"/>' +
      '<circle cx="250" cy="136" r="16" fill="#B9805B"/>' +
      '<circle cx="284" cy="136" r="16" fill="#3F3A31"/>' +
      '<rect x="234" y="162" width="70" height="22" rx="8" fill="#F3EBDB"/>'
  );
  var THUMB_PALETTE = svgThumb(
    '<rect width="320" height="200" fill="#E7E2D6"/>' +
      '<text x="26" y="100" font-family="Georgia, Times, serif" font-size="86" font-weight="700" fill="#3E3A31">Aa</text>' +
      '<text x="28" y="130" font-family="Georgia, Times, serif" font-size="13" fill="#7A7362">Baskerville — titres</text>' +
      '<rect x="166" y="18" width="138" height="27" rx="8" fill="#6B7A55"/>' +
      '<rect x="166" y="51" width="138" height="27" rx="8" fill="#B9805B"/>' +
      '<rect x="166" y="84" width="138" height="27" rx="8" fill="#D9C7A7"/>' +
      '<rect x="166" y="117" width="138" height="27" rx="8" fill="#3F4A3C"/>' +
      '<rect x="166" y="150" width="138" height="27" rx="8" fill="#8A6F4B"/>'
  );
  var THUMB_REFS = svgThumb(
    '<rect width="320" height="200" fill="#E2E0DA"/>' +
      '<rect x="14" y="14" width="92" height="94" rx="10" fill="#6E7B74"/>' +
      '<rect x="114" y="14" width="92" height="126" rx="10" fill="#4C8DFF"/>' +
      '<rect x="214" y="14" width="92" height="64" rx="10" fill="#9AA1A8"/>' +
      '<rect x="14" y="118" width="92" height="68" rx="10" fill="#B7AFA2"/>' +
      '<rect x="214" y="86" width="92" height="100" rx="10" fill="#565E66"/>' +
      '<rect x="126" y="150" width="72" height="32" rx="6" fill="#F6F3EC"/>' +
      '<rect x="134" y="158" width="46" height="4" rx="2" fill="#B5AFA4"/>' +
      '<rect x="134" y="168" width="36" height="4" rx="2" fill="#B5AFA4"/>'
  );

  var previewActive = [];
  var previewTrash = [];

  function seedPreview() {
    var now = Date.now();
    function iso(ms) {
      return new Date(now - ms).toISOString();
    }
    previewActive = [
      { path: '/Aperçu/Branding-2025.moodboard', name: 'Branding - 2025', savedAt: iso(2 * 36e5), count: 12, fav: true, thumb: THUMB_BRANDING },
      { path: '/Aperçu/Palette-typo.moodboard', name: 'Palette & Typo', savedAt: iso(26 * 36e5), count: 8, thumb: THUMB_PALETTE },
      { path: '/Aperçu/References-visuelles.moodboard', name: 'Références visuelles', savedAt: iso(3 * 864e5), count: 17, thumb: THUMB_REFS }
    ];
    previewTrash = [];
  }

  function isPreviewQuery() {
    try {
      return /[?&]home=1(?![0-9])/.test(window.location.search);
    } catch (e) {
      return false;
    }
  }

  /* ======================================================= données vues */

  function dirOf(p) {
    var s = String(p || '');
    var k = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
    return k > 0 ? s.slice(0, k) : s;
  }

  function matchesQuery(it) {
    if (!query) return true;
    var q = query.toLowerCase();
    return (
      String(it.name || '').toLowerCase().indexOf(q) >= 0 ||
      String(it.path || '').toLowerCase().indexOf(q) >= 0
    );
  }

  function currentList() {
    var list;
    if (previewMode) {
      list =
        view === 'trash'
          ? previewTrash.slice()
          : view === 'fav'
            ? previewActive.filter(function (x) {
                return x.fav;
              })
            : previewActive.slice();
    } else {
      list = MB.storage.recentList(view);
    }
    return list.filter(matchesQuery);
  }

  /* L'autosave contient-il un travail reprise de session ? */
  function sessionDoc() {
    if (!MB.storage.hasAutosave()) return null;
    var r = MB.storage.loadAutosave();
    if (!r || r.error || !r.doc) return null;
    if (!r.doc.elements || !r.doc.elements.length) return null;
    return r.doc;
  }

  /* ================================================== rendu des cartes */

  function cardHtml(it, extra) {
    var inTrash = view === 'trash';
    var fav = !!it.fav && !inTrash;
    var thumb = it.thumb
      ? '<img class="home-card-img" src="' +
        it.thumb +
        '" alt="" draggable="false">'
      : '<span class="home-card-ph" aria-hidden="true">' + MB.icons.get('layers', 26) + '</span>';
    var meta = inTrash
      ? (it.trashedAt ? T('home.trashed', { d: relDate(it.trashedAt) }) : '')
      : (it.savedAt ? relDate(it.savedAt) : '') +
        (typeof it.count === 'number' ? ' · ' + it.count + ' ' + T('home.element') + (it.count > 1 ? 's' : '') : '');
    return (
      '<div class="home-card' + (extra || '') + '" data-path="' +
      U.escapeHtml(it.path || '') + '" title="' + U.escapeHtml(it.path || '') + '" role="button" tabindex="0" ' +
      'aria-label="Ouvrir ' + U.escapeHtml(it.name || 'le projet') + '">' +
      '<div class="home-card-thumb">' + thumb +
      (fav ? '<span class="home-card-fav" title="Favori" aria-hidden="true">' + MB.icons.get('starFill', 13) + '</span>' : '') +
      '</div>' +
      '<div class="home-card-info">' +
      '<span class="home-card-icn" aria-hidden="true">' + MB.icons.get(inTrash ? 'trash' : 'file', 14) + '</span>' +
      '<span class="home-card-name">' + U.escapeHtml(it.name || 'Sans titre') + '</span>' +
      '<button class="home-card-menu" type="button" aria-label="Actions pour ' +
      U.escapeHtml(it.name || 'ce projet') + '" aria-haspopup="menu">' +
      MB.icons.get('moreV', 15) + '</button>' +
      '</div>' +
      '<div class="home-card-meta">' + U.escapeHtml(meta) + '</div>' +
      '</div>'
    );
  }

  function sessionCardHtml(doc) {
    var n = (doc.elements || []).length;
    return (
      '<div class="home-card home-card--session" data-path="" ' +
      'title="Restaurer le travail en cours (autosave)" role="button" tabindex="0" ' +
      'aria-label="Reprendre la session en cours">' +
      '<div class="home-card-thumb home-card-thumb--session">' +
      MB.icons.get('refresh', 30) + '</div>' +
      '<div class="home-card-info">' +
      '<span class="home-card-icn" aria-hidden="true">' + MB.icons.get('refresh', 14) + '</span>' +
      '<span class="home-card-name">' + T('home.session') + '</span>' +
      '</div>' +
      '<div class="home-card-meta">' + U.escapeHtml(doc.name || 'Sans titre') +
      ' · ' + n + ' ' + T('home.element') + (n > 1 ? 's' : '') + ' · ' + T('home.sessionSub') + '</div>' +
      '</div>'
    );
  }

  function emptyHtml() {
    var icon = view === 'trash' ? 'trash' : view === 'fav' ? 'star' : 'layers';
    var main, sub;
    if (query) {
      main = T('home.noResults', { q: U.escapeHtml(query) });
      sub = T('home.noResultsSub');
    } else if (view === 'fav') {
      main = T('home.noFav');
      sub = T('home.noFavSub');
    } else if (view === 'trash') {
      main = T('home.noTrash');
      sub = T('home.noTrashSub');
    } else {
      main = T('home.noRecent');
      sub = T('home.noRecentSub');
    }
    return (
      '<div class="home-empty-icn" aria-hidden="true">' + MB.icons.get(icon, 26) + '</div>' +
      '<p class="home-empty-main">' + main + '</p>' +
      '<p class="home-empty-sub">' + sub + '</p>'
    );
  }

  function viewLabels() {
    if (view === 'fav') return { title: T('home.favorites'), unit: T('home.favorite') };
    if (view === 'trash') return { title: T('home.trash'), unit: T('home.entry') };
    return { title: T('home.recents'), unit: T('home.file') };
  }

  function render() {
    closeMenu();
    var list = currentList();
    var doc = view === 'recents' && !query ? sessionDoc() : null;

    var html = '';
    if (doc) html += sessionCardHtml(doc);
    for (var i = 0; i < list.length; i++) html += cardHtml(list[i], view === 'trash' ? ' home-card--trashed' : '');
    gridEl.innerHTML = html;

    var n = list.length;
    var lbl = viewLabels();
    titleEl.textContent = lbl.title;
    countEl.textContent = n ? n + ' ' + lbl.unit + (n > 1 ? 's' : '') : '';
    emptyEl.hidden = n > 0 || !!doc;
    if (!emptyEl.hidden) emptyEl.innerHTML = emptyHtml();

    /* barre latérale : état courant des vues */
    root.querySelectorAll('.js-home-view').forEach(function (b) {
      b.classList.toggle('is-current', b.getAttribute('data-view') === view);
    });

    bindCards();
  }

  function bindCards() {
    gridEl.querySelectorAll('.home-card').forEach(function (node) {
      node.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('.home-card-menu')) return;
        activate(node);
      });
      node.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate(node);
        }
      });
      var menu = node.querySelector('.home-card-menu');
      if (menu) {
        menu.addEventListener('click', function (e) {
          e.stopPropagation();
          cardMenu(menu, node);
        });
      }
    });
  }

  function activate(node) {
    /* Un clic qui vient de refermer un menu ne déclenche pas la carte. */
    if (Date.now() - menuClosedAt < 350) return;
    var p = node.getAttribute('data-path');
    if (p) {
      if (previewMode) {
        openDemoFromHome();
      } else {
        /* Fichier récent : ouverture par chemin (toast d'erreur géré). */
        MB.storage.openPath(p);
      }
    } else {
      /* Carte « reprendre la session ». */
      var r = MB.storage.loadAutosave();
      if (r && r.doc) MB.storage.openFile(r.doc, null);
    }
  }

  /* ===================================================== menus (kebab) */

  var menuEl = null;
  var menuCloser = null;
  var menuClosedAt = 0; // un clic EXTERIEUR qui referme un menu n'active pas la carte dessous

  function closeMenu() {
    if (menuEl) {
      menuEl.remove();
      menuEl = null;
    }
    if (menuCloser) {
      document.removeEventListener('pointerdown', menuCloser, true);
      window.removeEventListener('keydown', menuCloser, true);
      menuCloser = null;
    }
  }

  function openMenu(anchor, items) {
    closeMenu();
    menuEl = U.el('div', 'home-menu');
    menuEl.setAttribute('role', 'menu');
    items.forEach(function (it) {
      if (it === '-') {
        menuEl.appendChild(U.el('div', 'home-menu-sep'));
        return;
      }
      var b = U.el(
        'button',
        'home-menu-item' + (it.danger ? ' home-menu-item--danger' : '')
      );
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      b.innerHTML =
        (it.icon ? '<span class="home-menu-icn" aria-hidden="true">' + MB.icons.get(it.icon, 15) + '</span>' : '') +
        '<span>' + U.escapeHtml(it.label) + '</span>';
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        closeMenu();
        it.action();
      });
      menuEl.appendChild(b);
    });
    document.body.appendChild(menuEl);

    /* Ancrage : coin bas-droit du bouton, borné au viewport. */
    var r = anchor.getBoundingClientRect();
    menuEl.style.visibility = 'hidden';
    menuEl.style.left = '0px';
    menuEl.style.top = '0px';
    var mw = menuEl.offsetWidth || 180;
    var mh = menuEl.offsetHeight || 120;
    var x = Math.min(r.right - mw, window.innerWidth - mw - 10);
    var y = r.bottom + 6;
    if (y + mh > window.innerHeight - 10) y = Math.max(10, r.top - mh - 6);
    menuEl.style.left = Math.max(10, x) + 'px';
    menuEl.style.top = y + 'px';
    menuEl.style.visibility = '';

    /* Fermeture : appui extérieur ou Échap.
     * (keydown sur window : un événement dispatché directement sur window
     * ne traverse jamais les listeners de document.) */
    menuCloser = function (e) {
      if (menuEl && e.type === 'keydown') {
        if (e.key === 'Escape') {
          e.stopPropagation();
          closeMenu();
          if (anchor && anchor.focus) anchor.focus();
        }
        return;
      }
      if (
        menuEl &&
        !menuEl.contains(e.target) &&
        !(anchor && anchor.contains && anchor.contains(e.target))
      ) {
        /* Clic extérieur : le menu seul absorbe ce geste — la carte
         * dessous ne s'active pas. */
        closeMenu();
        menuClosedAt = Date.now();
      }
    };
    document.addEventListener('pointerdown', menuCloser, true);
    window.addEventListener('keydown', menuCloser, true);
  }

  /* Actions communes carte (favori / corbeille / restauration) —
   * réparties entre le mode aperçu (données locales) et le stockage
   * réel de l'application. */
  function actOnEntry(path, kind) {
    if (previewMode) {
      if (kind === 'fav') {
        previewActive.forEach(function (x) {
          if (x.path === path) x.fav = !x.fav;
        });
      } else if (kind === 'trash') {
        for (var i = 0; i < previewActive.length; i++) {
          if (previewActive[i].path === path) {
            var e = previewActive.splice(i, 1)[0];
            e.trashedAt = new Date().toISOString();
            previewTrash.unshift(e);
            break;
          }
        }
      } else if (kind === 'restore') {
        for (var j = 0; j < previewTrash.length; j++) {
          if (previewTrash[j].path === path) {
            var e2 = previewTrash.splice(j, 1)[0];
            delete e2.trashedAt;
            previewActive.unshift(e2);
            break;
          }
        }
      } else if (kind === 'delete') {
        previewTrash = previewTrash.filter(function (x) {
          return x.path !== path;
        });
      }
      render();
      return;
    }
    if (kind === 'fav') MB.storage.toggleRecentFav(path);
    else if (kind === 'trash') MB.storage.trashRecent(path);
    else if (kind === 'restore') MB.storage.restoreRecent(path);
    else if (kind === 'delete') MB.storage.deleteRecentForever(path);
    render();
  }

  function cardMenu(anchor, node) {
    var path = node.getAttribute('data-path') || '';
    if (view === 'trash') {
      openMenu(anchor, [
        { label: T('home.menuRestore'), icon: 'undo', action: function () {
            actOnEntry(path, 'restore');
            MB.ui.toast('Entrée restaurée', 'success');
          } },
        '-',
        { label: T('home.menuDelete'), icon: 'trash', danger: true, action: function () {
            actOnEntry(path, 'delete');
            MB.ui.toast('Entrée supprimée de la liste', 'success');
          } }
      ]);
      return;
    }
    var favNow = !!node.querySelector('.home-card-fav');
    var items = [
      {
        label: T('home.menuOpen'),
        icon: 'folder',
        action: function () {
          if (previewMode) openDemoFromHome();
          else MB.storage.openPath(path);
        }
      }
    ];
    if (!previewMode && MB.desktop && MB.desktop.canReveal && MB.storage.isDesktop()) {
      items.push({
        label: T('home.menuReveal'),
        icon: 'externalBox',
        action: function () {
          MB.desktop.reveal(path).then(function (r) {
            if (!r || r.err !== 0) MB.ui.toast('Ouverture du dossier impossible', 'error');
          });
        }
      });
    }
    items.push('-');
    items.push({
      label: favNow ? T('home.menuUnfav') : T('home.menuFav'),
      icon: 'star',
      action: function () {
        actOnEntry(path, 'fav');
        MB.ui.toast(favNow ? 'Retiré des favoris' : 'Ajouté aux favoris', 'success');
      }
    });
    items.push({
      label: T('home.menuTrash'),
      icon: 'trash',
      action: function () {
        actOnEntry(path, 'trash');
        MB.ui.toast('Retiré de la liste — restaurable depuis la corbeille', 'success');
      }
    });
    openMenu(anchor, items);
  }

  /* ========================================================= actions */

  function openDemoFromHome() {
    /* loadDoc + toast « Tableau de démonstration chargé » par loadDemo. */
    MB.app.loadDemo(false);
    hide();
  }

  /* Tableau vierge (avec garde autosave) puis continuation. */
  function withFreshBoard(then) {
    var doc = sessionDoc();

    function go() {
      if (MB.boards) MB.boards.reset();
      MB.store.loadDocument({ name: 'Sans titre', elements: [] });
      MB.camera.fit(null);
      MB.storage.markSaved();
      MB.storage.clearAutosave();
      hide();
      then();
    }

    if (!doc) {
      go();
      return;
    }
    MB.ui.confirmDialog({
      title: 'Nouveau moodboard',
      message: 'Le travail en cours (« ' + (doc.name || 'Sans titre') +
        ' ») n‘a pas été enregistré et sera perdu. Continuer ?',
      confirmLabel: 'Créer quand même',
      danger: true
    }).then(function (ok) {
      if (ok) go();
    });
  }

  function newBoard() {
    withFreshBoard(function () {
      MB.ui.toast('Nouveau tableau', 'success');
    });
  }

  /* « Importer » (barre latérale) : tableau vierge puis sélecteur
   * d'images du système. */
  function importImages() {
    withFreshBoard(function () {
      if (MB.interact && MB.interact.openImportPicker) {
        MB.interact.openImportPicker(null);
      }
    });
  }

  function switchView(v) {
    view = v;
    render();
  }

  function resetHome() {
    view = 'recents';
    query = '';
    if (searchEl) searchEl.value = '';
    render();
    var scroller = root && root.querySelector('.home-main');
    if (scroller) scroller.scrollTop = 0;
  }

  function helpMenu(anchor) {
    openMenu(anchor, [
      { label: T('menu.shortcuts'), icon: 'keyboard', action: function () {
          MB.ui.shortcutsDialog();
        } },
      { label: T('menu.diagnostics'), icon: 'info', action: function () {
          MB.ui.diagnosticsDialog();
        } },
      { label: T('menu.about'), icon: 'help', action: function () {
          MB.ui.aboutDialog();
        } }
    ]);
  }

  /* =========================================================== cycle */

  function buildDom() {
    root = U.el('div', '');
    root.id = 'home-screen';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Écran d‘accueil Moodboard');
    root.hidden = true;
    root.innerHTML =
      '<div class="home-shell">' +
      /* ---- barre latérale ---- */
      '<nav class="home-side" aria-label="Accueil Moodboard">' +
      '<div class="home-side-brand">' +
      '<span class="home-logo" aria-hidden="true">' +
      '<img src="assets/logo.png" alt="" width="24" height="24" draggable="false">' +
      '</span>' +
      '<span class="home-logo-name">Moodboard</span>' +
      '</div>' +
      '<div class="home-side-group">' +
      '<button class="home-side-item home-side-item--accent" type="button" aria-current="page">' +
      '<span class="hs-icn" aria-hidden="true">' + MB.icons.get('home', 17) + '</span><span>' + (T('menu.view') === 'View' ? 'Home' : 'Accueil') + '</span></button>' +
      '<button class="home-side-item js-home-new" type="button">' +
      '<span class="hs-icn" aria-hidden="true">' + MB.icons.get('plus', 17) + '</span><span>' + (MB.i18n && MB.i18n.lang() === 'en' ? 'New' : 'Nouveau') + '</span></button>' +
      '<button class="home-side-item js-home-open" type="button">' +
      '<span class="hs-icn" aria-hidden="true">' + MB.icons.get('folder', 17) + '</span><span>' + (MB.i18n && MB.i18n.lang() === 'en' ? 'Open' : 'Ouvrir') + '</span></button>' +
      '<button class="home-side-item js-home-import" type="button">' +
      '<span class="hs-icn" aria-hidden="true">' + MB.icons.get('upload', 17) + '</span><span>' + T('home.import') + '</span></button>' +
      '</div>' +
      '<div class="home-side-sep" role="separator"></div>' +
      '<div class="home-side-group">' +
      '<button class="home-side-item js-home-view" data-view="recents" type="button">' +
      '<span class="hs-icn" aria-hidden="true">' + MB.icons.get('clock', 17) + '</span><span>' + (MB.i18n && MB.i18n.lang() === 'en' ? 'Recent' : 'Récents') + '</span></button>' +
      '<button class="home-side-item js-home-view" data-view="fav" type="button">' +
      '<span class="hs-icn" aria-hidden="true">' + MB.icons.get('star', 17) + '</span><span>' + T('home.favorites') + '</span></button>' +
      '<button class="home-side-item js-home-view" data-view="trash" type="button">' +
      '<span class="hs-icn" aria-hidden="true">' + MB.icons.get('trash', 17) + '</span><span>' + T('home.trash') + '</span></button>' +
      '</div>' +
      '<div class="home-side-foot">' +
      '<button class="home-side-item js-home-help" type="button">' +
      '<span class="hs-icn" aria-hidden="true">' + MB.icons.get('help', 17) + '</span><span>' + T('home.help') + '</span></button>' +
      '</div>' +
      '</nav>' +
      /* ---- zone principale ---- */
      '<div class="home-main">' +
      '<div class="home-main-inner">' +
      '<header class="home-head">' +
      '<div class="home-head-id">' +
      '<img class="home-app-mark" src="assets/logo.png" alt="" width="46" height="46" draggable="false">' +
      '<div class="home-head-txt">' +
      '<h1 class="home-title">Moodboard</h1>' +
      '<p class="home-tagline">' + (MB.i18n && MB.i18n.lang() === 'en' ? 'Idea café — your spatial worktable' : 'Café des idées — votre table de travail spatiale') + '</p>' +
      '</div>' +
      '</div>' +
      '<div class="home-head-tools">' +
      '<label class="home-search">' +
      '<span class="hs-icn" aria-hidden="true">' + MB.icons.get('search', 15) + '</span>' +
      '<input id="home-search" type="search" placeholder="' + T('home.search') + '" ' +
      'aria-label="' + T('home.search') + '" autocomplete="off" spellcheck="false">' +
      '</label>' +
      '</div>' +
      '</header>' +
      '<div class="home-actions">' +
      '<button class="home-btn home-btn--primary" id="home-new" type="button">' +
      MB.icons.get('plus', 15) + '<span>' + T('home.newBoard') + '</span></button>' +
      '<button class="home-btn" id="home-open" type="button">' +
      MB.icons.get('folder', 15) + '<span>' + T('menu.open') + '</span></button>' +
      '<button class="home-btn" id="home-demo" type="button">' +
      MB.icons.get('sparkle', 15) + '<span>' + (MB.i18n && MB.i18n.lang() === 'en' ? 'Load demo board' : 'Charger la démonstration') + '</span></button>' +
      '</div>' +
      '<div class="home-recents-head">' +
      '<span class="home-sub" id="home-section-title">' + T('home.recents') + '</span>' +
      '<span class="home-count" id="home-count"></span>' +
      '</div>' +
      '<div class="home-grid" id="home-grid"></div>' +
      '<div class="home-empty" id="home-empty" hidden></div>' +
      '</div>' +
      '</div>' +
      '</div>';

    gridEl = root.querySelector('#home-grid');
    emptyEl = root.querySelector('#home-empty');
    countEl = root.querySelector('#home-count');
    titleEl = root.querySelector('#home-section-title');
    searchEl = root.querySelector('#home-search');

    /* Actions rapides (boutons historiques v1.3). */
    root.querySelector('#home-new').addEventListener('click', newBoard);
    root.querySelector('#home-open').addEventListener('click', function () {
      MB.storage.open();
    });
    root.querySelector('#home-demo').addEventListener('click', function () {
      openDemoFromHome('Tableau de démonstration chargé');
    });

    /* Déclencheurs multiples : barre latérale (v1.5 : l'en-tête n'a plus
     * de bouton Nouveau — il restait redondant avec les trois autres). */
    root.querySelectorAll('.js-home-new').forEach(function (b) {
      b.addEventListener('click', newBoard);
    });
    root.querySelectorAll('.js-home-open').forEach(function (b) {
      b.addEventListener('click', function () {
        MB.storage.open();
      });
    });
    root.querySelector('.js-home-import').addEventListener('click', importImages);
    root.querySelector('.js-home-help').addEventListener('click', function (e) {
      helpMenu(e.currentTarget);
    });
    root.querySelectorAll('.js-home-view').forEach(function (b) {
      b.addEventListener('click', function () {
        switchView(b.getAttribute('data-view'));
      });
    });
    root.querySelector('.home-side-item--accent').addEventListener('click', resetHome);

    searchEl.addEventListener('input', function () {
      query = searchEl.value.trim();
      render();
    });

    document.body.appendChild(root);
  }

  function init() {
    /* Écran d'accueil : application de bureau uniquement (ou aperçu web
     * explicite ?home=1 pour visualiser le design). */
    if (!MB.storage.isDesktop() && !isPreviewQuery()) return;
    if (!root) buildDom();
  }

  /* Appelé par firstRun() : en mode bureau, l'application démarre sur
   * l'accueil (ni autosave ni démo ne sont chargés avant le choix). */
  function showAtBoot() {
    if (MB.storage.isDesktop()) {
      if (!root) buildDom();
      show();
      return true;
    }
    if (isPreviewQuery()) {
      previewMode = true;
      seedPreview();
      if (!root) buildDom();
      show();
      return true;
    }
    return false;
  }

  function show() {
    /* v1.6 — planches liées : réécrire l'arbre en mémoire avant de
     * recouvrir le canvas (les mutations de l'inspecteur « récents » ne
     * doivent jamais perdre le contenu d'une planche ouverte). */
    if (MB.boards) MB.boards.syncUp();
    if (!root) buildDom();
    render();
    root.hidden = false;
    open_ = true;
    /* Recherche prête à l'emploi — sans voler le focus aux champs de
     * dialogue (l'écran vient juste de s'ouvrir, rien n'est en cours). */
    try {
      if (searchEl && document.activeElement === document.body) searchEl.focus();
    } catch (e) {
      /* non bloquant */
    }
  }

  function hide() {
    if (!root) return;
    closeMenu();
    root.hidden = true;
    open_ = false;
  }

  function visible() {
    return !!(root && !root.hidden);
  }

  MB.ui = MB.ui || {};
  MB.ui.home = {
    init: init,
    showAtBoot: showAtBoot,
    show: show,
    hide: hide,
    visible: visible,
    newBoard: newBoard,
    /* Exposé pour diagnostics / harnais. */
    view: function () {
      return view;
    },
    isPreview: function () {
      return previewMode;
    }
  };
})();
