/* =========================================================================
 * controls.js — Contrôles partagés (inspecteur + barre contextuelle) :
 * steppers numériques, sélecteurs, popovers couleur / police / opacité.
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  /* Applique un patch aux éléments sélectionnés avec une transaction. */
  function applyTo(els, label, patch) {
    MB.store.mutate(label, function () {
      els.forEach(function (el) {
        MB.store.updateElement(el.id, patch, { transaction: true });
      });
    });
  }

  function applyDataTo(els, label, dataPatch) {
    MB.store.mutate(label, function () {
      els.forEach(function (el) {
        MB.store.updateElement(el.id, { data: dataPatch }, { transaction: true });
      });
    });
    if (MB.board) MB.board.refreshOverlay();
  }

  /* -------------------------------------------------------- boutons */

  function iconButton(icon, tip, onClick, opts) {
    var b = U.el('button', 'ctx-btn' + (opts && opts.active ? ' is-active' : ''));
    b.type = 'button';
    b.innerHTML = MB.icons.get(icon, 16);
    b.setAttribute('data-tip', tip || '');
    b.setAttribute('aria-label', tip || '');
    b.addEventListener('click', onClick);
    return b;
  }

  function seg(items, getValue, onSet) {
    // items : [{id, icon, label}]
    var wrap = U.el('div', 'ctx-seg');
    items.forEach(function (it) {
      var b = U.el('button', 'ctx-seg-btn' + (getValue() === it.id ? ' is-active' : ''));
      b.type = 'button';
      b.innerHTML = MB.icons.get(it.icon, 15);
      b.setAttribute('data-tip', it.label || '');
      b.setAttribute('aria-label', it.label || '');
      b.addEventListener('click', function () {
        onSet(it.id);
        wrap.querySelectorAll('.ctx-seg-btn').forEach(function (x) {
          x.classList.remove('is-active');
        });
        b.classList.add('is-active');
      });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function toggle(icon, tip, isActive, onToggle) {
    return iconButton(icon, tip, function () {
      onToggle(!isActive());
      refreshContext();
    });
  }

  function refreshContext() {
    if (MB.board) MB.board.refreshOverlay();
    if (MB.ui.inspector) MB.ui.inspector.refresh();
  }

  /* ------------------------------------------------------ numérique */

  function numberRow(label, get, set, opts) {
    var o = opts || {};
    var row = U.el('div', 'field');
    row.appendChild(U.el('label', 'field-label', label));
    var wrap = U.el('div', 'num-input');
    var input = U.el('input');
    input.type = 'number';
    input.value = U.round(get(), 1);
    if (o.min !== undefined) input.min = String(o.min);
    if (o.max !== undefined) input.max = String(o.max);
    if (o.step) input.step = String(o.step);
    input.addEventListener('input', function () {
      var v = parseFloat(input.value);
      if (!isNaN(v)) set(v, false);
    });
    input.addEventListener('change', function () {
      var v = parseFloat(input.value);
      if (isNaN(v)) return;
      set(v, true);
      input.value = U.round(get(), 1);
    });
    wrap.appendChild(input);
    row.appendChild(wrap);
    return row;
  }

  /* --------------------------------------------------------- couleur */

  var SWATCHES = [
    '#F5F5F5', '#A8A8A8', '#3A3A3A', '#1E1E1E', '#4C8DFF',
    '#7A522E', '#B0673F', '#E4D0B8', '#F5F1EA', '#F7D46A',
    '#F2A93B', '#D96C3F', '#A63D2F', '#5C2E2E', '#8A9B7E',
    '#5F7161', '#C9D2B8', '#22303B', '#9DB2CE', '#9C4F7C',
    '#E08D6D', '#F6C7A8', '#6F4E37', '#D9B99B', '#F1E5D0'
  ];

  function colorPopover(anchor, current, onPick) {
    var html =
      '<div class="swatch-grid">' +
      SWATCHES.map(function (c) {
        return '<button class="swatch" data-hex="' + c + '" style="background:' + c + '" title="' + c + '"></button>';
      }).join('') +
      '</div>' +
      '<div class="pop-row">' +
      '<input class="input input--hex" id="pop-hex" value="' + (U.normalizeHex(current) || '#1E1E1E') + '">' +
      (MB.storage.isCep() ? '' : '<input type="color" id="pop-native" value="' + (U.normalizeHex(current) || '#1E1E1E') + '">') +
      '</div>';
    MB.ui.popover(anchor, html, {
      bind: function (p) {
        p.querySelectorAll('.swatch').forEach(function (s) {
          s.addEventListener('click', function () {
            onPick(s.dataset.hex);
            MB.ui.closePopover();
          });
        });
        var hex = p.querySelector('#pop-hex');
        hex.addEventListener('change', function () {
          var v = U.normalizeHex(hex.value);
          if (v) onPick(v);
        });
        var nat = p.querySelector('#pop-native');
        if (nat) {
          nat.addEventListener('input', function () {
            var v = U.normalizeHex(nat.value);
            if (v) {
              onPick(v);
              hex.value = v;
            }
          });
        }
      }
    });
  }

  function colorButton(current, onPick, tip) {
    var b = U.el('button', 'ctx-btn ctx-color-btn');
    b.type = 'button';
    b.setAttribute('data-tip', tip || 'Couleur');
    b.setAttribute('aria-label', tip || 'Couleur');
    b.innerHTML = '<span class="ctx-color-dot" style="background:' + (U.normalizeHex(current) || 'transparent') + '"></span>';
    b.addEventListener('click', function () {
      colorPopover(b, current(), onPick);
    });
    return b;
  }

  /* ---------------------------------------------------------- police */

  var FONT_LIST_MAX = 320;

  function normalizeForSearch(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /* v1.6 — popover police : recherche instantanée + TOUTES les polices du
   * système (MB.fonts) + police PAR DÉFAUT (★, utilisée pour tout nouveau
   * texte/note). Le pied indique la source (système/Illustrateur/liste
   * web) et l'étoile définit la police par défaut.
   * v1.8 — FAVORIS : chaque police peut être épinglée (♥) ; le bouton
   * « Favoris » au-dessus de la liste filtre pour ne montrer QUE les
   * polices favorites (persistées dans prefs — tous moodboards). */
  function fontPopover(anchor, current, onPick) {
    MB.fonts.whenReady(function () {
      var fonts = MB.fonts.list();
      var searching = '';
      var favOnly = false;

      function renderList(p, filter) {
        var list = p.querySelector('.font-list');
        if (!list) return;
        var f = normalizeForSearch(filter || '');
        var shown = 0;
        var html = '';
        for (var i = 0; i < fonts.length && shown < FONT_LIST_MAX; i++) {
          var name = fonts[i];
          if (favOnly && !MB.fonts.isFavorite(name)) continue;
          if (f && normalizeForSearch(name).indexOf(f) < 0) continue;
          shown++;
          var isDef = MB.fonts.isDefault(name);
          var isCur = current() === name;
          html +=
            '<div class="font-item' + (isCur ? ' is-current' : '') + '" data-font="' + U.escapeHtml(name) + '" ' +
            'style="font-family:\'' + U.escapeHtml(name) + '\'" role="button" tabindex="0" ' +
            'title="' + U.escapeHtml(name) + (isDef ? ' (police par défaut)' : '') + '">' +
            '<span class="font-item-name">' + U.escapeHtml(name) + '</span>' +
            '<button type="button" class="font-item-heart' + (MB.fonts.isFavorite(name) ? ' is-on' : '') + '" data-heart="' + U.escapeHtml(name) + '" ' +
            'title="' + (MB.fonts.isFavorite(name) ? 'Retirer des favoris' : 'Ajouter aux favoris') + '" aria-label="Favori">' +
            MB.icons.get(MB.fonts.isFavorite(name) ? 'heartFill' : 'heart', 13) +
            '</button>' +
            '<button type="button" class="font-item-star' + (isDef ? ' is-on' : '') + '" data-star="' + U.escapeHtml(name) + '" ' +
            'title="' + (isDef ? 'Police par défaut actuelle' : 'Définir comme police par défaut') + '" aria-label="Définir comme police par défaut">' +
            MB.icons.get(isDef ? 'starFill' : 'star', 13) +
            '</button>' +
            '</div>';
        }
        if (!shown) {
          html = '<div class="font-empty">' + (favOnly
            ? (MB.fonts.hasAnyFavorite()
              ? 'Aucun favori ne correspond à la recherche.'
              : 'Aucune police en favori — cliquez le ♥ d‘une police pour l‘épingler.')
            : 'Aucune police trouvée.') + '</div>';
        } else if (fonts.length > FONT_LIST_MAX && shown === FONT_LIST_MAX) {
          html += '<div class="font-empty">Affichage limité à ' + FONT_LIST_MAX + ' polices — affinez la recherche.</div>';
        }
        list.innerHTML = html;

        list.querySelectorAll('.font-item').forEach(function (item) {
          function pick() {
            onPick(item.dataset.font);
            MB.ui.closePopover();
          }
          item.addEventListener('click', function (ev) {
            if (ev.target.closest('.font-item-star') || ev.target.closest('.font-item-heart')) return;
            pick();
          });
          item.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter' || ev.key === ' ') {
              ev.preventDefault();
              pick();
            }
          });
        });
        list.querySelectorAll('.font-item-star').forEach(function (star) {
          star.addEventListener('click', function (ev) {
            ev.stopPropagation();
            MB.fonts.setDefault(star.dataset.star);
            renderList(p, p.querySelector('.font-search') ? p.querySelector('.font-search').value : '');
            var foot = p.querySelector('.font-foot-cur');
            if (foot) foot.textContent = MB.fonts.default();
          });
        });
        list.querySelectorAll('.font-item-heart').forEach(function (heart) {
          heart.addEventListener('click', function (ev) {
            ev.stopPropagation();
            MB.fonts.toggleFavorite(heart.dataset.heart);
            renderList(p, p.querySelector('.font-search') ? p.querySelector('.font-search').value : '');
            var favBtn = p.querySelector('.font-fav-toggle');
            if (favBtn) syncFavButton(favBtn);
            var footFav = p.querySelector('.font-foot-fav');
            if (footFav) {
              var n = MB.fonts.favorites().length;
              footFav.textContent = n ? ' · ' + n + ' favori' + (n > 1 ? 's' : '') : '';
            }
          });
        });
      }

      function syncFavButton(btn) {
        var n = MB.fonts.favorites().length;
        btn.classList.toggle('is-active', favOnly);
        btn.classList.toggle('is-empty', !n);
        btn.setAttribute('aria-pressed', favOnly ? 'true' : 'false');
        btn.title = favOnly ? 'Afficher toutes les polices' : 'N‘afficher que les polices favorites (' + n + ')';
      }

      var sourceLabel =
        MB.fonts.source() === 'system' ? 'Polices de l\u2019ordinateur'
        : MB.fonts.source() === 'host' ? 'Polices Illustrator'
        : 'Polices web intégrées';
      var html =
        '<div class="font-pop">' +
        '<div class="font-tools">' +
        '<input class="input font-search" type="text" placeholder="Rechercher une police…" spellcheck="false" aria-label="Rechercher une police">' +
        '<button type="button" class="font-fav-toggle" aria-pressed="false" aria-label="Afficher uniquement les polices favorites">' +
        MB.icons.get('heartFill', 13) + '<span>Favoris</span>' +
        '</button>' +
        '</div>' +
        '<div class="font-list" role="listbox" aria-label="Polices disponibles"></div>' +
        '<div class="font-foot">★ Par défaut : <span class="font-foot-cur">' + U.escapeHtml(MB.fonts.default()) + '</span>' +
        '<span class="font-foot-fav"></span>' +
        '<span class="font-foot-src">· ' + U.escapeHtml(sourceLabel) + '</span></div>' +
        '</div>';
      MB.ui.popover(anchor, html, {
        bind: function (p) {
          /* Ajuster la hauteur de la liste à l'espace disponible : le
           * popover est positionné AVANT que la liste ne soit remplie
           * (hauteur mesurée vide) — sans cela il déborde de la fenêtre
           * sur les petits écrans et le pied devient invisible. */
          function refit() {
            var list = p.querySelector('.font-list');
            if (!list) return;
            var r = p.getBoundingClientRect();
            var space = window.innerHeight - 8 - r.top;
            var maxList = Math.max(120, Math.min(264, space - 108));
            list.style.maxHeight = maxList + 'px';
            var ph = p.offsetHeight;
            if (r.top + ph > window.innerHeight - 8) {
              p.style.top = Math.max(8, window.innerHeight - 8 - ph) + 'px';
            }
          }
          renderList(p, '');
          var favBtn = p.querySelector('.font-fav-toggle');
          if (favBtn) {
            syncFavButton(favBtn);
            favBtn.addEventListener('click', function () {
              favOnly = !favOnly;
              syncFavButton(favBtn);
              renderList(p, p.querySelector('.font-search') ? p.querySelector('.font-search').value : '');
            });
          }
          var footFav = p.querySelector('.font-foot-fav');
          if (footFav) {
            var n = MB.fonts.favorites().length;
            if (n) footFav.textContent = ' · ' + n + ' favori' + (n > 1 ? 's' : '');
          }
          refit();
          var search = p.querySelector('.font-search');
          if (search) {
            setTimeout(function () {
              try { search.focus(); } catch (e) { /* noop */ }
            }, 30);
            search.addEventListener('input', function () {
              if (search.value !== searching) {
                searching = search.value;
                renderList(p, searching);
              }
            });
          }
          window.addEventListener('resize', refit, { once: true });
        }
      });
    });
  }

  function fontButton(current, onPick) {
    var b = U.el('button', 'ctx-btn ctx-font-btn');
    b.type = 'button';
    b.setAttribute('data-tip', 'Police (recherche + polices du système, ★ = par défaut)');
    b.innerHTML = '<span style="font-family:\'' + U.escapeHtml(current) + '\'">' + U.escapeHtml(current) + '</span>' + MB.icons.get('chevronDown', 12);
    b.addEventListener('click', function () {
      fontPopover(b, current, onPick);
    });
    return b;
  }

  /* --------------------------------------------------------- diverse */

  function textButton(label, onClick, tip) {
    var b = U.el('button', 'ctx-btn ctx-text-btn', U.escapeHtml(label));
    b.type = 'button';
    if (tip) b.setAttribute('data-tip', tip);
    b.addEventListener('click', onClick);
    return b;
  }

  function sizeControl(get, set) {
    var wrap = U.el('div', 'ctx-stepper');
    var minus = U.el('button', 'ctx-stepper-btn');
    minus.type = 'button';
    minus.innerHTML = MB.icons.get('minus', 13);
    var val = U.el('span', 'ctx-stepper-val', String(Math.round(get())));
    var plus = U.el('button', 'ctx-stepper-btn');
    plus.type = 'button';
    plus.innerHTML = MB.icons.get('plus', 13);
    minus.addEventListener('click', function () {
      set(get() - (stepFor(get())));
      val.textContent = String(Math.round(get()));
    });
    plus.addEventListener('click', function () {
      set(get() + stepFor(get()));
      val.textContent = String(Math.round(get()));
    });
    wrap.appendChild(minus);
    wrap.appendChild(val);
    wrap.appendChild(plus);
    return wrap;
  }

  function stepFor(v) {
    return v >= 48 ? 4 : v >= 20 ? 2 : 1;
  }

  function opacityControl(get, set) {
    var b = iconButton('eye', 'Opacité', function () {
      MB.ui.popover(b,
        '<div class="pop-block"><label class="field-label">Opacité</label>' +
        '<input type="range" min="10" max="100" step="5" value="' + Math.round(get() * 100) + '" id="pop-opacity"></div>', {
        bind: function (p) {
          var r = p.querySelector('#pop-opacity');
          r.addEventListener('input', function () {
            set(parseInt(r.value, 10) / 100, false);
          });
          r.addEventListener('change', function () {
            set(parseInt(r.value, 10) / 100, true);
          });
        }
      });
    });
    return b;
  }

  MB.ui = MB.ui || {};
  MB.ui.controls = {
    applyTo: applyTo,
    applyDataTo: applyDataTo,
    iconButton: iconButton,
    seg: seg,
    toggle: toggle,
    numberRow: numberRow,
    colorPopover: colorPopover,
    colorButton: colorButton,
    fontPopover: fontPopover,
    fontButton: fontButton,
    textButton: textButton,
    sizeControl: sizeControl,
    opacityControl: opacityControl,
    SWATCHES: SWATCHES
  };
})();
