/* =========================================================================
 * factory.js — Création d'éléments avec valeurs par défaut par type.
 * Toutes les creations passent ici : cohérence du modèle extensible.
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  function base(type, point, extra) {
    var ex = extra || {};
    var el = {
      id: ex.id || U.uid(),
      type: type,
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      rotation: 0,
      locked: false,
      hidden: false,
      parentId: ex.parentId || null,
      data: {},
      _rev: 1
    };
    if (ex.w !== undefined) el.w = ex.w;
    if (ex.h !== undefined) el.h = ex.h;
    // l'objet est créé AUTOUR du point de clic
    el.x = point.x - el.w / 2;
    el.y = point.y - el.h / 2;
    if (ex.x !== undefined) el.x = ex.x;
    if (ex.y !== undefined) el.y = ex.y;
    return el;
  }

  var Factory = {
    create: function (type, point, extra) {
      var p = point || { x: 0, y: 0 };
      switch (type) {
        case 'text': {
          var t = base('text', p, Object.assign({ w: 280, h: 64 }, extra));
          t.data = {
            text: 'Texte',
            fontFamily: 'Georgia',
            fontSize: 26,
            bold: false,
            italic: false,
            underline: false,
            strike: false,
            align: 'left',
            color: '#F5F5F5',
            bg: 'transparent',
            lineHeight: 1.35,
            letterSpacing: 0,
            autoH: true
          };
          return t;
        }

        case 'note': {
          var n = base('note', p, Object.assign({ w: 220, h: 180 }, extra));
          n.data = {
            text: 'Double-cliquez pour écrire…',
            color: '#F7D46A',
            fontSize: 15
          };
          return n;
        }

        case 'comment': {
          var c = base('comment', p, Object.assign({ w: 220, h: 110 }, extra));
          c.data = {
            text: 'Un commentaire…',
            author: 'Vous',
            color: '#4C8DFF'
          };
          return c;
        }

        case 'image': {
          var ex = extra || {};
          var im = base('image', p, Object.assign({ w: ex.w || 320, h: ex.h || 240 }, extra));
          im.data = {
            src: ex.src || '',
            naturalW: ex.naturalW || 0,
            naturalH: ex.naturalH || 0,
            radius: 8,
            opacity: 1,
            border: 0,
            borderColor: '#F5F5F5',
            shadow: false,
            ratioLock: true,
            fit: 'cover',
            crop: null
          };
          im._sized = !!ex.src;
          return im;
        }

        case 'color': {
          var col = base('color', p, Object.assign({ w: 132, h: 168 }, extra));
          var hex = (extra && extra.hex) || '#7A522E';
          col.data = {
            hex: U.normalizeHex(hex) || '#7A522E',
            name: (extra && extra.name) || 'Couleur'
          };
          return col;
        }

        case 'palette': {
          var colors = (extra && extra.colors) || [
            { hex: '#7A522E', name: 'Old Copper' },
            { hex: '#B0673F', name: 'Terracotta' },
            { hex: '#E4D0B8', name: 'Sable' },
            { hex: '#2B2B2B', name: 'Charbon' },
            { hex: '#F5F1EA', name: 'Ivoire' }
          ];
          var pl = base('palette', p, Object.assign({ w: 216, h: 46 + colors.length * 36 }, extra));
          pl.data = {
            name: (extra && extra.name) || 'Palette',
            colors: colors
          };
          return pl;
        }

        case 'typography': {
          var ty = base('typography', p, Object.assign({ w: 236, h: 252 }, extra));
          ty.data = {
            fontFamily: (extra && extra.fontFamily) || 'Georgia',
            sampleText: 'Portez ce vieux whisky au juge blond qui fume',
            sizes: [40, 28, 18, 13]
          };
          return ty;
        }

        case 'link': {
          var url = (extra && extra.url) || 'https://example.com';
          var lk = base('link', p, Object.assign({ w: 244, h: 74 }, extra));
          lk.data = {
            url: url,
            title: (extra && extra.title) || U.titleFromUrl(url),
            domain: U.domainOf(url)
          };
          return lk;
        }

        case 'file': {
          var fl = base('file', p, Object.assign({ w: 216, h: 74 }, extra));
          fl.data = {
            name: (extra && extra.name) || 'fichier.pdf',
            kind: (extra && extra.kind) || 'fichier',
            size: (extra && extra.size) || 0
          };
          return fl;
        }

        case 'line': {
          var x1 = p.x;
          var y1 = p.y;
          var x2 = (extra && extra.x2 !== undefined) ? extra.x2 : p.x + 180;
          var y2 = (extra && extra.y2 !== undefined) ? extra.y2 : p.y;
          var ln = base('line', p, Object.assign({ w: Math.abs(x2 - x1) + 12, h: Math.abs(y2 - y1) + 12 }, extra));
          ln.data = {
            x1: x1,
            y1: y1,
            x2: x2,
            y2: y2,
            color: '#4C8DFF',
            thickness: 2,
            style: 'solid',
            startArrow: false,
            endArrow: true,
            label: '',
            startAttach: null,
            endAttach: null
          };
          MB.store.syncLineBox(ln);
          return ln;
        }

        case 'shape': {
          var sh = base('shape', p, Object.assign({ w: 170, h: 130 }, extra));
          sh.data = {
            shape: (extra && extra.shape) || 'rect',
            fill: '#4C8DFF',
            stroke: 'none',
            strokeWidth: 2,
            radius: 10
          };
          return sh;
        }

        case 'section': {
          var sc = base('section', p, Object.assign({ w: 560, h: 440 }, extra));
          sc.data = {
            title: 'Section',
            color: '#2C2C2C',
            showTitle: true
          };
          return sc;
        }

        case 'column': {
          var co = base('column', p, Object.assign({ w: 250, h: 400 }, extra));
          co.data = {
            title: 'Colonne',
            color: '#2A2A2A'
          };
          return co;
        }

        case 'table': {
          var rows = (extra && extra.rows) || 3;
          var colsN = (extra && extra.cols) || 3;
          var tb = base('table', p, Object.assign({ w: 340, h: 150 }, extra));
          var cells = [];
          for (var r = 0; r < rows; r++) {
            var row = [];
            for (var c2 = 0; c2 < colsN; c2++) {
              row.push(r === 0 && extra && extra.header !== false ? 'En-tête' : '');
            }
            cells.push(row);
          }
          tb.data = {
            rows: rows,
            cols: colsN,
            header: !(extra && extra.header === false),
            cells: cells
          };
          return tb;
        }

        case 'checklist': {
          var items = (extra && extra.items) || [
            { id: U.uid(), text: 'Première tâche', done: false },
            { id: U.uid(), text: 'Deuxième tâche', done: false }
          ];
          var ck = base('checklist', p, Object.assign({ w: 260, h: 60 + items.length * 38 }, extra));
          ck.data = {
            title: (extra && extra.title) || 'Checklist',
            items: items
          };
          return ck;
        }

        case 'sketch': {
          var sk = base('sketch', p, Object.assign({ w: 120, h: 80 }, extra));
          sk.data = {
            points: [[0.5, 0], [0.5, 1]],
            color: '#4C8DFF',
            thickness: 3
          };
          return sk;
        }

        case 'group': {
          var gr = base('group', p, extra);
          gr.data = {};
          return gr;
        }

        default: {
          var g = base(type || 'text', p, extra);
          g.data = {};
          return g;
        }
      }
    }
  };

  MB.factory = Factory;
})();
