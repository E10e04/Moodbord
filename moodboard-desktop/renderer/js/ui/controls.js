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

  function fontPopover(anchor, current, onPick) {
    var fonts = [
      'Georgia', 'Times New Roman', 'Palatino Linotype', 'Garamond',
      'Arial', 'Verdana', 'Trebuchet MS', 'Tahoma', 'Courier New', 'Impact'
    ];
    var html = '<div class="font-list">' + fonts.map(function (f) {
      return '<button class="font-item" data-font="' + f + '" style="font-family:\'' + f + '\'">' + f + '</button>';
    }).join('') + '</div>';
    MB.ui.popover(anchor, html, {
      bind: function (p) {
        p.querySelectorAll('.font-item').forEach(function (f) {
          f.addEventListener('click', function () {
            onPick(f.dataset.font);
            MB.ui.closePopover();
          });
        });
      }
    });
  }

  function fontButton(current, onPick) {
    var b = U.el('button', 'ctx-btn ctx-font-btn');
    b.type = 'button';
    b.setAttribute('data-tip', 'Police');
    b.innerHTML = '<span style="font-family:\'' + U.escapeHtml(current) + '\'">' + U.escapeHtml(current) + '</span>' + MB.icons.get('chevronDown', 12);
    b.addEventListener('click', function () {
      fontPopover(b, current(), onPick);
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
