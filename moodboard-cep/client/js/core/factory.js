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
            fontFamily: (extra && extra.fontFamily) || (MB.fonts ? MB.fonts.default() : 'Georgia'),
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
            fontSize: 15,
            fontFamily: (extra && extra.fontFamily) || (MB.fonts ? MB.fonts.default() : 'Georgia'),
            html: ''
          };
          return n;
        }

        case 'comment': {
          var c = base('comment', p, Object.assign({ w: 220, h: 110 }, extra));
          c.data = {
            text: 'Un commentaire…',
            author: 'Vous',
            color: '#4C8DFF',
            fontFamily: (extra && extra.fontFamily) || (MB.fonts ? MB.fonts.default() : 'Georgia'),
            fontSize: 13
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
          /* v1.12 — REDESIGN « picker » (Bencho) : pastille à ronds
           * empilés + liste cochable — même boîte que la carte Assignees
           * (264 de large, hauteur réservée pour la liste OUVERTE).
           * picked = les hex présents dans la pastille (par défaut :
           * toutes les couleurs). */
          var pickedDef = (extra && Array.isArray(extra.picked))
            ? extra.picked.slice()
            : colors.map(function (c) { return c.hex; });
          var pl = base('palette', p, Object.assign({
            w: 264,
            h: (MB.ui && MB.ui.paletteCard ? MB.ui.paletteCard.heightOf(colors.length) : 66 + colors.length * 48)
          }, extra));
          pl.data = {
            name: (extra && extra.name) || 'Palette',
            colors: colors,
            picked: pickedDef,
            open: (extra && extra.open !== undefined) ? extra.open : true
          };
          return pl;
        }

        case 'assignees': {
          /* v1.11 — composant Assignees (Bencho, MIT — porté en vanilla) :
           * pastille qui se remplit de visages + liste de personnes.
           * La boîte réserve la place de la liste OUVERTE (264×268) —
           * voir ui/assignees.js. */
          var asg = base('assignees', p, Object.assign({ w: 264, h: 268 }, extra));
          asg.data = {
            picked: (extra && Array.isArray(extra.picked)) ? extra.picked.slice() : ['kai', 'mara'],
            open: true
          };
          return asg;
        }

        case 'typography': {
          var ty = base('typography', p, Object.assign({ w: 236, h: 252 }, extra));
          ty.data = {
            fontFamily: (extra && extra.fontFamily) || (MB.fonts ? MB.fonts.default() : 'Georgia'),
            sampleText: 'Portez ce vieux whisky au juge blond qui fume',
            sizes: [40, 28, 18, 13]
          };
          return ty;
        }

        case 'link': {
          var url = (extra && extra.url) || 'https://example.com';
          /* v1.10 — carte PORTRAIT (design fourni par l'utilisateur) :
           * hero blanc avec le LOGO du site, zone d'infos sombre avec
           * favicon + URL, titre orange souligné, description. */
          var lk = base('link', p, Object.assign({ w: 244, h: 320 }, extra));
          lk.data = {
            url: url,
            title: (extra && extra.title) || U.titleFromUrl(url),
            domain: U.domainOf(url),
            /* v1.10 — métadonnées légères (favicon + og:title/desc),
             * jamais de chargement ni de capture du site. */
            desc: (extra && extra.desc) || '',
            site: (extra && extra.site) || '',
            titleFont: (extra && extra.titleFont) || '',
            bg: (extra && extra.bg) || '',
            preview: (extra && extra.preview) || ''
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
            /* v1.9 — triangle = polygone régulier : nombre de branches
             * (3 = triangle, 4 = losange, 5 = pentagone, 6 = hexagone…)
             * réglable dans le panneau Projet. */
            sides: (extra && extra.sides) || 3,
            fill: '#4C8DFF',
            stroke: 'none',
            strokeWidth: 2,
            radius: 10
          };
          return sh;
        }

        case 'column': {
          var co = base('column', p, Object.assign({ w: 250, h: 400 }, extra));
          co.data = {
            /* v1.11 — le titre passé à la création est enfin honoré
             * (il l'était pour la typographie, pas pour les conteneurs). */
            title: (extra && extra.title) || 'Colonne',
            /* v1.10 — mini-canvas vertical : corps + en-tête séparés. */
            color: (extra && extra.color) || '#2A2A2A',
            headColor: (extra && extra.headColor) || '',
            titleFont: (extra && extra.titleFont) || '',
            titleSize: (extra && extra.titleSize) || 15,
            /* v1.10 — mise en forme du titre transmise par la création. */
            titleBold: !!(extra && extra.titleBold),
            titleItalic: !!(extra && extra.titleItalic),
            titleColor: (extra && extra.titleColor) || ''
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
            cells: cells,
            /* v1.8 — couleurs par cellule / en-tête / ligne / colonne +
             * police du texte du tableau. */
            cellBg: (extra && extra.cellBg) || '#252525',
            headBg: (extra && extra.headBg) || '#3A3A3A',
            textColor: (extra && extra.textColor) || '#F5F5F5',
            headColor: (extra && extra.headColor) || '#F5F5F5',
            rowBgs: (extra && extra.rowBgs) || [],
            colBgs: (extra && extra.colBgs) || [],
            fontFamily: (extra && extra.fontFamily) || (MB.fonts ? MB.fonts.default() : 'Georgia'),
            fontSize: (extra && extra.fontSize) || 12
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
            items: items,
            /* v1.10 — couleur de la carte modifiable. */
            color: (extra && extra.color) || '#252525',
            fontFamily: (extra && extra.fontFamily) || (MB.fonts ? MB.fonts.default() : 'Georgia'),
            fontSize: 13
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

        case 'board': {
          /* Planche liée (v1.6) : renferme un document complet.
           * v1.7 — design avec grande zone principale (nom centré au
           * milieu) + barre du bas (compteur + flèche) : carte haute. */
          var bd = base('board', p, Object.assign({ w: 264, h: 168 }, extra));
          bd.data = {
            title: (extra && extra.title) || 'Planche',
            elCount: 0,
            thumb: null,
            titleFont: (extra && extra.titleFont) || '',
            titleSize: 19,
            doc: (extra && extra.doc) || { elements: [], camera: null }
          };
          return bd;
        }

        case 'import': {
          /* v1.8 — carte d'import : station de dépôt sur le canvas.
           * Double-clic → explorateur ; glisser-déposer de fichiers sur
           * la carte → import sur place (images, fichiers, moodboards —
           * un .moodboard importé devient une planche liée nommée). */
          var im = base('import', p, Object.assign({ w: 250, h: 190 }, extra));
          im.data = {
            title: (extra && extra.title) || 'Importer des médias'
          };
          return im;
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
