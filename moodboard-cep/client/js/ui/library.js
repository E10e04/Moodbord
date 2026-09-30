/* =========================================================================
 * library.js — Bibliothèque latérale : médias importés, couleurs,
 * palettes, typographies, formes. Chaque item se glisse sur le canvas.
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  var TABS = [
    { id: 'media', label: 'Médias' },
    { id: 'colors', label: 'Couleurs' },
    { id: 'palettes', label: 'Palettes' },
    { id: 'fonts', label: 'Typo' },
    { id: 'shapes', label: 'Formes' }
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

  var FONTS = [
    'Georgia', 'Times New Roman', 'Palatino Linotype', 'Garamond',
    'Arial', 'Verdana', 'Trebuchet MS', 'Tahoma',
    'Courier New', 'Impact'
  ];

  var SHAPES = [
    { id: 'rect', label: 'Rectangle' },
    { id: 'ellipse', label: 'Ellipse' },
    { id: 'triangle', label: 'Triangle' }
  ];

  var mediaItems = []; // {src, w, h, name}

  function bindDragItem(node, makeExtra, type) {
    // Couche adaptative pointer + souris (cf. utils.js) : le drag depuis
    // la bibliothèque fonctionne même dans les moteurs CEP qui ne
    // livrent pas les Pointer Events.
    U.bindPointerWithMouse(node, 'down', function (e) {
      if (e.button !== 0) return;
      MB.ui.ghost.start(
        {
          sx: e.clientX,
          sy: e.clientY,
          html: '<div class="ghost-card">' + node.dataset.ghostHtml + '</div>'
        },
        function (point) {
          var extra = makeExtra(point);
          MB.interact.createAt(type, point, extra);
        }
      );
    });
  }

  function renderColors() {
    var host = document.getElementById('lib-content');
    host.innerHTML = '<div class="lib-note">Glissez une couleur sur le canvas, ou cliquez pour l’ajouter au centre.</div>';
    var grid = U.el('div', 'lib-grid lib-grid--colors');
    COLORS.forEach(function (hex) {
      var item = U.el('div', 'lib-color');
      item.style.background = hex;
      item.dataset.tip = hex.toUpperCase();
      item.setAttribute('aria-label', 'Couleur ' + hex);
      item.dataset.ghostHtml = '<span class="ghost-swatch" style="background:' + hex + '"></span>';
      bindDragItem(item, function () {
        return { hex: hex, name: colorName(hex) };
      }, 'color');
      item.addEventListener('click', function () {
        var center = MB.interact.canvasPoint({
          clientX: window.innerWidth / 2,
          clientY: window.innerHeight / 2
        });
        MB.interact.createAt('color', center, { hex: hex, name: colorName(hex) });
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

  function renderPalettes() {
    var host = document.getElementById('lib-content');
    host.innerHTML = '<div class="lib-note">Glissez une palette complète sur le canvas.</div>';
    var list = U.el('div', 'lib-list');
    PALETTES.forEach(function (p) {
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
      }, 'palette');
      list.appendChild(item);
    });
    host.appendChild(list);
  }

  function renderFonts() {
    var host = document.getElementById('lib-content');
    host.innerHTML = '<div class="lib-note">Glissez une typographie pour créer une carte de spécimen.</div>';
    var list = U.el('div', 'lib-list');
    FONTS.forEach(function (f) {
      var item = U.el('div', 'lib-item lib-font');
      item.innerHTML =
        '<span class="lib-font-name">' + U.escapeHtml(f) + '</span>' +
        '<span class="lib-font-sample" style="font-family:\'' + U.escapeHtml(f) + '\'">Aa Bb Cc</span>';
      item.dataset.ghostHtml = '<span class="ghost-font">Aa</span>';
      bindDragItem(item, function () {
        return { fontFamily: f };
      }, 'typography');
      list.appendChild(item);
    });
    host.appendChild(list);
  }

  function renderShapes() {
    var host = document.getElementById('lib-content');
    host.innerHTML = '<div class="lib-note">Glissez une forme sur le canvas.</div>';
    var grid = U.el('div', 'lib-grid lib-grid--shapes');
    SHAPES.forEach(function (s) {
      var item = U.el('div', 'lib-shape');
      item.dataset.tip = s.label;
      item.innerHTML = MB.icons.get(s.id === 'rect' ? 'square' : s.id, 26);
      item.dataset.ghostHtml = MB.icons.get(s.id === 'rect' ? 'square' : s.id, 18);
      bindDragItem(item, function () {
        return { shape: s.id };
      }, 'shape');
      grid.appendChild(item);
    });
    host.appendChild(grid);
  }

  function renderMedia() {
    var host = document.getElementById('lib-content');
    host.innerHTML = '';

    var bar = U.el('div', 'lib-import');
    var btn = U.el('button', 'btn btn-primary', MB.icons.get('import', 15) + '<span>Importer des images</span>');
    btn.type = 'button';
    btn.addEventListener('click', function () {
      MB.interact.openImportPicker(null);
    });
    bar.appendChild(btn);
    host.appendChild(bar);

    if (!mediaItems.length) {
      host.appendChild(U.el(
        'div',
        'lib-note',
        'Aucun média dans la session.<br>Importez des images ou déposez-les depuis le Finder.'
      ));
      return;
    }

    var grid = U.el('div', 'lib-grid lib-grid--media');
    mediaItems.forEach(function (m) {
      var item = U.el('div', 'lib-thumb');
      item.style.backgroundImage = 'url("' + m.src + '")';
      item.dataset.tip = m.name;
      item.dataset.ghostHtml = '<span class="ghost-img" style="background-image:url(\'' + m.src + '\')"></span>';
      bindDragItem(item, function () {
        return { src: m.src, naturalW: m.w, naturalH: m.h };
      }, 'image');
      grid.appendChild(item);
    });
    host.appendChild(grid);
  }

  function addMedia(src, w, h, name) {
    mediaItems.unshift({ src: src, w: w, h: h, name: name || 'image' });
    if (mediaItems.length > 60) mediaItems.pop();
    var active = document.querySelector('.lib-tab.is-active');
    if (active && active.dataset.tab === 'media') renderMedia();
  }

  function render() {
    var active = document.querySelector('.lib-tab.is-active');
    var tab = active ? active.dataset.tab : 'media';
    if (tab === 'colors') renderColors();
    else if (tab === 'palettes') renderPalettes();
    else if (tab === 'fonts') renderFonts();
    else if (tab === 'shapes') renderShapes();
    else renderMedia();
  }

  function init() {
    var tabs = document.getElementById('lib-tabs');
    TABS.forEach(function (t) {
      var b = U.el('button', 'lib-tab' + (t.id === 'media' ? ' is-active' : ''));
      b.type = 'button';
      b.textContent = t.label;
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

    render();
  }

  MB.ui = MB.ui || {};
  MB.ui.library = {
    init: init,
    addMedia: addMedia,
    render: render
  };
})();
