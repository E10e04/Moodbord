/* =========================================================================
 * demo.js — Tableau de démonstration « Café Aurora » (premier lancement).
 * Les images référencent les ressources embarquées assets/demo/*.png :
 * en CEP elles résolvent via file://, en preview web via /moodboard/.
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});

  function id(i) {
    return 'demo-' + i;
  }

  function E(i, type, x, y, w, h, data, parentId) {
    return {
      id: id(i),
      type: type,
      x: x,
      y: y,
      w: w,
      h: h,
      rotation: 0,
      locked: false,
      hidden: false,
      parentId: parentId || null,
      data: data,
      _rev: 1
    };
  }

  function build() {
    var elements = [
      /* v1.12 — la SECTION de démonstration est retirée avec l'outil :
       * la dé montre désormais une COLONNE en mini-canvas (avec deux
       * cartes empilées) + une palette au nouveau design « picker ». */
      E(2, 'image', 110, 176, 300, 300, {
        src: 'assets/demo/demo-texture.png',
        naturalW: 1024,
        naturalH: 1024,
        radius: 10,
        opacity: 1,
        border: 0,
        borderColor: '#F5F5F5',
        shadow: true,
        ratioLock: true,
        fit: 'cover',
        crop: null
      }),

      E(3, 'image', 440, 176, 520, 340, {
        src: 'assets/demo/demo-editorial.png',
        naturalW: 1024,
        naturalH: 1024,
        radius: 10,
        opacity: 1,
        border: 0,
        borderColor: '#F5F5F5',
        shadow: true,
        ratioLock: true,
        fit: 'cover',
        crop: null
      }),

      E(4, 'note', 440, 540, 300, 140, {
        text: 'Teintes chaudes, papier brut, esprit artisanal — un café qui se lit comme une lettre d‘amour.',
        color: '#F7D46A',
        fontSize: 15
      }),

      E(5, 'palette', 1080, 140, 264, 306, {
        name: 'Old Copper',
        colors: [
          { hex: '#7A522E', name: 'Old Copper' },
          { hex: '#B0673F', name: 'Terracotta' },
          { hex: '#E4D0B8', name: 'Sable' },
          { hex: '#2B2B2B', name: 'Charbon' },
          { hex: '#F5F1EA', name: 'Ivoire' }
        ]
      }),

      /* v1.12 — colonne de démonstration : le mini-canvas vertical
       * avec deux cartes enfants qui ont pris sa largeur. */
      E(18, 'column', 1080, 500, 264, 320, {
        title: 'Direction artistique',
        color: '#2A2A2A'
      }),
      E(19, 'note', 1092, 549, 240, 120, {
        text: 'Glissez des cartes dans la colonne — elles s’empilent.',
        color: '#F7D46A',
        fontSize: 14,
        html: ''
      }, id(18)),
      E(20, 'checklist', 1092, 679, 240, 136, {
        title: 'À faire',
        items: [
          { id: 'demo-c1', text: 'Choisir la palette', done: true },
          { id: 'demo-c2', text: 'Photographier les textures', done: false }
        ],
        color: '#252525',
        fontSize: 13
      }, id(18)),

      E(6, 'typography', 1330, 140, 236, 252, {
        fontFamily: 'Georgia',
        sampleText: 'Portez ce vieux whisky au juge blond',
        sizes: [40, 28, 18, 13]
      }),

      E(7, 'image', 1700, 120, 330, 330, {
        src: 'assets/demo/demo-logo.png',
        naturalW: 1024,
        naturalH: 1024,
        radius: 160,
        opacity: 1,
        border: 0,
        borderColor: '#F5F5F5',
        shadow: true,
        ratioLock: true,
        fit: 'cover',
        crop: null
      }),

      E(8, 'image', 90, 880, 380, 507, {
        src: 'assets/demo/demo-packaging.png',
        naturalW: 1024,
        naturalH: 1024,
        radius: 10,
        opacity: 1,
        border: 0,
        borderColor: '#F5F5F5',
        shadow: true,
        ratioLock: true,
        fit: 'cover',
        crop: null
      }),

      E(9, 'image', 540, 880, 560, 373, {
        src: 'assets/demo/demo-photo.png',
        naturalW: 1024,
        naturalH: 1024,
        radius: 10,
        opacity: 1,
        border: 0,
        borderColor: '#F5F5F5',
        shadow: true,
        ratioLock: true,
        fit: 'cover',
        crop: null
      }),

      E(10, 'checklist', 1160, 880, 264, 60 + 4 * 38, {
        title: 'Livrables',
        items: [
          { id: id('t1'), text: 'Moodboard validé', done: true },
          { id: id('t2'), text: 'Palette verrouillée', done: true },
          { id: id('t3'), text: 'Logo vectorisé', done: false },
          { id: id('t4'), text: 'Maquette packaging', done: false }
        ]
      }),

      E(11, 'comment', 1470, 880, 220, 110, {
        text: 'Le cuivre ancien comme fil conducteur ?',
        author: 'Camille',
        color: '#4C8DFF'
      }),

      E(12, 'color', 1750, 560, 132, 168, { hex: '#7A522E', name: 'Old Copper' }),
      E(13, 'color', 1910, 560, 132, 168, { hex: '#B0673F', name: 'Terracotta' }),
      E(14, 'color', 2070, 560, 132, 168, { hex: '#E4D0B8', name: 'Sable' }),

      E(15, 'shape', 2230, 130, 160, 160, {
        shape: 'ellipse',
        fill: '#4C8DFF',
        stroke: 'none',
        strokeWidth: 2,
        radius: 10
      }),

      E(16, 'line', 0, 0, 12, 12, {
        x1: 1080,
        y1: 330,
        x2: 1026,
        y2: 620,
        color: '#4C8DFF',
        thickness: 2,
        style: 'solid',
        startArrow: false,
        endArrow: true,
        label: 'inspire',
        startAttach: null,
        endAttach: null
      }),

      E(17, 'line', 0, 0, 12, 12, {
        x1: 1450,
        y1: 400,
        x2: 1560,
        y2: 868,
        color: '#A8A8A8',
        thickness: 2,
        style: 'dashed',
        startArrow: false,
        endArrow: false,
        label: '',
        startAttach: null,
        endAttach: null
      })
    ];

    for (var i = 0; i < elements.length; i++) {
      var e = elements[i];
      if (e.type === 'line') MB.store.syncLineBox(e);
    }

    return {
      name: 'Café Aurora — Direction de marque',
      elements: elements,
      camera: null,
      settings: { snap: true, grid: true }
    };
  }

  MB.demo = { build: build };
})();
