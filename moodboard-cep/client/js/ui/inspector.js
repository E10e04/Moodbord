/* =========================================================================
 * inspector.js — Panneau de propriétés (droite).
 * Vide : infos projet. Sélection : géométrie + propriétés du type.
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;
  var C = null; // controls

  function refresh() {
    C = MB.ui.controls;
    var body = document.getElementById('insp-body');
    var title = document.getElementById('insp-title');
    var st = MB.store.s();
    var sel = MB.store.selected();

    if (!sel.length) {
      title.textContent = 'Projet';
      body.innerHTML = '';
      body.appendChild(projectSection());
      return;
    }

    if (sel.length === 1) {
      var el = sel[0];
      title.textContent = capitalize(el.type);
      body.innerHTML = '';
      body.appendChild(objectSection(el));
      var typeSec = typeSection(el);
      if (typeSec) body.appendChild(typeSec);
      body.appendChild(actionsSection(sel));
      return;
    }

    title.textContent = 'Sélection (' + sel.length + ')';
    body.innerHTML = '';
    body.appendChild(multiSection(sel));
    body.appendChild(actionsSection(sel));
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function section(title) {
    var s = U.el('div', 'insp-sec');
    s.appendChild(U.el('div', 'insp-title', title));
    return s;
  }

  /* ------------------------------------------------------- projet */

  function projectSection() {
    var st = MB.store.s();
    var s = section('Document');
    var counts = {};
    st.elements.forEach(function (e) {
      counts[e.type] = (counts[e.type] || 0) + 1;
    });
    var lines = Object.keys(counts).map(function (k) {
      return '<span class="chip">' + U.escapeHtml(k) + ' × ' + counts[k] + '</span>';
    }).join('');
    s.appendChild(U.el('div', 'insp-row', '<div class="chip-row">' + (lines || '<span class="chip">Vide</span>') + '</div>'));
    var zoomRow = U.el('div', 'insp-row');
    zoomRow.appendChild(U.el('span', 'insp-kv', 'Zoom'));
    var z = U.el('span', 'insp-kv insp-kv--val', Math.round(st.camera.zoom * 100) + ' %');
    zoomRow.appendChild(z);
    s.appendChild(zoomRow);
    /* v1.8 — ÉLÉMENTS MASQUÉS : tout élément caché avec l'œil reste
     * listé ici (avec un bouton pour le réactiver) — plus besoin de
     * « Révéler tout » en aveugle. */
    s.appendChild(hiddenSection());
    var hint = U.el(
      'div',
      'insp-hint',
      'Sélectionnez un objet pour éditer ses propriétés.' +
      (MB.storage.isCep()
        ? ''
        : '<br><br><em>' +
          (MB.storage.isDesktop()
            ? 'Application autonome — les fonctions Illustrator sont disponibles dans l‘extension CEP.'
            : 'Aperçu navigateur — les fonctions Illustrator sont disponibles dans le panneau CEP.') +
          '</em>')
    );
    s.appendChild(hint);
    return s;
  }

  /* Libellé lisible d'un élément (liste des masqués). */
  function elementLabel(e) {
    var t = {
      text: 'Texte', note: 'Note', comment: 'Commentaire', image: 'Image',
      color: 'Couleur', palette: 'Palette', typography: 'Typographie',
      link: 'Lien', file: 'Fichier', line: 'Ligne', shape: 'Forme',
      section: 'Section', column: 'Colonne', table: 'Tableau',
      checklist: 'Checklist', sketch: 'Croquis', board: 'Planche',
      group: 'Groupe', import: 'Carte d’import'
    }[e.type] || e.type;
    var d = e.data || {};
    var extra = d.title || d.name || d.text || (e.type === 'board' && d.doc && d.doc.name) || '';
    extra = String(extra).replace(/\s+/g, ' ').trim().slice(0, 26);
    return t + (extra ? ' · ' + extra : '');
  }

  function hiddenSection() {
    var st = MB.store.s();
    var hidden = st.elements.filter(function (e) {
      return e.hidden;
    });
    if (!hidden.length) return U.el('div');
    var s = section('Masqués (' + hidden.length + ')');
    var list = U.el('div', 'hidden-list');
    hidden.forEach(function (e) {
      var row = U.el('div', 'hidden-row');
      var label = U.el('span', 'hidden-label', U.escapeHtml(elementLabel(e)));
      row.appendChild(label);
      var eye = C.iconButton('eye', 'Réactiver cet élément', function () {
        MB.app.revealElement(e.id);
      });
      eye.classList.add('hidden-eye');
      row.appendChild(eye);
      list.appendChild(row);
    });
    s.appendChild(list);
    var rowAll = U.el('div', 'btn-row');
    rowAll.appendChild(C.textButton('Tout révéler', function () {
      MB.app.revealAll();
    }));
    s.appendChild(rowAll);
    return s;
  }

  /* ------------------------------------------------------- objet */

  function objectSection(el) {
    var s = section('Objet');

    var geo = U.el('div', 'field-grid');
    geo.appendChild(C.numberRow('X', function () {
      return el.x;
    }, function (v, commit) {
      if (commit) C.applyTo([el], 'Déplacer', { x: v });
      else el.x = v;
      MB.store.emit('element', { ids: [el.id] });
    }, { step: 1 }));
    geo.appendChild(C.numberRow('Y', function () {
      return el.y;
    }, function (v, commit) {
      if (commit) C.applyTo([el], 'Déplacer', { y: v });
      else el.y = v;
      MB.store.emit('element', { ids: [el.id] });
    }, { step: 1 }));
    geo.appendChild(C.numberRow('L', function () {
      return el.w;
    }, function (v, commit) {
      v = Math.max(8, v);
      if (commit) C.applyTo([el], 'Redimensionner', { w: v });
      else el.w = v;
      MB.store.emit('element', { ids: [el.id] });
    }, { step: 1 }));
    geo.appendChild(C.numberRow('H', function () {
      return el.h;
    }, function (v, commit) {
      v = Math.max(8, v);
      if (commit) C.applyTo([el], 'Redimensionner', { h: v });
      else el.h = v;
      MB.store.emit('element', { ids: [el.id] });
    }, { step: 1 }));
    if (el.type !== 'line') {
      geo.appendChild(C.numberRow('Angle', function () {
        return el.rotation || 0;
      }, function (v, commit) {
        if (commit) C.applyTo([el], 'Pivoter', { rotation: v });
        else el.rotation = v;
        MB.store.emit('element', { ids: [el.id] });
      }, { step: 5 }));
    }
    s.appendChild(geo);

    if (el.type === 'image') {
      var ratio = C.toggle('lock', 'Conserver les proportions', function () {
        return el.data.ratioLock !== false;
      }, function (v) {
        C.applyDataTo([el], 'Proportions', { ratioLock: v });
      });
      var row = U.el('div', 'btn-row');
      row.appendChild(ratio);
      s.appendChild(row);
    }

    // ordre
    var orderRow = U.el('div', 'btn-row');
    orderRow.appendChild(C.iconButton('back', 'Arrière-plan', function () {
      MB.app.reorderSelection('back');
    }));
    orderRow.appendChild(C.iconButton('backward', 'Reculer', function () {
      MB.app.reorderSelection('backward');
    }));
    orderRow.appendChild(C.iconButton('forward', 'Avancer', function () {
      MB.app.reorderSelection('forward');
    }));
    orderRow.appendChild(C.iconButton('front', 'Premier plan', function () {
      MB.app.reorderSelection('front');
    }));
    s.appendChild(orderRow);

    return s;
  }

  /* ------------------------------------------------------- type */

  function typeSection(el) {
    var d = el.data;
    var s = null;

    if (el.type === 'text') {
      s = section('Texte');
      s.appendChild(textControls(el));
    } else if (el.type === 'note') {
      s = section('Note');
      var rowN = U.el('div', 'btn-row');
      rowN.appendChild(C.fontButton(function () {
        return d.fontFamily || 'Georgia';
      }, function (f) {
        C.applyDataTo([el], 'Police', { fontFamily: f });
        MB.board.renderContent(el.id);
      }));
      rowN.appendChild(C.sizeControl(function () {
        return d.fontSize;
      }, function (v) {
        C.applyDataTo([el], 'Taille', { fontSize: Math.max(10, v) });
        MB.board.renderContent(el.id);
      }));
      rowN.appendChild(C.colorButton(function () {
        return d.color;
      }, function (hex) {
        C.applyDataTo([el], 'Couleur de la note', { color: hex });
        MB.board.renderContent(el.id);
      }, 'Couleur du post-it'));
      s.appendChild(rowN);
      /* v1.8 — mise en forme de la note ENTIÈRE : liste à puces,
       * retrait du formatage (la mise en forme par SÉLECTION vit dans
       * la barre au-dessus de la note pendant l'édition). */
      var rowRich = U.el('div', 'btn-row');
      rowRich.appendChild(C.textButton('• Liste à puces', function () {
        if (!MB.rich) return;
        var src = d.html !== undefined && d.html ? d.html : d.text || '';
        var html = MB.rich.toBulletList(src);
        if (!html) {
          MB.ui.toast('La note est vide.', 'info');
          return;
        }
        C.applyDataTo([el], 'Liste à puces', { html: html, autoH: true });
        MB.board.renderContent(el.id);
        refresh();
      }, 'Convertir toute la note en liste à puces'));
      rowRich.appendChild(C.textButton('Aa Plain', function () {
        C.applyDataTo([el], 'Retirer la mise en forme', { html: '', autoH: true });
        MB.board.renderContent(el.id);
        refresh();
      }, 'Retirer la mise en forme de la note'));
      s.appendChild(rowRich);
      var hintRich = U.el('div', 'insp-hint', 'Double-cliquez la note : la barre au-dessus met en forme la sélection (gras, italique, soulignage, surlignage, listes, police).');
      s.appendChild(hintRich);
    } else if (el.type === 'comment') {
      s = section('Commentaire');
      var rowCm = U.el('div', 'btn-row');
      rowCm.appendChild(C.fontButton(function () {
        return d.fontFamily || 'Georgia';
      }, function (f) {
        C.applyDataTo([el], 'Police', { fontFamily: f });
        MB.board.renderContent(el.id);
      }));
      rowCm.appendChild(C.sizeControl(function () {
        return d.fontSize || 13;
      }, function (v) {
        C.applyDataTo([el], 'Taille', { fontSize: U.clamp(v, 9, 60) });
        MB.board.renderContent(el.id);
      }));
      s.appendChild(rowCm);
      var row2 = U.el('div', 'btn-row');
      row2.appendChild(C.colorButton(function () {
        return d.color;
      }, function (hex) {
        C.applyDataTo([el], 'Couleur', { color: hex });
        MB.board.renderContent(el.id);
      }, 'Couleur'));
      s.appendChild(row2);
    } else if (el.type === 'image') {
      s = section('Image');
      var rowI = U.el('div', 'btn-row');
      rowI.appendChild(C.opacityControl(function () {
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
      rowI.appendChild(C.iconButton('crop', 'Recadrer (double-clic)', function () {
        MB.interact.enterCrop(el);
      }));
      rowI.appendChild(C.iconButton('refresh', 'Remplacer l’image', function () {
        MB.interact.openImportPicker(null);
        var input = document.getElementById('file-import');
        input.onchange = function () {
          if (input.files && input.files[0]) {
            var f = input.files[0];
            var apply = function (url) {
              var img = new Image();
              img.onload = function () {
                C.applyDataTo([el], 'Remplacer l’image', {
                  src: url,
                  naturalW: img.naturalWidth,
                  naturalH: img.naturalHeight,
                  crop: null
                });
                el._sized = true;
                MB.board.renderContent(el.id);
                MB.board.refreshOverlay();
              };
              img.src = url;
            };
            if (MB.storage.hasOsPaths() && f.path) {
              var res = MB.storage.readFileAny(f.path, 'Base64');
              if (res && res.err === 0) apply('data:image/png;base64,' + res.data);
            } else {
              var fr = new FileReader();
              fr.onload = function () {
                apply(String(fr.result));
              };
              fr.readAsDataURL(f);
            }
          }
        };
      }));
      s.appendChild(rowI);
      var rowI2 = U.el('div', 'field-grid');
      rowI2.appendChild(C.numberRow('Rayon', function () {
        return d.radius;
      }, function (v, commit) {
        v = U.clamp(v, 0, 200);
        d.radius = v;
        if (commit) {
          MB.storage.markDirty();
          MB.hist.begin('Arrondi');
          MB.hist.commit();
        }
        MB.board.renderContent(el.id);
      }));
      rowI2.appendChild(C.numberRow('Bordure', function () {
        return d.border;
      }, function (v, commit) {
        v = U.clamp(v, 0, 20);
        d.border = v;
        if (commit) {
          MB.storage.markDirty();
          MB.hist.begin('Bordure');
          MB.hist.commit();
        }
        MB.board.renderContent(el.id);
      }));
      s.appendChild(rowI2);
      var rowI3 = U.el('div', 'btn-row');
      rowI3.appendChild(C.toggle('sparkle', 'Ombre', function () {
        return !!d.shadow;
      }, function (v) {
        C.applyDataTo([el], 'Ombre', { shadow: v });
      }));
      s.appendChild(rowI3);
    } else if (el.type === 'line') {
      s = section('Ligne');
      var rowL = U.el('div', 'btn-row');
      rowL.appendChild(C.colorButton(function () {
        return d.color;
      }, function (hex) {
        C.applyDataTo([el], 'Couleur de ligne', { color: hex });
        MB.board.renderContent(el.id);
      }, 'Couleur'));
      rowL.appendChild(C.sizeControl(function () {
        return d.thickness;
      }, function (v) {
        C.applyDataTo([el], 'Épaisseur', { thickness: U.clamp(v, 1, 20) });
        MB.board.renderContent(el.id);
      }));
      s.appendChild(rowL);
      var rowL2 = U.el('div', 'btn-row');
      rowL2.appendChild(C.seg(
        [
          { id: 'solid', icon: 'minus', label: 'Trait plein' },
          { id: 'dashed', icon: 'line', label: 'Tirets' },
          { id: 'dotted', icon: 'more', label: 'Pointillés' }
        ],
        function () {
          return d.style;
        },
        function (v) {
          C.applyDataTo([el], 'Style de ligne', { style: v });
          MB.board.renderContent(el.id);
        }
      ));
      s.appendChild(rowL2);
      var rowL3 = U.el('div', 'btn-row');
      rowL3.appendChild(C.toggle('arrowRight', 'Flèche début', function () {
        return !!d.startArrow;
      }, function (v) {
        C.applyDataTo([el], 'Flèche début', { startArrow: v });
        MB.board.renderContent(el.id);
      }));
      rowL3.appendChild(C.toggle('arrowRight', 'Flèche fin', function () {
        return !!d.endArrow;
      }, function (v) {
        C.applyDataTo([el], 'Flèche fin', { endArrow: v });
        MB.board.renderContent(el.id);
      }));
      s.appendChild(rowL3);
      var rowL4 = U.el('div', 'btn-row');
      var labelBtn = C.textButton(d.label ? '“' + d.label + '”' : 'Étiquette', function () {
        MB.ui.promptDialog({
          title: 'Étiquette de la ligne',
          label: 'Texte',
          value: d.label || ''
        }).then(function (v) {
          if (v === null) return;
          C.applyDataTo([el], 'Étiquette', { label: v });
          MB.board.renderContent(el.id);
        });
      }, 'Libellé au milieu de la ligne');
      rowL4.appendChild(labelBtn);
      s.appendChild(rowL4);
    } else if (el.type === 'color') {
      s = section('Couleur');
      var rowC = U.el('div', 'btn-row');
      rowC.appendChild(C.colorButton(function () {
        return d.hex;
      }, function (hex) {
        C.applyDataTo([el], 'Couleur', { hex: hex });
        MB.board.renderContent(el.id);
      }, 'Couleur'));
      rowC.appendChild(C.textButton('Copier', function () {
        try {
          navigator.clipboard.writeText(d.hex);
        } catch (e) {
          /* repli */
        }
        MB.ui.toast('Copié : ' + d.hex, 'success');
      }));
      s.appendChild(rowC);
    } else if (el.type === 'palette') {
      s = section('Palette');
      var addBtn = C.textButton('+ Ajouter une couleur', function () {
        C.colorPopover(addBtn, '#4C8DFF', function (hex) {
          var colors = d.colors.concat([{ hex: hex, name: 'Nouvelle' }]);
          C.applyDataTo([el], 'Ajouter une couleur', { colors: colors });
          el.h = 46 + colors.length * 36;
          MB.board.renderContent(el.id);
          refresh();
        });
      });
      var rowP = U.el('div', 'btn-row');
      rowP.appendChild(addBtn);
      s.appendChild(rowP);
      d.colors.forEach(function (c, idx) {
        var row = U.el('div', 'insp-swatch-row');
        var dot = U.el('span', 'insp-swatch-dot');
        dot.style.background = c.hex;
        row.appendChild(dot);
        var name = U.el('input', 'input input--inline');
        name.value = c.name;
        name.addEventListener('change', function () {
          var colors = d.colors.map(function (x, i) {
            return i === idx ? { hex: x.hex, name: name.value } : x;
          });
          C.applyDataTo([el], 'Renommer', { colors: colors });
        });
        row.appendChild(name);
        var del = C.iconButton('x', 'Retirer', function () {
          var colors = d.colors.filter(function (x, i) {
            return i !== idx;
          });
          C.applyDataTo([el], 'Retirer une couleur', { colors: colors });
          el.h = 46 + colors.length * 36;
          MB.board.renderContent(el.id);
          refresh();
        });
        row.appendChild(del);
        s.appendChild(row);
      });
    } else if (el.type === 'typography') {
      s = section('Typographie');
      var rowT = U.el('div', 'btn-row');
      rowT.appendChild(C.fontButton(function () {
        return d.fontFamily;
      }, function (f) {
        C.applyDataTo([el], 'Police', { fontFamily: f });
        MB.board.renderContent(el.id);
      }));
      s.appendChild(rowT);
    } else if (el.type === 'link') {
      s = section('Lien');
      var urlInput = U.el('input', 'input');
      urlInput.value = d.url;
      urlInput.placeholder = 'https://…';
      urlInput.spellcheck = false;
      urlInput.addEventListener('change', function () {
        var url = urlInput.value.trim();
        C.applyDataTo([el], 'Modifier le lien', {
          url: url,
          title: U.titleFromUrl(url),
          domain: U.domainOf(url)
        });
      });
      s.appendChild(urlInput);
      /* v1.6 — presse-papiers explicite : selon l'hôte (Illustrator
       * notamment), ⌘V/⌘C natifs peuvent être interceptés — ces boutons
       * garantissent coller/copier un lien dans tous les environnements. */
      var rowClip = U.el('div', 'btn-row');
      rowClip.appendChild(C.textButton('Coller', function () {
        MB.clip.readText().then(function (text) {
          if (text === null || text === undefined || text === '') {
            MB.ui.toast('Presse-papiers vide ou inaccessible.', 'info');
            return;
          }
          var url = String(text).trim();
          if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && /\./.test(url)) url = 'https://' + url;
          urlInput.value = url;
          urlInput.dispatchEvent(new Event('change', { bubbles: true }));
          MB.ui.toast('Lien collé depuis le presse-papiers', 'success');
        });
      }, 'Coller le lien du presse-papiers'));
      rowClip.appendChild(C.textButton('Copier', function () {
        MB.clip.copyText(d.url || '').then(function (ok) {
          MB.ui.toast(ok ? 'Lien copié : ' + d.url : 'Copie impossible.', ok ? 'success' : 'error');
        });
      }, 'Copier l’URL dans le presse-papiers'));
      s.appendChild(rowClip);
      var rowU = U.el('div', 'btn-row');
      rowU.appendChild(C.textButton('Ouvrir', function () {
        if (MB.cep.available()) MB.cep.openURL(d.url);
        else window.open(d.url, '_blank');
      }));
      s.appendChild(rowU);
      /* v1.8 — police du titre du lien. */
      var rowLkF = U.el('div', 'btn-row');
      rowLkF.appendChild(C.fontButton(function () {
        return d.titleFont || 'Georgia';
      }, function (f) {
        C.applyDataTo([el], 'Police du titre', { titleFont: f });
        MB.board.renderContent(el.id);
      }));
      s.appendChild(rowLkF);
    } else if (el.type === 'board') {
      s = section('Planche liée');
      var bCount = d && d.doc && Array.isArray(d.doc.elements) ? d.doc.elements.length : 0;
      var rowB0 = U.el('div', 'insp-row');
      rowB0.appendChild(U.el('span', 'insp-kv', 'Contenu'));
      rowB0.appendChild(U.el('span', 'insp-kv insp-kv--val', bCount + ' élément' + (bCount > 1 ? 's' : '')));
      s.appendChild(rowB0);
      var rowB1 = U.el('div', 'btn-row');
      rowB1.appendChild(C.textButton(bCount ? 'Ouvrir la planche' : 'Travailler dedans', function () {
        if (MB.boards) MB.boards.enter(el);
      }));
      rowB1.appendChild(C.textButton('Renommer', function () {
        MB.interact.startEditing(el, 'title');
      }));
      s.appendChild(rowB1);
      /* v1.8 — police du titre de la carte planche. */
      var rowBf = U.el('div', 'btn-row');
      rowBf.appendChild(C.fontButton(function () {
        return d.titleFont || 'Georgia';
      }, function (f) {
        C.applyDataTo([el], 'Police du titre', { titleFont: f });
        MB.board.renderContent(el.id);
      }));
      rowBf.appendChild(C.sizeControl(function () {
        return d.titleSize || 19;
      }, function (v) {
        C.applyDataTo([el], 'Taille du titre', { titleSize: U.clamp(v, 10, 48) });
        MB.board.renderContent(el.id);
      }));
      s.appendChild(rowBf);
      var rowB2 = U.el('div', 'insp-hint');
      rowB2.innerHTML =
        'Cliquez sur la flèche de la carte pour ouvrir la planche · Alt+← ou son nom en haut pour revenir.' +
        '<br>Le contenu de la planche est enregistré DANS le fichier du moodboard racine.';
      s.appendChild(rowB2);
    } else if (el.type === 'shape') {
      s = section('Forme');
      var rowS = U.el('div', 'btn-row');
      rowS.appendChild(C.colorButton(function () {
        return d.fill;
      }, function (hex) {
        C.applyDataTo([el], 'Remplissage', { fill: hex });
        MB.board.renderContent(el.id);
      }, 'Remplissage'));
      rowS.appendChild(C.colorButton(function () {
        return d.stroke === 'none' ? '#F5F5F5' : d.stroke;
      }, function (hex) {
        C.applyDataTo([el], 'Contour', { stroke: hex, strokeWidth: d.strokeWidth || 2 });
        MB.board.renderContent(el.id);
      }, 'Contour'));
      s.appendChild(rowS);
      var rowS2 = U.el('div', 'btn-row');
      rowS2.appendChild(C.textButton(d.stroke === 'none' ? 'Sans contour' : 'Retirer le contour', function () {
        C.applyDataTo([el], 'Contour', { stroke: 'none' });
        MB.board.renderContent(el.id);
        refresh();
      }));
      if (d.shape === 'rect') {
        rowS2.appendChild(C.sizeControl(function () {
          return d.radius;
        }, function (v) {
          C.applyDataTo([el], 'Arrondi', { radius: U.clamp(v, 0, 100) });
          MB.board.renderContent(el.id);
        }));
      }
      s.appendChild(rowS2);
    } else if (el.type === 'section' || el.type === 'column') {
      s = section(el.type === 'section' ? 'Section' : 'Colonne');
      var rowSec = U.el('div', 'btn-row');
      rowSec.appendChild(C.colorButton(function () {
        return d.color;
      }, function (hex) {
        C.applyDataTo([el], 'Couleur', { color: hex });
        MB.board.renderContent(el.id);
      }, 'Fond'));
      rowSec.appendChild(C.textButton('Renommer', function () {
        MB.interact.startEditing(el, 'title');
      }));
      s.appendChild(rowSec);
      /* v1.8 — police du titre de la section / colonne. */
      var rowSecF = U.el('div', 'btn-row');
      rowSecF.appendChild(C.fontButton(function () {
        return d.titleFont || 'Georgia';
      }, function (f) {
        C.applyDataTo([el], 'Police du titre', { titleFont: f });
        MB.board.renderContent(el.id);
      }));
      rowSecF.appendChild(C.sizeControl(function () {
        return d.titleSize || 15;
      }, function (v) {
        C.applyDataTo([el], 'Taille du titre', { titleSize: U.clamp(v, 9, 40) });
        MB.board.renderContent(el.id);
      }));
      s.appendChild(rowSecF);
      if (el.type === 'section') {
        var rowSec2 = U.el('div', 'btn-row');
        rowSec2.appendChild(C.toggle('eye', 'Titre visible', function () {
          return d.showTitle !== false;
        }, function (v) {
          C.applyDataTo([el], 'Titre', { showTitle: v });
          MB.board.renderContent(el.id);
        }));
        s.appendChild(rowSec2);
      }
    } else if (el.type === 'import') {
      s = section('Import');
      var rowIm = U.el('div', 'btn-row');
      rowIm.appendChild(C.textButton('Choisir des fichiers…', function () {
        MB.interact.openImportPicker({ x: el.x + el.w / 2, y: el.y + el.h / 2 });
      }, 'Ouvrir l’explorateur'));
      s.appendChild(rowIm);
      var hintIm = U.el('div', 'insp-hint');
      hintIm.innerHTML =
        'Double-cliquez la carte ou déposez-y des fichiers : images, documents et moodboards' +
        ' — un <strong>.moodboard</strong> importé devient une planche liée (nom + nombre d’éléments).';
      s.appendChild(hintIm);
    } else if (el.type === 'table') {
      s = section('Tableau');
      var rowTb = U.el('div', 'btn-row');
      rowTb.appendChild(C.textButton('+ Ligne', function () {
        var cells = d.cells.map(function (r) {
          return r.slice();
        });
        var row = [];
        for (var i = 0; i < d.cols; i++) row.push('');
        cells.push(row);
        C.applyDataTo([el], 'Ajouter une ligne', { rows: d.rows + 1, cells: cells });
        el.h = d.rows * 46;
        MB.board.renderContent(el.id);
      }));
      rowTb.appendChild(C.textButton('− Ligne', function () {
        if (d.rows <= 1) return;
        var cells = d.cells.slice(0, -1);
        C.applyDataTo([el], 'Retirer une ligne', { rows: d.rows - 1, cells: cells });
        el.h = d.rows * 46;
        MB.board.renderContent(el.id);
      }));
      rowTb.appendChild(C.textButton('+ Colonne', function () {
        var cells = d.cells.map(function (r) {
          return r.concat(['']);
        });
        C.applyDataTo([el], 'Ajouter une colonne', { cols: d.cols + 1, cells: cells });
      }));
      rowTb.appendChild(C.textButton('− Colonne', function () {
        if (d.cols <= 1) return;
        var cells = d.cells.map(function (r) {
          return r.slice(0, -1);
        });
        C.applyDataTo([el], 'Retirer une colonne', { cols: d.cols - 1, cells: cells });
      }));
      s.appendChild(rowTb);
      var rowTb2 = U.el('div', 'btn-row');
      rowTb2.appendChild(C.toggle('bold', 'Ligne d’en-tête', function () {
        return !!d.header;
      }, function (v) {
        C.applyDataTo([el], 'En-tête', { header: v });
        MB.board.renderContent(el.id);
      }));
      s.appendChild(rowTb2);

      /* v1.8 — COULEURS du tableau : toutes les cellules, la ligne
       * d'en-têtes, ou une ligne / colonne précise. */
      var rowTbC = U.el('div', 'btn-row');
      rowTbC.appendChild(C.colorButton(function () {
        return d.cellBg || '#252525';
      }, function (hex) {
        C.applyDataTo([el], 'Fond des cellules', { cellBg: hex });
        MB.board.renderContent(el.id);
      }, 'Fond de toutes les cellules'));
      rowTbC.appendChild(C.colorButton(function () {
        return d.headBg || '#3A3A3A';
      }, function (hex) {
        C.applyDataTo([el], 'Fond de l’en-tête', { headBg: hex });
        MB.board.renderContent(el.id);
      }, 'Fond de la ligne d’en-têtes'));
      rowTbC.appendChild(C.colorButton(function () {
        return d.textColor || '#F5F5F5';
      }, function (hex) {
        C.applyDataTo([el], 'Couleur du texte', { textColor: hex });
        MB.board.renderContent(el.id);
      }, 'Couleur du texte des cellules'));
      rowTbC.appendChild(C.colorButton(function () {
        return d.headColor || '#F5F5F5';
      }, function (hex) {
        C.applyDataTo([el], 'Couleur du texte d’en-tête', { headColor: hex });
        MB.board.renderContent(el.id);
      }, 'Couleur du texte des en-têtes'));
      s.appendChild(rowTbC);

      /* Peinture d'une LIGNE / COLONNE précise. */
      var rowIdx = { v: 1 };
      var colIdx = { v: 1 };

      function setPaint(kind, n, hex) {
        var arr = ((kind === 'row' ? d.rowBgs : d.colBgs) || []).slice();
        while (arr.length < n) arr.push('');
        arr[n - 1] = hex;
        var patch = {};
        patch[kind === 'row' ? 'rowBgs' : 'colBgs'] = arr;
        C.applyDataTo([el], kind === 'row' ? 'Couleur de ligne' : 'Couleur de colonne', patch);
        MB.board.renderContent(el.id);
      }

      var paintGrid = U.el('div', 'field-grid');
      paintGrid.appendChild(C.numberRow('Ligne n°', function () {
        return rowIdx.v;
      }, function (v, commit) {
        rowIdx.v = U.clamp(Math.round(v) || 1, 1, d.rows);
        if (commit) refresh();
      }, { min: 1, max: d.rows, step: 1 }));
      paintGrid.appendChild(C.numberRow('Colonne n°', function () {
        return colIdx.v;
      }, function (v, commit) {
        colIdx.v = U.clamp(Math.round(v) || 1, 1, d.cols);
        if (commit) refresh();
      }, { min: 1, max: d.cols, step: 1 }));
      s.appendChild(paintGrid);

      var rowPaint = U.el('div', 'btn-row');
      var rowBtn = C.textButton('Peindre la ligne ' + rowIdx.v, function () {
        C.colorPopover(rowBtn, function () {
          return (d.rowBgs && d.rowBgs[rowIdx.v - 1]) || d.cellBg || '#252525';
        }, function (hex) {
          setPaint('row', rowIdx.v, hex);
          refresh();
        });
      }, 'Couleur de la ligne choisie ci-dessus');
      rowPaint.appendChild(rowBtn);
      rowPaint.appendChild(C.iconButton('x', 'Retirer la couleur de la ligne', function () {
        setPaint('row', rowIdx.v, '');
        refresh();
      }));
      var colBtn = C.textButton('Peindre la colonne ' + colIdx.v, function () {
        C.colorPopover(colBtn, function () {
          return (d.colBgs && d.colBgs[colIdx.v - 1]) || d.cellBg || '#252525';
        }, function (hex) {
          setPaint('col', colIdx.v, hex);
          refresh();
        });
      }, 'Couleur de la colonne choisie ci-dessus');
      rowPaint.appendChild(colBtn);
      rowPaint.appendChild(C.iconButton('x', 'Retirer la couleur de la colonne', function () {
        setPaint('col', colIdx.v, '');
        refresh();
      }));
      s.appendChild(rowPaint);

      /* v1.8 — POLICE du texte du tableau. */
      var rowTbF = U.el('div', 'btn-row');
      rowTbF.appendChild(C.fontButton(function () {
        return d.fontFamily || 'Georgia';
      }, function (f) {
        C.applyDataTo([el], 'Police', { fontFamily: f });
        MB.board.renderContent(el.id);
      }));
      rowTbF.appendChild(C.sizeControl(function () {
        return d.fontSize || 12;
      }, function (v) {
        C.applyDataTo([el], 'Taille', { fontSize: U.clamp(v, 8, 40) });
        MB.board.renderContent(el.id);
      }));
      s.appendChild(rowTbF);
    } else if (el.type === 'checklist') {
      s = section('Checklist');
      var rowCk = U.el('div', 'btn-row');
      rowCk.appendChild(C.textButton('+ Tâche', function () {
        var node = document.querySelector('.mb-el[data-id="' + el.id + '"] .mb-check-add');
        if (node) node.click();
      }));
      rowCk.appendChild(C.textButton('Nettoyer les terminées', function () {
        var items = d.items.filter(function (it) {
          return !it.done;
        });
        C.applyDataTo([el], 'Nettoyer', { items: items });
        el.h = 60 + items.length * 38;
        MB.board.renderContent(el.id);
        refresh();
      }));
      s.appendChild(rowCk);
      /* v1.8 — police de la checklist (titre + tâches). */
      var rowCkF = U.el('div', 'btn-row');
      rowCkF.appendChild(C.fontButton(function () {
        return d.fontFamily || 'Georgia';
      }, function (f) {
        C.applyDataTo([el], 'Police', { fontFamily: f });
        MB.board.renderContent(el.id);
      }));
      rowCkF.appendChild(C.sizeControl(function () {
        return d.fontSize || 13;
      }, function (v) {
        C.applyDataTo([el], 'Taille', { fontSize: U.clamp(v, 9, 30) });
        MB.board.renderContent(el.id);
      }));
      s.appendChild(rowCkF);
    } else if (el.type === 'sketch') {
      s = section('Croquis');
      var rowSk = U.el('div', 'btn-row');
      rowSk.appendChild(C.colorButton(function () {
        return d.color;
      }, function (hex) {
        C.applyDataTo([el], 'Couleur du trait', { color: hex });
        MB.board.renderContent(el.id);
      }, 'Couleur'));
      rowSk.appendChild(C.sizeControl(function () {
        return d.thickness;
      }, function (v) {
        C.applyDataTo([el], 'Épaisseur', { thickness: U.clamp(v, 1, 20) });
        MB.board.renderContent(el.id);
      }));
      s.appendChild(rowSk);
    }

    return s;
  }

  function textControls(el) {
    var d = el.data;
    var box = U.el('div', 'text-controls');
    var row1 = U.el('div', 'btn-row');
    row1.appendChild(C.fontButton(function () {
      return d.fontFamily;
    }, function (f) {
      C.applyDataTo([el], 'Police', { fontFamily: f });
      MB.board.renderContent(el.id);
    }));
    row1.appendChild(C.sizeControl(function () {
      return d.fontSize;
    }, function (v) {
      C.applyDataTo([el], 'Taille', { fontSize: U.clamp(v, 8, 200) });
      MB.board.renderContent(el.id);
      refresh();
    }));
    box.appendChild(row1);
    var row2 = U.el('div', 'btn-row');
    row2.appendChild(C.toggle('bold', 'Gras', function () {
      return !!d.bold;
    }, function (v) {
      C.applyDataTo([el], 'Gras', { bold: v });
      MB.board.renderContent(el.id);
    }));
    row2.appendChild(C.toggle('italic', 'Italique', function () {
      return !!d.italic;
    }, function (v) {
      C.applyDataTo([el], 'Italique', { italic: v });
      MB.board.renderContent(el.id);
    }));
    row2.appendChild(C.toggle('underline', 'Souligné', function () {
      return !!d.underline;
    }, function (v) {
      C.applyDataTo([el], 'Souligné', { underline: v });
      MB.board.renderContent(el.id);
    }));
    row2.appendChild(C.toggle('strike', 'Barré', function () {
      return !!d.strike;
    }, function (v) {
      C.applyDataTo([el], 'Barré', { strike: v });
      MB.board.renderContent(el.id);
    }));
    box.appendChild(row2);
    var row3 = U.el('div', 'btn-row');
    row3.appendChild(C.seg(
      [
        { id: 'left', icon: 'alignTextLeft', label: 'Aligner à gauche' },
        { id: 'center', icon: 'alignTextCenter', label: 'Centrer' },
        { id: 'right', icon: 'alignTextRight', label: 'Aligner à droite' }
      ],
      function () {
        return d.align;
      },
      function (v) {
        C.applyDataTo([el], 'Alignement', { align: v });
        MB.board.renderContent(el.id);
      }
    ));
    row3.appendChild(C.colorButton(function () {
      return d.color;
    }, function (hex) {
      C.applyDataTo([el], 'Couleur du texte', { color: hex });
      MB.board.renderContent(el.id);
    }, 'Couleur du texte'));
    row3.appendChild(C.colorButton(function () {
      return d.bg === 'transparent' ? '#2C2C2C' : d.bg;
    }, function (hex) {
      C.applyDataTo([el], 'Fond du texte', { bg: hex });
      MB.board.renderContent(el.id);
    }, 'Fond / surlignage'));
    box.appendChild(row3);
    var row4 = U.el('div', 'btn-row');
    var clearBg = C.textButton('Sans fond', function () {
      C.applyDataTo([el], 'Fond du texte', { bg: 'transparent' });
      MB.board.renderContent(el.id);
    });
    row4.appendChild(clearBg);
    box.appendChild(row4);
    return box;
  }

  /* ------------------------------------------------------- multi */

  function multiSection(els) {
    var s = section('Alignement & distribution');

    var row1 = U.el('div', 'btn-row');
    [
      ['alignLeft', 'left'], ['alignCenterH', 'centerx'], ['alignRight', 'right'],
      ['alignTop', 'top'], ['alignCenterV', 'centery'], ['alignBottom', 'bottom']
    ].forEach(function (pair) {
      row1.appendChild(C.iconButton(pair[0], alignLabel(pair[1]), function () {
        MB.store.alignSelection(pair[1]);
      }));
    });
    s.appendChild(row1);

    var row2 = U.el('div', 'btn-row');
    row2.appendChild(C.iconButton('distributeH', 'Répartir horizontalement (3+)', function () {
      MB.store.distributeSelection('h');
    }));
    row2.appendChild(C.iconButton('distributeV', 'Répartir verticalement (3+)', function () {
      MB.store.distributeSelection('v');
    }));
    s.appendChild(row2);

    // auto-arrange pour images
    var images = els.filter(function (e) {
      return e.type === 'image';
    });
    if (images.length >= 2) {
      var s2 = section('Disposition automatique');
      var row3 = U.el('div', 'btn-row');
      row3.appendChild(C.textButton('Grille', function () {
        MB.app.autoArrange(images, 'grid');
      }));
      row3.appendChild(C.textButton('Masonry', function () {
        MB.app.autoArrange(images, 'masonry');
      }));
      row3.appendChild(C.textButton('Collage', function () {
        MB.app.autoArrange(images, 'collage');
      }));
      s2.appendChild(row3);
      var wrap = U.el('div');
      wrap.appendChild(s);
      wrap.appendChild(s2);
      return wrap;
    }

    return s;
  }

  function alignLabel(mode) {
    return {
      left: 'Aligner à gauche',
      centerx: 'Centrer horizontalement',
      right: 'Aligner à droite',
      top: 'Aligner en haut',
      centery: 'Centrer verticalement',
      bottom: 'Aligner en bas'
    }[mode];
  }

  /* ------------------------------------------------------- actions */

  function actionsSection(els) {
    var s = section('Actions');
    var row = U.el('div', 'btn-row');
    row.appendChild(C.iconButton('copy', 'Dupliquer (⌘D)', function () {
      MB.store.duplicateSelection();
    }));
    row.appendChild(C.iconButton('lock', els[0].locked ? 'Déverrouiller' : 'Verrouiller', function () {
      MB.app.toggleLock();
    }));
    row.appendChild(C.iconButton('eyeOff', 'Masquer', function () {
      MB.app.toggleHide(true);
    }));
    row.appendChild(C.iconButton('trash', 'Supprimer', function () {
      MB.app.deleteSelection();
    }));
    s.appendChild(row);
    if (els.length >= 2) {
      var row2 = U.el('div', 'btn-row');
      row2.appendChild(C.iconButton('group', 'Grouper (⌘G)', function () {
        MB.store.groupSelection();
      }));
      s.appendChild(row2);
    }
    return s;
  }

  function init() {
    MB.store.on('selection', refresh);
    MB.store.on('elements', refresh);
    refresh();
  }

  MB.ui = MB.ui || {};
  MB.ui.inspector = { init: init, refresh: refresh };
})();
