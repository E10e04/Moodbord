/* =========================================================================
 * contextbar.js — Barre d'outils contextuelle flottante (au-dessus de la
 * sélection). Son contenu dépend du type d'objet sélectionné (§34).
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;
  var C = null;

  var bar = null;

  function refresh() {
    C = MB.ui.controls;
    if (!bar) return;
    var st = MB.store.s();
    var sel = MB.store.selected();

    if (!sel.length || st.ui.editingId || st.ui.cropId) {
      bar.hidden = true;
      return;
    }

    bar.innerHTML = '';
    bar.hidden = false;

    if (sel.length === 1) {
      buildForType(sel[0]);
    } else {
      buildMulti(sel);
    }
    position();
  }

  function addGroup() {
    var g = U.el('div', 'ctx-group');
    bar.appendChild(g);
    return g;
  }

  function addSep() {
    bar.appendChild(U.el('div', 'ctx-sep'));
  }

  function addCommonEnd(els) {
    addSep();
    var g = addGroup();
    g.appendChild(C.iconButton('copy', 'Dupliquer (⌘D)', function () {
      MB.store.duplicateSelection();
    }));
    g.appendChild(C.iconButton('trash', 'Supprimer (⌫)', function () {
      MB.store.deleteSelection();
    }));
  }

  function buildForType(el) {
    var d = el.data;

    if (el.type === 'text') {
      var g1 = addGroup();
      g1.appendChild(C.fontButton(function () {
        return d.fontFamily;
      }, function (f) {
        C.applyDataTo([el], 'Police', { fontFamily: f });
        MB.board.renderContent(el.id);
      }));
      g1.appendChild(C.sizeControl(function () {
        return d.fontSize;
      }, function (v) {
        C.applyDataTo([el], 'Taille', { fontSize: U.clamp(v, 8, 200) });
        MB.board.renderContent(el.id);
      }));
      var g2 = addGroup();
      g2.appendChild(C.toggle('bold', 'Gras', function () {
        return !!d.bold;
      }, function (v) {
        C.applyDataTo([el], 'Gras', { bold: v });
        MB.board.renderContent(el.id);
      }));
      g2.appendChild(C.toggle('italic', 'Italique', function () {
        return !!d.italic;
      }, function (v) {
        C.applyDataTo([el], 'Italique', { italic: v });
        MB.board.renderContent(el.id);
      }));
      g2.appendChild(C.toggle('underline', 'Souligner', function () {
        return !!d.underline;
      }, function (v) {
        C.applyDataTo([el], 'Souligné', { underline: v });
        MB.board.renderContent(el.id);
      }));
      g2.appendChild(C.toggle('strike', 'Barrer', function () {
        return !!d.strike;
      }, function (v) {
        C.applyDataTo([el], 'Barré', { strike: v });
        MB.board.renderContent(el.id);
      }));
      var g3 = addGroup();
      g3.appendChild(C.seg(
        [
          { id: 'left', icon: 'alignTextLeft', label: 'Gauche' },
          { id: 'center', icon: 'alignTextCenter', label: 'Centre' },
          { id: 'right', icon: 'alignTextRight', label: 'Droite' }
        ],
        function () {
          return d.align;
        },
        function (v) {
          C.applyDataTo([el], 'Alignement', { align: v });
          MB.board.renderContent(el.id);
        }
      ));
      g3.appendChild(C.colorButton(function () {
        return d.color;
      }, function (hex) {
        C.applyDataTo([el], 'Couleur', { color: hex });
        MB.board.renderContent(el.id);
      }, 'Couleur du texte'));
      g3.appendChild(C.colorButton(function () {
        return d.bg === 'transparent' ? '#F7D46A' : d.bg;
      }, function (hex) {
        C.applyDataTo([el], 'Surlignage', { bg: hex });
        MB.board.renderContent(el.id);
      }, 'Surlignage'));
      addCommonEnd();
      return;
    }

    if (el.type === 'note') {
      var gn = addGroup();
      gn.appendChild(C.colorButton(function () {
        return d.color;
      }, function (hex) {
        C.applyDataTo([el], 'Couleur de la note', { color: hex });
        MB.board.renderContent(el.id);
      }, 'Couleur du post-it'));
      gn.appendChild(C.sizeControl(function () {
        return d.fontSize;
      }, function (v) {
        C.applyDataTo([el], 'Taille', { fontSize: U.clamp(v, 10, 40) });
        MB.board.renderContent(el.id);
      }));
      addCommonEnd();
      return;
    }

    if (el.type === 'image') {
      var gi = addGroup();
      gi.appendChild(C.iconButton('crop', 'Recadrer', function () {
        MB.interact.enterCrop(el);
      }));
      gi.appendChild(C.iconButton('refresh', 'Remplacer', function () {
        MB.ui.inspector.refresh();
        var btn = document.querySelector('.insp-sec .ctx-btn[data-tip="Remplacer l’image"]');
        if (btn) btn.click();
      }));
      gi.appendChild(C.opacityControl(function () {
        return d.opacity;
      }, function (v, commit) {
        d.opacity = v;
        if (commit) {
          MB.storage.markDirty();
          MB.hist.begin('Opacité');
          MB.hist.commit();
        }
        MB.board.renderContent(el.id);
      }));
      gi.appendChild(C.sizeControl(function () {
        return d.radius;
      }, function (v) {
        C.applyDataTo([el], 'Arrondi', { radius: U.clamp(v, 0, 200) });
        MB.board.renderContent(el.id);
      }));
      var gi2 = addGroup();
      gi2.appendChild(C.toggle('lock', 'Proportions verrouillées', function () {
        return d.ratioLock !== false;
      }, function (v) {
        C.applyDataTo([el], 'Proportions', { ratioLock: v });
      }));
      gi2.appendChild(C.toggle('sparkle', 'Ombre', function () {
        return !!d.shadow;
      }, function (v) {
        C.applyDataTo([el], 'Ombre', { shadow: v });
        MB.board.renderContent(el.id);
      }));
      addCommonEnd();
      return;
    }

    if (el.type === 'line') {
      var gl = addGroup();
      gl.appendChild(C.colorButton(function () {
        return d.color;
      }, function (hex) {
        C.applyDataTo([el], 'Couleur', { color: hex });
        MB.board.renderContent(el.id);
      }, 'Couleur'));
      gl.appendChild(C.sizeControl(function () {
        return d.thickness;
      }, function (v) {
        C.applyDataTo([el], 'Épaisseur', { thickness: U.clamp(v, 1, 20) });
        MB.board.renderContent(el.id);
      }));
      var gl2 = addGroup();
      gl2.appendChild(C.seg(
        [
          { id: 'solid', icon: 'minus', label: 'Plein' },
          { id: 'dashed', icon: 'line', label: 'Tirets' },
          { id: 'dotted', icon: 'more', label: 'Points' }
        ],
        function () {
          return d.style;
        },
        function (v) {
          C.applyDataTo([el], 'Style', { style: v });
          MB.board.renderContent(el.id);
        }
      ));
      var gl3 = addGroup();
      gl3.appendChild(C.toggle('arrowRight', 'Flèche début', function () {
        return !!d.startArrow;
      }, function (v) {
        C.applyDataTo([el], 'Flèche début', { startArrow: v });
        MB.board.renderContent(el.id);
      }));
      gl3.appendChild(C.toggle('arrowRight', 'Flèche fin', function () {
        return !!d.endArrow;
      }, function (v) {
        C.applyDataTo([el], 'Flèche fin', { endArrow: v });
        MB.board.renderContent(el.id);
      }));
      gl3.appendChild(C.textButton(d.label ? '“' + d.label + '”' : 'Libellé', function () {
        MB.ui.promptDialog({ title: 'Libellé de la ligne', label: 'Texte', value: d.label || '' }).then(function (v) {
          if (v === null) return;
          C.applyDataTo([el], 'Libellé', { label: v });
          MB.board.renderContent(el.id);
        });
      }));
      addCommonEnd();
      return;
    }

    if (el.type === 'color') {
      var gc = addGroup();
      gc.appendChild(C.colorButton(function () {
        return d.hex;
      }, function (hex) {
        C.applyDataTo([el], 'Couleur', { hex: hex });
        MB.board.renderContent(el.id);
      }, 'Couleur'));
      gc.appendChild(C.textButton('Copier', function () {
        try {
          navigator.clipboard.writeText(d.hex);
        } catch (e) {
          /* repli */
        }
        MB.ui.toast('Copié : ' + d.hex, 'success');
      }));
      addCommonEnd();
      return;
    }

    if (el.type === 'table') {
      var gt = addGroup();
      gt.appendChild(C.textButton('+ Ligne', function () {
        var cells = d.cells.map(function (r) {
          return r.slice();
        });
        var row = [];
        for (var i = 0; i < d.cols; i++) row.push('');
        cells.push(row);
        C.applyDataTo([el], 'Ajouter une ligne', { rows: d.rows + 1, cells: cells });
        MB.board.renderContent(el.id);
      }));
      gt.appendChild(C.textButton('− Ligne', function () {
        if (d.rows <= 1) return;
        C.applyDataTo([el], 'Retirer une ligne', { rows: d.rows - 1, cells: d.cells.slice(0, -1) });
        MB.board.renderContent(el.id);
      }));
      gt.appendChild(C.textButton('+ Colonne', function () {
        C.applyDataTo([el], 'Ajouter une colonne', {
          cols: d.cols + 1,
          cells: d.cells.map(function (r) {
            return r.concat(['']);
          })
        });
        MB.board.renderContent(el.id);
      }));
      gt.appendChild(C.textButton('− Colonne', function () {
        if (d.cols <= 1) return;
        C.applyDataTo([el], 'Retirer une colonne', {
          cols: d.cols - 1,
          cells: d.cells.map(function (r) {
            return r.slice(0, -1);
          })
        });
        MB.board.renderContent(el.id);
      }));
      var gt2 = addGroup();
      gt2.appendChild(C.toggle('bold', 'Ligne d’en-tête', function () {
        return !!d.header;
      }, function (v) {
        C.applyDataTo([el], 'En-tête', { header: v });
        MB.board.renderContent(el.id);
      }));
      addCommonEnd();
      return;
    }

    if (el.type === 'checklist') {
      var gk = addGroup();
      gk.appendChild(C.textButton('+ Tâche', function () {
        var node = document.querySelector('.mb-el[data-id="' + el.id + '"] .mb-check-add');
        if (node) node.click();
      }));
      /* v1.10 — couleur de la carte. */
      gk.appendChild(C.colorButton(function () {
        return d.color && d.color !== 'transparent' ? d.color : '#252525';
      }, function (hex) {
        C.applyDataTo([el], 'Couleur de la carte', { color: hex });
        MB.board.renderContent(el.id);
      }, 'Couleur de la carte'));
      var gk2 = addGroup();
      gk2.appendChild(C.textButton('Nettoyer', function () {
        var items = d.items.filter(function (it) {
          return !it.done;
        });
        C.applyDataTo([el], 'Nettoyer', { items: items });
        el.h = 60 + items.length * 38;
        MB.board.renderContent(el.id);
      }));
      addCommonEnd();
      return;
    }

    if (el.type === 'section' || el.type === 'column') {
      /* v1.10 — couleurs SÉPARÉES en-tête / corps + renommage. */
      var gs = addGroup();
      gs.appendChild(C.colorButton(function () {
        return d.headColor || '#3A3A3A';
      }, function (hex) {
        C.applyDataTo([el], 'Couleur de l’en-tête', { headColor: hex });
        MB.board.renderContent(el.id);
      }, 'Couleur de l’en-tête'));
      gs.appendChild(C.colorButton(function () {
        return d.color;
      }, function (hex) {
        C.applyDataTo([el], 'Couleur du corps', { color: hex });
        MB.board.renderContent(el.id);
      }, 'Couleur du corps'));
      gs.appendChild(C.textButton('Renommer', function () {
        MB.interact.startEditing(el, 'title');
      }));
      addCommonEnd();
      return;
    }

    if (el.type === 'shape') {
      /* v1.9 — type de forme au survol de la sélection (le triangle est
       * un polygone dont les branches se règlent dans le panneau Projet). */
      var gshT = addGroup();
      gshT.appendChild(C.seg(
        [
          { id: 'rect', icon: 'square', label: 'Rectangle' },
          { id: 'ellipse', icon: 'circle', label: 'Cercle' },
          { id: 'triangle', icon: 'triangle', label: 'Triangle' }
        ],
        function () {
          return d.shape || 'rect';
        },
        function (v) {
          C.applyDataTo([el], 'Type de forme', { shape: v });
          MB.board.renderContent(el.id);
          refresh();
        }
      ));
      var gsh = addGroup();
      gsh.appendChild(C.colorButton(function () {
        return d.fill;
      }, function (hex) {
        C.applyDataTo([el], 'Remplissage', { fill: hex });
        MB.board.renderContent(el.id);
      }, 'Remplissage'));
      gsh.appendChild(C.colorButton(function () {
        return d.stroke === 'none' ? '#F5F5F5' : d.stroke;
      }, function (hex) {
        C.applyDataTo([el], 'Contour', { stroke: hex });
        MB.board.renderContent(el.id);
      }, 'Contour'));
      if (d.shape === 'rect') {
        gsh.appendChild(C.sizeControl(function () {
          return d.radius;
        }, function (v) {
          C.applyDataTo([el], 'Arrondi', { radius: U.clamp(v, 0, 100) });
          MB.board.renderContent(el.id);
        }));
      }
      if (d.shape === 'triangle') {
        gsh.appendChild(C.sizeControl(function () {
          return d.sides || 3;
        }, function (v) {
          C.applyDataTo([el], 'Branches', { sides: U.clamp(Math.round(v), 3, 24) });
          MB.board.renderContent(el.id);
        }));
      }
      addCommonEnd();
      return;
    }

    if (el.type === 'typography') {
      /* v1.10 — police directement dans la barre au-dessus de la
       * carte sélectionnée (plus besoin du panneau Projet). */
      var gty = addGroup();
      gty.appendChild(C.fontButton(function () {
        return d.fontFamily;
      }, function (f) {
        C.applyDataTo([el], 'Police', { fontFamily: f });
        MB.board.renderContent(el.id);
      }));
      addCommonEnd();
      return;
    }

    if (el.type === 'palette' || el.type === 'link' ||
        el.type === 'comment' || el.type === 'file' || el.type === 'sketch') {
      addCommonEnd();
    }
  }

  function buildMulti(els) {
    var g1 = addGroup();
    [
      ['alignLeft', 'left'], ['alignCenterH', 'centerx'], ['alignRight', 'right'],
      ['alignTop', 'top'], ['alignCenterV', 'centery'], ['alignBottom', 'bottom']
    ].forEach(function (pair) {
      g1.appendChild(C.iconButton(pair[0], 'Aligner', function () {
        MB.store.alignSelection(pair[1]);
      }));
    });
    var g2 = addGroup();
    g2.appendChild(C.iconButton('distributeH', 'Répartir horizontalement', function () {
      MB.store.distributeSelection('h');
    }));
    g2.appendChild(C.iconButton('distributeV', 'Répartir verticalement', function () {
      MB.store.distributeSelection('v');
    }));

    var images = els.filter(function (e) {
      return e.type === 'image';
    });
    if (images.length >= 2) {
      var g3 = addGroup();
      var arrangeBtn = C.textButton('Disposition', function () {
        MB.ui.popover(arrangeBtn,
          '<button class="ctx-pop-item" data-arr="grid">Grille</button>' +
          '<button class="ctx-pop-item" data-arr="masonry">Masonry</button>' +
          '<button class="ctx-pop-item" data-arr="collage">Collage</button>', {
          bind: function (p) {
            p.querySelectorAll('[data-arr]').forEach(function (b) {
              b.addEventListener('click', function () {
                MB.ui.closePopover();
                MB.app.autoArrange(images, b.dataset.arr);
              });
            });
          }
        });
      }, 'Disposition automatique des images');
      g3.appendChild(arrangeBtn);
    }

    addSep();
    var g4 = addGroup();
    g4.appendChild(C.iconButton('group', 'Grouper (⌘G)', function () {
      MB.store.groupSelection();
    }));
    g4.appendChild(C.iconButton('lock', 'Verrouiller', function () {
      MB.app.toggleLock();
    }));
    addCommonEnd();
  }

  function position() {
    var sel = MB.store.selected();
    if (!sel.length) return;
    var bboxes = sel.map(MB.store.bboxOf);
    var u = U.unionRects(bboxes);
    var c = MB.store.s().camera;
    var wrap = document.getElementById('board-wrap');
    var r = wrap.getBoundingClientRect();
    var x = u.x * c.zoom + c.x + u.w * c.zoom / 2;
    var y = u.y * c.zoom + c.y;
    var bw = bar.offsetWidth;
    bar.style.left = U.clamp(x - bw / 2, 8, r.width - bw - 8) + 'px';
    var top = y - 46;
    if (top < 46) top = y + u.h * c.zoom + 12;
    bar.style.top = Math.max(8, top) + 'px';
  }

  function init() {
    bar = document.getElementById('contextbar');
    MB.store.on('selection', refresh);
    MB.store.on('camera', position);
    MB.store.on('element', position);
  }

  MB.ui = MB.ui || {};
  MB.ui.contextbar = { init: init, refresh: refresh, position: position };
})();
