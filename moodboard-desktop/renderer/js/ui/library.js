/* =========================================================================
 * library.js — Bibliothèque latérale : médias importés, couleurs,
 * palettes, typographies. Chaque item se glisse sur le canvas.
 *
 * v1.13 — bibliothèque ÉDITABLE : les quatre onglets (Médias, Couleurs,
 * Palettes, Typo) acceptent des AJOUTS et des RETRAITS — y compris sur
 * les entrées intégrées et les ASSETS DE DÉMO (masqués, jamais détruits
 * : « Restaurer les images de démo » les ramène). L'état complet vit
 * dans library.json v2 (cf. storage.readLibraryFull/writeLibraryFull).
 * v1.14 — onglet FORMES retiré (les formes se créent avec l'outil Forme
 * de la barre d'outils ; la bibliothèque reste épurée).
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  /* v1.9 — bibliothèque localisée. */
  function T(k) {
    return MB.i18n ? MB.i18n.t(k) : k;
  }

  var TABS = [
    { id: 'media', key: 'lib.media' },
    { id: 'colors', key: 'lib.colors' },
    { id: 'palettes', key: 'lib.palettes' },
    { id: 'fonts', key: 'lib.fonts' }
  ];

  var COLORS = [
    '#7A522E', '#B0673F', '#E4D0B8', '#2B2B2B', '#F5F1EA',
    '#4C8DFF', '#7CC4FF', '#2E5A88', '#9DB2CE', '#1E1E1E',
    '#F7D46A', '#F2A93B', '#D96C3F', '#A63D2F', '#5C2E2E',
    '#8A9B7E', '#5F7161', '#C9D2B8', '#3E5641', '#1F2E23'
  ];

  var PALETTES = [
    {
      name: 'Old Copper',
      colors: [
        { hex: '#7A522E', name: 'Old Copper' },
        { hex: '#B0673F', name: 'Terracotta' },
        { hex: '#E4D0B8', name: 'Sable' },
        { hex: '#2B2B2B', name: 'Charbon' },
        { hex: '#F5F1EA', name: 'Ivoire' }
      ]
    },
    {
      name: 'Atelier Nord',
      colors: [
        { hex: '#22303B', name: 'Fjord' },
        { hex: '#48606E', name: 'Ardoise' },
        { hex: '#9DB2CE', name: 'Brume' },
        { hex: '#E8EDF2', name: 'Papier' },
        { hex: '#C25E4E', name: 'Brique' }
      ]
    },
    {
      name: 'Jardin Sec',
      colors: [
        { hex: '#5F7161', name: 'Sauge' },
        { hex: '#8A9B7E', name: 'Olivier' },
        { hex: '#C9D2B8', name: 'Avoine' },
        { hex: '#3E5641', name: 'If' },
        { hex: '#F0EEE4', name: 'Craie' }
      ]
    },
    {
      name: 'Café Crème',
      colors: [
        { hex: '#3B2B20', name: 'Expresso' },
        { hex: '#6F4E37', name: 'Café' },
        { hex: '#A9745B', name: 'Cannelle' },
        { hex: '#D9B99B', name: 'Crème' },
        { hex: '#F1E5D0', name: 'Lait' }
      ]
    },
    {
      name: 'Nuit Chaude',
      colors: [
        { hex: '#1F1626', name: 'Minuit' },
        { hex: '#4A2C4A', name: 'Prune' },
        { hex: '#9C4F7C', name: 'Baie' },
        { hex: '#E08D6D', name: 'Corail' },
        { hex: '#F6C7A8', name: 'Pêche' }
      ]
    },
    {
      name: 'Studio Gris',
      colors: [
        { hex: '#111111', name: 'Encre' },
        { hex: '#3A3A3A', name: 'Graphite' },
        { hex: '#6E6E6E', name: 'Acier' },
        { hex: '#A8A8A8', name: 'Béton' },
        { hex: '#EDEDED', name: 'Papier' }
      ]
    },
    {
      name: 'Papier Frais',
      colors: [
        { hex: '#F4F7F5', name: 'Blanc' },
        { hex: '#DCE8E1', name: 'Menthe' },
        { hex: '#B7D3C1', name: 'Thé' },
        { hex: '#6B8F82', name: 'Sapin' },
        { hex: '#2F4A41', name: 'Forêt' }
      ]
    },
    {
      name: 'Ocre & Or',
      colors: [
        { hex: '#8C6A2F', name: 'Ocre' },
        { hex: '#C9A227', name: 'Or' },
        { hex: '#E8D48B', name: 'Paille' },
        { hex: '#5A4619', name: 'Terre' },
        { hex: '#FBF6E3', name: 'Ivoire' }
      ]
    }
  ];

  /* v1.15 — l'onglet Typo montre CINQ polices par défaut (une base
   * couvrante : serif, sans, narrow, display, mono) ; TOUTES les polices
   * de l'ordinateur restent à un clic — le bouton « Ajouter une police »
   * ouvre le navigateur complet (recherche, aperçu en contexte, ajout).
   * Les familles ajoutées manuellement restent EN TÊTE ; hiddenFonts
   * masque n'importe laquelle (ré-ajouter le même nom la fait revenir). */
  var DEFAULT_FONTS = [
    'Georgia', 'Arial', 'Times New Roman', 'Verdana', 'Courier New'
  ];

  var FONTS = [
    'Georgia', 'Times New Roman', 'Palatino Linotype', 'Garamond',
    'Arial', 'Verdana', 'Trebuchet MS', 'Tahoma',
    'Courier New', 'Impact'
  ];

  /* Médias de démonstration embarqués (assets/demo) : peuplent
   * l'onglet Médias au démarrage pour que la bibliothèque offre du
   * contenu glissable dès l'ouverture — sinon l'onglet par défaut est
   * vide et « rien ne se dépose » depuis ce panneau.
   * v1.13 — retirables comme les autres (demande utilisateur :
   * « possibilité de supprimer même s'il s'agit des assets de démo »),
   * et restaurables d'un clic. */
  var DEMO_MEDIA = [
    { src: 'assets/demo/demo-photo.png', name: 'Photo — démo' },
    { src: 'assets/demo/demo-texture.png', name: 'Texture — démo' },
    { src: 'assets/demo/demo-logo.png', name: 'Logo — démo' },
    { src: 'assets/demo/demo-editorial.png', name: 'Éditorial — démo' },
    { src: 'assets/demo/demo-packaging.png', name: 'Packaging — démo' }
  ];

  /* v1.13 — état COMPLET persisté (library.json v2) : ajouts ET retraits
   * de chaque onglet. `demoItems` reste une liste de session (les assets
   * se re-sèment au lancement — moins ceux qui sont masqués). */
  var state = {
    media: [],
    colors: [],
    hiddenColors: [],
    palettes: [],
    hiddenPalettes: [],
    fonts: [],
    hiddenFonts: [],
    hiddenDemo: []
  };
  var demoItems = []; // {src, w, h, name, demo} — session

  /* v1.11/v1.13 — bibliothèque PERSISTANTE : le fichier library.json du
   * dossier de données (partagé par l'application et l'extension) porte
   * tout l'état éditable ; repli localStorage en web. */
  function persist() {
    var ok = MB.storage.writeLibraryFull(state);
    if (!ok) {
      MB.ui.toast('Bibliothèque pleine — les plus anciennes images ont été retirées.', 'info');
    }
  }

  function activeTabId() {
    var active = document.querySelector('.lib-tab.is-active');
    return active ? active.dataset.tab : 'media';
  }

  function rerender() {
    render();
  }

  /* Bouton de suppression commun : visible au survol, le clic ne
   * déclenche NI le drag NI le placement (stopPropagation complet). */
  function attachDel(item, tip, onDelete) {
    var del = U.el('button', 'lib-del');
    del.type = 'button';
    del.title = tip || T('lib.deleteMedia');
    del.setAttribute('aria-label', del.title);
    del.innerHTML = MB.icons.get('x', 11);
    ['pointerdown', 'mousedown', 'click'].forEach(function (ev) {
      del.addEventListener(ev, function (e) {
        e.stopPropagation();
      });
    });
    del.addEventListener('click', function () {
      onDelete();
    });
    item.appendChild(del);
  }

  /* Barre d'ajout d'un onglet : bouton « + Ajouter… » (le sélecteur
   * dépend de l'onglet). */
  function addBar(labelKey, onAdd) {
    var bar = U.el('div', 'lib-add');
    var btn = U.el(
      'button',
      'lib-add-btn',
      MB.icons.get('plus', 13) + '<span>' + T(labelKey) + '</span>'
    );
    btn.type = 'button';
    btn.addEventListener('click', function () {
      onAdd(btn);
    });
    bar.appendChild(btn);
    return bar;
  }

  function seedDemoMedia() {
    DEMO_MEDIA.forEach(function (m) {
      if (state.hiddenDemo.indexOf(m.src) >= 0) return;
      for (var i = 0; i < demoItems.length; i++) {
        if (demoItems[i].src === m.src) return;
      }
      var img = new Image();
      img.onload = function () {
        demoItems.push({
          src: m.src,
          w: img.naturalWidth || 1024,
          h: img.naturalHeight || 1024,
          name: m.name,
          demo: true
        });
        if (activeTabId() === 'media') renderMedia();
      };
      img.onerror = function () {
        /* asset absent (installation partielle) : silencieux */
      };
      img.src = m.src;
    });
  }

  function bindDragItem(node, makeExtra, type, label) {
    // Couche adaptative pointer + souris (cf. utils.js) : le drag depuis
    // la bibliothèque fonctionne même dans les moteurs CEP qui ne
    // livrent pas les Pointer Events.
    U.bindPointerWithMouse(node, 'down', function (e) {
      if (e.button !== 0) return;
      MB.ui.ghost.start(
        {
          sx: e.clientX,
          sy: e.clientY,
          label: label || ('lib:' + type),
          html: '<div class="ghost-card">' + node.dataset.ghostHtml + '</div>'
        },
        function (point) {
          var extra = makeExtra(point);
          MB.interact.createAt(type, point, extra);
        }
      );
    });
  }

  /* ------------------------------------------------------------ COULEURS */

  /* v1.13 — retraits : les couleurs intégrées retirées vivent dans
   * hiddenColors (elles reviennent si l'utilisateur ajoute le même
   * code). Les couleurs ajoutées arrivent EN TÊTE. */
  function visibleColors() {
    var shown = state.colors.slice();
    COLORS.forEach(function (hex) {
      if (state.hiddenColors.indexOf(hex) < 0 && shown.indexOf(hex) < 0) shown.push(hex);
    });
    return shown;
  }

  function addColor(hex) {
    var v = U.normalizeHex(hex);
    if (!v) return;
    if (COLORS.indexOf(v) >= 0) {
      if (state.hiddenColors.indexOf(v) < 0) {
        MB.ui.toast(T('lib.alreadyLib'), 'info');
        return;
      }
      state.hiddenColors = state.hiddenColors.filter(function (h) {
        return h !== v;
      });
      persist();
      if (activeTabId() === 'colors') renderColors();
      MB.ui.toast(T('lib.addedColor'), 'success');
      return;
    }
    if (state.colors.indexOf(v) < 0) state.colors.unshift(v);
    persist();
    if (activeTabId() === 'colors') renderColors();
    MB.ui.toast(T('lib.addedColor'), 'success');
  }

  function removeColor(hex) {
    if (COLORS.indexOf(hex) >= 0 && state.hiddenColors.indexOf(hex) < 0) {
      state.hiddenColors.push(hex);
    }
    state.colors = state.colors.filter(function (c) {
      return c !== hex;
    });
    persist();
    if (activeTabId() === 'colors') renderColors();
    MB.ui.toast(T('lib.removedColor'), 'success');
  }

  function renderColors() {
    var host = document.getElementById('lib-content');
    host.innerHTML = '<div class="lib-note">' + T('lib.dragColor') + '</div>';
    host.appendChild(addBar('lib.addColor', function (anchor) {
      var C = MB.ui.controls;
      if (C && C.colorPopover) C.colorPopover(anchor, '#4C8DFF', addColor);
    }));
    var shown = visibleColors();
    if (!shown.length) {
      host.appendChild(U.el('div', 'lib-note', T('lib.emptyTab')));
      return;
    }
    var grid = U.el('div', 'lib-grid lib-grid--colors');
    shown.forEach(function (hex) {
      var item = U.el('div', 'lib-color');
      item.style.background = hex;
      item.dataset.tip = hex.toUpperCase();
      item.setAttribute('aria-label', 'Couleur ' + hex);
      item.dataset.ghostHtml = '<span class="ghost-swatch" style="background:' + hex + '"></span>';
      bindDragItem(item, function () {
        return { hex: hex, name: colorName(hex) };
      }, 'color', 'lib:couleur ' + hex);
      item.addEventListener('click', function () {
        var center = MB.interact.canvasPoint({
          clientX: window.innerWidth / 2,
          clientY: window.innerHeight / 2
        });
        MB.interact.createAt('color', center, { hex: hex, name: colorName(hex) });
      });
      attachDel(item, T('lib.deleteMedia'), function () {
        removeColor(hex);
      });
      grid.appendChild(item);
    });
    host.appendChild(grid);
  }

  function colorName(hex) {
    var names = {
      '#7A522E': 'Old Copper', '#B0673F': 'Terracotta', '#E4D0B8': 'Sable',
      '#2B2B2B': 'Charbon', '#F5F1EA': 'Ivoire', '#4C8DFF': 'Bleu Focus',
      '#F7D46A': 'Papier jaune', '#F2A93B': 'Miel', '#D96C3F': 'Terracotta clair',
      '#A63D2F': 'Rouille', '#5C2E2E': 'Acajou', '#8A9B7E': 'Olivier',
      '#5F7161': 'Sauge', '#C9D2B8': 'Avoine', '#3E5641': 'If', '#1F2E23': 'Sapin'
    };
    return names[String(hex).toUpperCase()] || 'Couleur';
  }

  /* ------------------------------------------------------------ PALETTES */

  /* v1.13 — palettes : les créations de l'utilisateur d'abord, les
   * intégrées ensuite (moins celles retirées, moins celles écrasées
   * par une création du même nom). */
  function visiblePalettes() {
    var customs = state.palettes.slice();
    var shown = customs.slice();
    PALETTES.forEach(function (p) {
      if (state.hiddenPalettes.indexOf(p.name) >= 0) return;
      var claimed = false;
      customs.forEach(function (c) {
        if (c.name === p.name) claimed = true;
      });
      if (!claimed) shown.push(p);
    });
    return shown;
  }

  function addPalette(p) {
    if (!p || !Array.isArray(p.colors) || !p.colors.length) return;
    var name = String(p.name || '').trim() || T('lib.paletteDefault');
    var colors = [];
    p.colors.forEach(function (c) {
      var hex = U.normalizeHex(c && c.hex);
      if (hex) colors.push({ hex: hex, name: (c && c.name) || hex });
    });
    colors = colors.slice(0, 12);
    if (!colors.length) return;
    var builtin = null;
    PALETTES.forEach(function (b) {
      if (b.name === name) builtin = b;
    });
    if (builtin) {
      if (state.hiddenPalettes.indexOf(name) >= 0) {
        state.hiddenPalettes = state.hiddenPalettes.filter(function (n) {
          return n !== name;
        });
        persist();
        if (activeTabId() === 'palettes') renderPalettes();
        MB.ui.toast(T('lib.addedPalette'), 'success');
        return;
      }
      MB.ui.toast(T('lib.alreadyLib'), 'info');
      return;
    }
    var idx = -1;
    state.palettes.forEach(function (c, i) {
      if (c.name === name) idx = i;
    });
    if (idx >= 0) state.palettes[idx] = { name: name, colors: colors };
    else state.palettes.unshift({ name: name, colors: colors });
    persist();
    if (activeTabId() === 'palettes') renderPalettes();
    MB.ui.toast(T('lib.addedPalette'), 'success');
  }

  function removePalette(name) {
    var builtin = false;
    PALETTES.forEach(function (b) {
      if (b.name === name) builtin = true;
    });
    if (builtin && state.hiddenPalettes.indexOf(name) < 0) {
      state.hiddenPalettes.push(name);
    }
    state.palettes = state.palettes.filter(function (c) {
      return c.name !== name;
    });
    persist();
    if (activeTabId() === 'palettes') renderPalettes();
    MB.ui.toast(T('lib.removedPalette'), 'success');
  }

  /* Créateur de palette : nom + pastilles ajoutées au colorPopover,
   * une pastille se retire d'un clic. */
  function showPaletteCreator() {
    var host = document.getElementById('lib-content');
    host.innerHTML = '';
    host.appendChild(U.el('div', 'lib-note', T('lib.paletteHint')));

    var box = U.el('div', 'lib-creator');
    var nameIn = U.el('input', 'input lib-creator-name');
    nameIn.type = 'text';
    nameIn.maxLength = 40;
    nameIn.placeholder = T('lib.paletteNamePh');

    var picked = [];
    var chips = U.el('div', 'lib-creator-chips');
    function drawChips() {
      chips.innerHTML = '';
      picked.forEach(function (hex, i) {
        var c = U.el('button', 'lib-chip');
        c.type = 'button';
        c.style.background = hex;
        c.dataset.tip = T('lib.removeChip');
        c.setAttribute('aria-label', T('lib.removeChip') + ' ' + hex);
        c.addEventListener('click', function () {
          picked.splice(i, 1);
          drawChips();
        });
        chips.appendChild(c);
      });
      var addChip = U.el('button', 'lib-chip lib-chip--add');
      addChip.type = 'button';
      addChip.title = T('lib.addColor');
      addChip.setAttribute('aria-label', T('lib.addColor'));
      addChip.innerHTML = MB.icons.get('plus', 12);
      addChip.addEventListener('click', function () {
        var C = MB.ui.controls;
        if (C && C.colorPopover) {
          C.colorPopover(addChip, picked.length ? picked[picked.length - 1] : '#4C8DFF', function (hex) {
            var v = U.normalizeHex(hex);
            if (v && picked.indexOf(v) < 0) {
              picked.push(v);
              drawChips();
            }
          });
        }
      });
      chips.appendChild(addChip);
    }
    drawChips();

    var row = U.el('div', 'lib-creator-row');
    var ok = U.el('button', 'btn btn-primary', T('lib.create'));
    ok.type = 'button';
    ok.addEventListener('click', function () {
      if (!picked.length) {
        MB.ui.toast(T('lib.paletteNeedsColors'), 'info');
        return;
      }
      addPalette({
        name: nameIn.value,
        colors: picked.map(function (hex) {
          return { hex: hex, name: hex };
        })
      });
      renderPalettes();
    });
    var no = U.el('button', 'btn btn-ghost', T('dlg.cancel'));
    no.type = 'button';
    no.addEventListener('click', function () {
      renderPalettes();
    });
    row.appendChild(ok);
    row.appendChild(no);

    box.appendChild(nameIn);
    box.appendChild(chips);
    box.appendChild(row);
    host.appendChild(box);
    nameIn.focus();
  }

  function renderPalettes() {
    var host = document.getElementById('lib-content');
    host.innerHTML = '<div class="lib-note">' + T('lib.dragPalette') + '</div>';
    host.appendChild(addBar('lib.addPalette', function () {
      showPaletteCreator();
    }));
    var shown = visiblePalettes();
    if (!shown.length) {
      host.appendChild(U.el('div', 'lib-note', T('lib.emptyTab')));
      return;
    }
    var list = U.el('div', 'lib-list');
    shown.forEach(function (p) {
      var item = U.el('div', 'lib-item lib-palette');
      var strip = U.el('div', 'lib-palette-strip');
      p.colors.forEach(function (c) {
        var s = U.el('span', 'lib-palette-swatch');
        s.style.background = c.hex;
        strip.appendChild(s);
      });
      item.appendChild(U.el('div', 'lib-item-name', U.escapeHtml(p.name)));
      item.appendChild(strip);
      item.dataset.tip = p.name;
      item.dataset.ghostHtml =
        '<span class="ghost-palette">' + p.colors.map(function (c) {
          return '<i style="background:' + c.hex + '"></i>';
        }).join('') + '</span>';
      bindDragItem(item, function () {
        return { colors: U.deepClone(p.colors), name: p.name };
      }, 'palette', 'lib:palette ' + p.name);
      attachDel(item, T('lib.deleteMedia'), function () {
        removePalette(p.name);
      });
      list.appendChild(item);
    });
    host.appendChild(list);
  }

  /* ------------------------------------------------------------- TYPOS */

  /* v1.15 — CINQ polices par défaut : les familles ajoutées à la main
   * restent EN TÊTE, la base couvrante complète (plus TOUTE la liste du
   * système comme en v1.14.1 — elle vit dans le navigateur d'ajout).
   * Dédoublonnage insensible à la casse ; hiddenFonts masque n'importe
   * laquelle. */
  function visibleFonts() {
    var seen = {};
    var hidden = {};
    state.hiddenFonts.forEach(function (h) {
      hidden[String(h).toLowerCase()] = true;
    });
    var shown = [];
    function push(f) {
      var k = String(f || '').toLowerCase();
      if (!f || seen[k] || hidden[k]) return;
      seen[k] = true;
      shown.push(f);
    }
    state.fonts.forEach(push); /* familles ajoutées — en tête */
    DEFAULT_FONTS.forEach(push); /* la base de cinq */
    return shown;
  }

  function addFont(name, stay) {
    var f = String(name || '').trim();
    if (!f || f.length > 64) {
      MB.ui.toast(T('lib.fontNamePh'), 'info');
      return;
    }
    var lower = f.toLowerCase();
    /* v1.14.1 — ré-ajouter une famille masquée la RAMÈNE (police du
     * système retirée par erreur comme intégrée d'origine). */
    var wasHidden = state.hiddenFonts.some(function (x) {
      return x.toLowerCase() === lower;
    });
    if (wasHidden) {
      state.hiddenFonts = state.hiddenFonts.filter(function (x) {
        return x.toLowerCase() !== lower;
      });
      persist();
      if (activeTabId() === 'fonts' && !stay) renderFonts();
      MB.ui.toast(T('lib.addedFont'), 'success');
      return;
    }
    var dup = state.fonts.some(function (x) {
      return x.toLowerCase() === lower;
    });
    /* v1.15 — le modèle a changé : l'onglet ne montre PLUS toutes les
     * polices du système, donc tout ajout explicite rejoint la liste
     * (la vérification « known » de v1.14.1 n'a plus de raison d'être). */
    if (!dup) state.fonts.unshift(f);
    persist();
    /* v1.15 — `stay` : le navigateur de polices reste ouvert (le clic
     * ajoute SANS refermer — l'état « dans la bibliothèque » se met à
     * jour sur place). */
    if (activeTabId() === 'fonts' && !stay) renderFonts();
    MB.ui.toast(dup ? T('lib.fontAlready') : T('lib.addedFont'), dup ? 'info' : 'success');
  }

  function removeFont(name) {
    /* v1.14.1 — tout se retire (intégrée OU système) : le retrait est
     * un masquage — ré-ajouter le nom la ramène. */
    if (state.hiddenFonts.indexOf(name) < 0) state.hiddenFonts.push(name);
    state.fonts = state.fonts.filter(function (f) {
      return f !== name;
    });
    persist();
    if (activeTabId() === 'fonts') renderFonts();
    MB.ui.toast(T('lib.removedFont'), 'success');
  }

  /* v1.16 — le navigateur de polices : TOUTES les polices du SYSTÈME
   * (MB.fonts — Illustrator / application / liste web) dans une liste
   * défilante avec recherche instantanée et aperçu rendu dans chaque
   * famille. UN SEUL CLIC ajoute la police à la bibliothèque (feedback
   * immédiat : la ligne s'allume, la marque « dans la bibliothèque »
   * apparaît) ; les familles déjà présentes se montrent cochées
   * (re-cliquer ne les masque pas — le toast le dit). */
  function showFontCreator() {
    var host = document.getElementById('lib-content');
    host.innerHTML = '';
    host.appendChild(U.el('div', 'lib-note', T('lib.fontHint')));

    var box = U.el('div', 'lib-creator lib-font-picker');

    var search = U.el('input', 'input lib-font-search');
    search.type = 'text';
    search.maxLength = 64;
    search.placeholder = T('lib.fontSearch');
    search.setAttribute('aria-label', T('lib.fontSearch'));
    search.spellcheck = false;

    var list = U.el('div', 'lib-list lib-list--fonts lib-font-all');
    list.id = 'lib-font-all';

    function fontList() {
      if (MB.fonts && MB.fonts.isReady && MB.fonts.isReady() && MB.fonts.list().length) {
        return MB.fonts.list();
      }
      return FONTS.slice();
    }

    function renderAll() {
      var q = U.escapeHtml(search.value).toLowerCase();
      var fonts = fontList();
      var shown = 0;
      list.innerHTML = '';
      for (var i = 0; i < fonts.length; i++) {
        var f = fonts[i];
        if (q && f.toLowerCase().indexOf(q) < 0) continue;
        shown++;
        if (shown > 400) break;
        var inLib = visibleFonts().some(function (x) {
          return x.toLowerCase() === f.toLowerCase();
        });
        var item = U.el('button', 'lib-item lib-font lib-font-add' + (inLib ? ' is-in-lib' : ''));
        item.type = 'button';
        item.dataset.font = f;
        item.innerHTML =
          '<span class="lib-font-name">' + U.escapeHtml(f) + (inLib ? ' <span class="lib-font-in">' + U.escapeHtml(T('lib.fontInLib')) + '</span>' : '') + '</span>' +
          '<span class="lib-font-sample" style="font-family:\'' + U.escapeHtml(f) + '\'">Aa Bb Cc</span>';
        list.appendChild(item);
      }
      if (!shown) {
        list.innerHTML = '<div class="lib-note">' + T('lib.fontNoMatch') + '</div>';
      }
    }

    /* v1.16 — UN SEUL CLIC ajoute : l'écoute vit sur le CONTENEUR
     * (délégation) — elle survit aux reconstructions de la liste, et le
     * clavier (Enter/Espace natifs des <button>) marche pareil. */
    list.addEventListener('click', function (e) {
      var item = e.target && e.target.closest ? e.target.closest('.lib-font-add') : null;
      if (!item || !list.contains(item)) return;
      var name = item.dataset.font;
      var lower = String(name || '').toLowerCase();
      var wasIn = visibleFonts().some(function (x) {
        return x.toLowerCase() === lower;
      });
      addFont(name, true);
      renderAll();
      if (wasIn) return;
      /* feedback immédiat : la ligne fraîchement ajoutée s'allume. */
      var items = list.querySelectorAll('.lib-font-add');
      for (var k = 0; k < items.length; k++) {
        if (items[k].dataset.font === name) {
          items[k].classList.add('is-just-added');
          setTimeout(function (node) {
            return function () { node.classList.remove('is-just-added'); };
          }(items[k]), 750);
          break;
        }
      }
    });

    search.addEventListener('input', renderAll);
    /* l'énumération système arrive APRÈS l'ouverture : la liste se
     * complète dès qu'elle est prête.
     * v1.16 — mais JAMAIS pendant un clic : remplacer la liste sous le
     * pointeur détachait l'élément visé entre mousedown et mouseup — le
     * clic était perdu et il FALLAIT recliquer (le « double clic »
     * signalé). On attend que la liste ne soit plus :active (garde de
     * deux secondes au pire). */
    if (MB.fonts && MB.fonts.whenReady) {
      MB.fonts.whenReady(function () {
        if (document.getElementById('lib-font-all') !== list) return;
        var attempt = 0;
        (function paint() {
          if (document.getElementById('lib-font-all') !== list) return;
          if (attempt < 40 && list.matches(':active')) {
            attempt++;
            setTimeout(paint, 50);
            return;
          }
          renderAll();
        })();
      });
    }

    var back = U.el('button', 'btn btn-ghost lib-font-back', T('dlg.cancel'));
    back.type = 'button';
    back.addEventListener('click', function () {
      renderFonts();
    });

    /* la source des familles (système/Illustrateur/web) se dit en pied */
    if (MB.fonts && MB.fonts.source) {
      var src = MB.fonts.source();
      var srcKey =
        src === 'host' ? 'lib.fontsSourceHost' :
        src === 'system' ? 'lib.fontsSourceSystem' :
        'lib.fontsSourceWeb';
      box.appendChild(U.el('div', 'lib-note lib-note--dim', T(srcKey)));
    }

    box.appendChild(search);
    box.appendChild(list);
    box.appendChild(back);
    host.appendChild(box);
    /* premier rendu : quandReady peut avoir été résolu AVANT que la
     * liste ne soit dans le DOM — on rend ici quoi qu'il en soit. */
    renderAll();
    search.focus();
  }

  function renderFonts() {
    var host = document.getElementById('lib-content');
    host.innerHTML = '<div class="lib-note">' + T('lib.dragFont') + '</div>';
    host.appendChild(addBar('lib.addFont', function () {
      showFontCreator();
    }));
    /* v1.14.1 — la source des familles (système/Illustrateur/web)
    * se dit discrètement sous le bouton d'ajout. */
    if (MB.fonts && MB.fonts.source) {
      var src = MB.fonts.source();
      var srcKey =
        src === 'host' ? 'lib.fontsSourceHost' :
        src === 'system' ? 'lib.fontsSourceSystem' :
        'lib.fontsSourceWeb';
      host.appendChild(U.el('div', 'lib-note lib-note--dim', T(srcKey)));
    }
    var shown = visibleFonts();
    if (!shown.length) {
      host.appendChild(U.el('div', 'lib-note', T('lib.emptyTab')));
      return;
    }
    var list = U.el('div', 'lib-list lib-list--fonts');
    shown.forEach(function (f) {
      var item = U.el('div', 'lib-item lib-font');
      item.innerHTML =
        '<span class="lib-font-name">' + U.escapeHtml(f) + '</span>' +
        '<span class="lib-font-sample" style="font-family:\'' + U.escapeHtml(f) + '\'">Aa Bb Cc</span>';
      item.dataset.ghostHtml = '<span class="ghost-font">Aa</span>';
      bindDragItem(item, function () {
        return { fontFamily: f };
      }, 'typography', 'lib:typo ' + f);
      attachDel(item, T('lib.deleteMedia'), function () {
        removeFont(f);
      });
      list.appendChild(item);
    });
    host.appendChild(list);
  }

  /* ------------------------------------------------------------- MÉDIAS */

  function renderMedia() {
    var host = document.getElementById('lib-content');
    host.innerHTML = '';

    var bar = U.el('div', 'lib-import');
    var btn = U.el('button', 'btn btn-primary', MB.icons.get('import', 15) + '<span>' + T('lib.importImages') + '</span>');
    btn.type = 'button';
    btn.addEventListener('click', function () {
      MB.interact.openImportPicker(null);
    });
    bar.appendChild(btn);
    /* v1.13 — les assets de démo retirés reviennent d'un clic. */
    if (state.hiddenDemo.length) {
      var rest = U.el('button', 'lib-restore', T('lib.restoreDemo'));
      rest.type = 'button';
      rest.addEventListener('click', function () {
        restoreDemoMedia();
      });
      bar.appendChild(rest);
    }
    host.appendChild(bar);

    var all = state.media.concat(demoItems);
    if (!all.length) {
      host.appendChild(U.el(
        'div',
        'lib-note',
        T('lib.mediaEmpty')
      ));
      return;
    }

    var grid = U.el('div', 'lib-grid lib-grid--media');
    all.forEach(function (m) {
      var item = U.el('div', 'lib-thumb' + (m.demo ? ' lib-thumb--demo' : ''));
      item.style.backgroundImage = 'url("' + m.src + '")';
      item.dataset.tip = m.name;
      item.dataset.ghostHtml = '<span class="ghost-img" style="background-image:url(\'' + m.src + '\')"></span>';
      bindDragItem(item, function () {
        return { src: m.src, naturalW: m.w, naturalH: m.h };
      }, 'image', 'lib:média ' + (m.name || ''));
      /* v1.13 — TOUT se retire, images utilisateur ET assets de démo
       * (les démos sont masquées, « Restaurer » les ramène). */
      attachDel(item, T('lib.deleteMedia'), function () {
        if (m.demo) removeDemoMedia(m.src);
        else removeMedia(m.src);
      });
      grid.appendChild(item);
    });
    host.appendChild(grid);
  }

  function addMedia(src, w, h, name) {
    /* dédoublonnage par source : ré-ajouter remonte l'image en tête */
    state.media = state.media.filter(function (m) {
      return m.src !== src;
    });
    state.media.unshift({ src: src, w: w, h: h, name: name || 'image' });
    if (state.media.length > 60) state.media.pop();
    persist();
    if (activeTabId() === 'media') renderMedia();
  }

  function removeMedia(src) {
    state.media = state.media.filter(function (m) {
      return m.src !== src;
    });
    persist();
    if (activeTabId() === 'media') renderMedia();
    MB.ui.toast('Image retirée de la bibliothèque', 'success');
  }

  function removeDemoMedia(src) {
    demoItems = demoItems.filter(function (m) {
      return m.src !== src;
    });
    if (state.hiddenDemo.indexOf(src) < 0) state.hiddenDemo.push(src);
    persist();
    if (activeTabId() === 'media') renderMedia();
    MB.ui.toast(T('lib.removedDemo'), 'success');
  }

  function restoreDemoMedia() {
    state.hiddenDemo = [];
    persist();
    seedDemoMedia();
    if (activeTabId() === 'media') renderMedia();
    MB.ui.toast(T('lib.restoredDemo'), 'success');
  }

  /* v1.11 — depuis le CANVAS : une image posée devient une entrée de
   * la bibliothèque (menu contextuel « Ajouter à la bibliothèque »). */
  function addFromElement(el) {
    if (!el || !el.data) return;
    if (el.type === 'image' && el.data.src) {
      addMedia(el.data.src, el.data.naturalW || 512, el.data.naturalH || 512, el.data.name || 'image du canvas');
      MB.ui.toast('Ajoutée à la bibliothèque — réutilisable dans tous vos moodboards', 'success');
      return;
    }
    /* v1.13 — couleurs, palettes et typos du canvas rejoignent aussi
     * la bibliothèque (clic droit ▸ Ajouter à la bibliothèque). */
    if (el.type === 'color' && el.data.hex) {
      addColor(el.data.hex);
      return;
    }
    if (el.type === 'palette' && Array.isArray(el.data.colors) && el.data.colors.length) {
      addPalette({
        name: el.data.name || T('lib.paletteDefault'),
        colors: el.data.colors.map(function (c) {
          return { hex: c.hex, name: c.name || c.hex };
        })
      });
      return;
    }
    if (el.type === 'typography' && el.data.fontFamily) {
      addFont(el.data.fontFamily);
    }
  }

  /* ------------------------------------------------------------ RENDU */

  function render() {
    var tab = activeTabId();
    if (tab === 'colors') renderColors();
    else if (tab === 'palettes') renderPalettes();
    else if (tab === 'fonts') renderFonts();
    else renderMedia();
  }

  function init() {
    var tabs = document.getElementById('lib-tabs');
    TABS.forEach(function (t) {
      var b = U.el('button', 'lib-tab' + (t.id === 'media' ? ' is-active' : ''));
      b.type = 'button';
      b.textContent = T(t.key);
      b.dataset.tab = t.id;
      b.addEventListener('click', function () {
        tabs.querySelectorAll('.lib-tab').forEach(function (x) {
          x.classList.remove('is-active');
        });
        b.classList.add('is-active');
        render();
      });
      tabs.appendChild(b);
    });

    // intercepte les imports pour peupler la bibliothèque
    var origImport = MB.interact.importFiles;
    MB.interact.importFiles = function (files, atPoint) {
      var list = Array.prototype.slice.call(files || []);
      list.forEach(function (f) {
        if (!/^image\//.test(f.type)) return;
        var done = function (dataUrl, w, h) {
          addMedia(dataUrl, w, h, f.name);
        };
        if (MB.storage.hasOsPaths() && f.path) {
          var ext = (f.name.split('.').pop() || 'png').toLowerCase();
          var res = MB.storage.readFileAny(f.path, 'Base64');
          if (res && res.err === 0) {
            var url = 'data:image/' + (ext === 'jpg' ? 'jpeg' : ext) + ';base64,' + res.data;
            var img = new Image();
            img.onload = function () {
              done(url, img.naturalWidth, img.naturalHeight);
            };
            img.src = url;
          }
        } else {
          var fr = new FileReader();
          fr.onload = function () {
            var img2 = new Image();
            img2.onload = function () {
              done(String(fr.result), img2.naturalWidth, img2.naturalHeight);
            };
            img2.src = String(fr.result);
          };
          fr.readAsDataURL(f);
        }
      });
      origImport(files, atPoint);
    };

    /* v1.13 — bibliothèque complète persistante : images, couleurs,
     * palettes, typos ET retraits (y compris assets de démo) sont relus
     * au démarrage. */
    state = MB.storage.readLibraryFull();

    /* v1.14.1 — l'énumération des polices de l'ORDINATEUR est
     * asynchrone (Illustrateur / queryLocalFonts) : l'onglet Typo se
     * complète dès qu'elle arrive. */
    if (MB.fonts && MB.fonts.onChange) {
      MB.fonts.onChange(function () {
        if (activeTabId() === 'fonts') renderFonts();
      });
    }

    // Bibliothèque Médias : les assets de démonstration non masqués
    // sont chargés en arrière-plan (le rendu suit l'ajout si l'onglet
    // est actif).
    seedDemoMedia();

    render();
  }

  MB.ui = MB.ui || {};
  MB.ui.library = {
    init: init,
    addMedia: addMedia,
    removeMedia: removeMedia,
    addFromElement: addFromElement,
    render: render,
    /* v1.13 — API d'édition complète (tests E2E). */
    state: function () {
      return state;
    },
    addColor: addColor,
    removeColor: removeColor,
    addPalette: addPalette,
    removePalette: removePalette,
    addFont: addFont,
    removeFont: removeFont,
    removeDemoMedia: removeDemoMedia,
    restoreDemoMedia: restoreDemoMedia,
    visibleColors: visibleColors,
    visiblePalettes: visiblePalettes,
    visibleFonts: visibleFonts
  };
})();
