/* =========================================================================
 * overlays.js — Toasts, dialogues (confirm/prompt), raccourcis, à propos,
 * gestionnaire de popovers et ghost de drag (bibliothèque / outils).
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  /* ------------------------------------------------------------ toasts */

  function toast(msg, type) {
    var host = document.getElementById('layer-toasts');
    if (!host) return;
    var t = U.el('div', 'toast toast--' + (type || 'info'), U.escapeHtml(msg));
    host.appendChild(t);
    setTimeout(function () {
      t.classList.add('is-leaving');
    }, 2200);
    setTimeout(function () {
      if (t.parentNode) t.parentNode.removeChild(t);
    }, 2600);
  }

  /* ---------------------------------------------------------- popovers */

  var popoverEl = null;

  function closePopover() {
    if (popoverEl && popoverEl.parentNode) {
      popoverEl.parentNode.removeChild(popoverEl);
    }
    popoverEl = null;
    document.removeEventListener('pointerdown', onDocDown, true);
    document.removeEventListener('mousedown', onDocDown, true);
  }

  function onDocDown(e) {
    if (popoverEl && !popoverEl.contains(e.target)) {
      closePopover();
    }
  }

  function popover(anchor, html, opts) {
    closePopover();
    var host = document.getElementById('layer-popovers');
    var p = U.el('div', 'ctx-pop');
    p.innerHTML = html;
    host.appendChild(p);
    popoverEl = p;

    var r = anchor.getBoundingClientRect();
    var pw = p.offsetWidth;
    var ph = p.offsetHeight;
    var x = Math.min(r.left, window.innerWidth - pw - 12);
    var y = r.bottom + 6;
    if (y + ph > window.innerHeight - 8) y = r.top - ph - 6;
    p.style.left = Math.max(8, x) + 'px';
    p.style.top = Math.max(8, y) + 'px';

    setTimeout(function () {
      document.addEventListener('pointerdown', onDocDown, true);
      // Repli souris (moteurs CEP sans Pointer Events).
      document.addEventListener('mousedown', onDocDown, true);
    }, 0);

    if (opts && opts.bind) opts.bind(p);
    return p;
  }

  /* ------------------------------------------------------ dialogues */

  /* Fermeture d'un dialogue en cliquant le fond : partagé par les
     couches pointer et souris — la garde parentNode rend le second
     appel (événement de compatibilité) inoffensif. */
  function onBackdrop(e) {
    if (e.target === this && this.parentNode) {
      this.parentNode.removeChild(this);
      var back = this;
      back._resolve && back._resolve(null);
    }
  }

  function dialog(bodyHtml, actions) {
    return new Promise(function (resolve) {
      var host = document.getElementById('layer-dialogs');
      var back = U.el('div', 'dialog-backdrop');
      back._resolve = resolve;
      var box = U.el('div', 'dialog');
      box.innerHTML = bodyHtml;
      var foot = U.el('div', 'dialog-actions');
      actions.forEach(function (a) {
        var b = U.el(
          'button',
          'btn ' + (a.kind === 'primary' ? 'btn-primary' : a.kind === 'danger' ? 'btn-danger' : 'btn-ghost'),
          a.label
        );
        b.addEventListener('click', function () {
          var val = a.value;
          if (a.getValue) val = a.getValue(box);
          back.parentNode.removeChild(back);
          resolve(val);
        });
        foot.appendChild(b);
      });
      box.appendChild(foot);
      back.appendChild(box);
      host.appendChild(back);
      var firstInput = box.querySelector('input, textarea');
      if (firstInput) {
        setTimeout(function () {
          firstInput.focus();
          if (firstInput.select) firstInput.select();
        }, 0);
      }
      back.addEventListener('pointerdown', onBackdrop);
      // Repli souris (moteurs CEP sans Pointer Events) — double appel
      // inoffensif grâce à la garde parentNode.
      back.addEventListener('mousedown', onBackdrop);
    });
  }

  function confirmDialog(opts) {
    return dialog(
      '<div class="dialog-title">' + U.escapeHtml(opts.title) + '</div>' +
      '<div class="dialog-body">' + U.escapeHtml(opts.message) + '</div>',
      [
        { label: opts.cancelLabel || 'Annuler', value: false, kind: 'ghost' },
        { label: opts.confirmLabel || 'Confirmer', value: true, kind: opts.danger ? 'danger' : 'primary' }
      ]
    );
  }

  function promptDialog(opts) {
    return dialog(
      '<div class="dialog-title">' + U.escapeHtml(opts.title) + '</div>' +
      '<div class="dialog-body"><label class="field-label">' + U.escapeHtml(opts.label || '') + '</label>' +
      '<input type="text" class="input" id="dlg-input" value="' + U.escapeHtml(opts.value || '') + '"></div>',
      [
        { label: 'Annuler', value: null, kind: 'ghost' },
        {
          label: opts.confirmLabel || 'OK',
          value: undefined,
          kind: 'primary',
          getValue: function (box) {
            return box.querySelector('#dlg-input').value;
          }
        }
      ]
    );
  }

  function shortcutsDialog() {
    var rows = [
      ['V', 'Outil Sélection'],
      ['H', 'Outil Main (pan)'],
      ['N', 'Note'],
      ['T', 'Texte'],
      ['I', 'Image (importer)'],
      ['C', 'Checklist'],
      ['L', 'Lien'],
      ['S', 'Section'],
      ['M', 'Commentaire'],
      ['P', 'Ligne'],
      ['B', 'Croquis'],
      ['K', 'Couleur'],
      ['A', 'Palette'],
      ['Y', 'Typographie'],
      ['R', 'Forme'],
      ['Espace + glisser', 'Se déplacer dans le canvas'],
      ['Molette', 'Zoom focalisé sur le curseur'],
      ['⌘/Ctrl + +/−', 'Zoom avant / arrière (standard macOS : ⌘+ / ⌘−)'],
      ['Flèches', 'Déplacer la sélection (⇧ = ×10)'],
      ['Maj + clic', 'Ajouter / retirer de la sélection'],
      ['Zone vide + glisser', 'Sélection au lasso (marquee)'],
      ['Double-clic', 'Éditer (texte, note, cellule, image → recadrer)'],
      ['Alt + glisser', 'Dupliquer (sur une section : déplacer le conteneur seul)'],
      ['Suppr / Retour arr.', 'Supprimer la sélection'],
      ['Échap', 'Quitter édition → annuler → déselection'],
      ['⌘/Ctrl + Z', 'Annuler'],
      ['⌘/Ctrl + ⇧ + Z', 'Rétablir'],
      ['⌘/Ctrl + C / V / X', 'Copier / Coller / Couper'],
      ['⌘/Ctrl + D', 'Dupliquer'],
      ['⌘/Ctrl + A', 'Tout sélectionner'],
      ['⌘/Ctrl + G', 'Grouper (⇧ pour dissocier)'],
      ['⌘/Ctrl + S', 'Enregistrer (⇧ = Enregistrer sous…)'],
      ['⌘/Ctrl + 0', 'Zoom 100 %'],
      ['⇧ + 1', 'Ajuster à l’écran'],
      ['⇧ + 2', 'Zoom sur la sélection'],
      ['⌘/Ctrl pendant un drag', 'Désactiver l’aimantage']
    ];
    var html = '<div class="dialog-title">Raccourcis clavier</div><div class="dialog-body"><table class="kbd-table">';
    rows.forEach(function (r) {
      html += '<tr><td><span class="kbd">' + U.escapeHtml(r[0]) + '</span></td><td>' + U.escapeHtml(r[1]) + '</td></tr>';
    });
    html += '</table></div>';
    dialog(html, [{ label: 'Fermer', value: true, kind: 'primary' }]);
  }

  function aboutDialog() {
    var desktop = MB.desktop && MB.desktop.active;
    dialog(
      '<div class="dialog-title">Moodboard</div>' +
      '<div class="dialog-body">Table de travail spatiale pour designers.<br><br>' +
      'Version ' + MB.VERSION +
      (desktop ? ' · Application autonome (Electron) · macOS 11+ / Windows 10+' : ' · CEP 10+ · Illustrator 2021+') +
      '<br>' +
      (desktop
        ? 'Environnement : application autonome'
        : MB.storage && MB.storage.isCep()
          ? 'Environnement : Adobe Illustrator (CEP actif)'
          : 'Environnement : aperçu navigateur (hors Illustrator)') +
      '</div>',
      [{ label: 'Fermer', value: true, kind: 'primary' }]
    );
  }

  /* ----------------------------------------------------- diagnostics */

  function diagnosticsDialog() {
    var rep = MB.diaglog ? MB.diaglog.report() : 'Diagnostic indisponible.';
    dialog(
      '<div class="dialog-title">Diagnostics</div>' +
      '<div class="dialog-body">' +
      '<p class="diag-hint">Ce rapport indique quelles familles d’événements le moteur ' +
      'livre (pointer/souris), l’état des gestes et les erreurs éventuelles. ' +
      'Il est aussi écrit dans <strong>diagnostic.log</strong> dans le dossier de données.</p>' +
      '<pre class="diag-pre">' + U.escapeHtml(rep) + '</pre></div>',
      [
        { label: 'Copier le rapport', value: 'copy', kind: 'ghost' },
        { label: 'Fermer', value: true, kind: 'primary' }
      ]
    ).then(function (v) {
      if (v === 'copy') {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(rep).then(
              function () {
                toast('Rapport copié', 'success');
              },
              function () {
                toast('Copie impossible — le rapport reste affiché (sélectionnez-le).', 'info');
              }
            );
            return;
          }
        } catch (e) {
          /* repli */
        }
        toast('Copie impossible — le rapport reste affiché (sélectionnez-le).', 'info');
      }
    });
  }

  /* -------------------------------------------------------- ghost drag */

  var ghostState = null;
  var ghostOrphan = null;

  /* Même politique que les gestes du canvas (cf. interactions.js) :
   * les blur/pointercancel parasites d'un hôte CEP ne doivent plus
   * tuer le ghost au milieu d'un drag — on survit 600 ms et on
   * n'annule que si plus rien n'arrive. */
  function ghostArmOrphan(reason) {
    if (ghostOrphan) clearTimeout(ghostOrphan);
    ghostOrphan = setTimeout(function () {
      ghostOrphan = null;
      if (ghostState) ghostCancel();
    }, 600);
  }

  function ghostDisarmOrphan() {
    if (ghostOrphan) {
      clearTimeout(ghostOrphan);
      ghostOrphan = null;
    }
  }

  function ghostStart(opts, onDrop) {
    var node = document.getElementById('drag-ghost');
    node.innerHTML = opts.html || '';
    node.hidden = false;
    ghostState = {
      onDrop: onDrop,
      started: false,
      sx: opts.sx,
      sy: opts.sy
    };
    move(opts.sx, opts.sy);
  }

  function move(x, y) {
    var node = document.getElementById('drag-ghost');
    node.style.left = x + 'px';
    node.style.top = y + 'px';
  }

  function ghostMove(e) {
    ghostDisarmOrphan();
    if (!ghostState) return;
    if (!ghostState.started) {
      if (Math.hypot(e.clientX - ghostState.sx, e.clientY - ghostState.sy) < 5) return;
      ghostState.started = true;
      document.body.classList.add('is-ghosting');
    }
    move(e.clientX, e.clientY);
  }

  function ghostEnd(e) {
    ghostDisarmOrphan();
    if (!ghostState) return;
    var st = ghostState;
    ghostState = null;
    var node = document.getElementById('drag-ghost');
    node.hidden = true;
    node.innerHTML = '';
    document.body.classList.remove('is-ghosting');
    if (!st.started) return false;
    var wrap = document.getElementById('board-wrap');
    var r = wrap.getBoundingClientRect();
    if (
      e.clientX >= r.left && e.clientX <= r.right &&
      e.clientY >= r.top && e.clientY <= r.bottom
    ) {
      var point = MB.camera.toCanvas(e.clientX, e.clientY);
      st.onDrop(point);
      return true;
    }
    return false;
  }

  function ghostCancel() {
    ghostDisarmOrphan();
    ghostState = null;
    var node = document.getElementById('drag-ghost');
    node.hidden = true;
    document.body.classList.remove('is-ghosting');
  }

  window.addEventListener('pointercancel', function () {
    // Souvent parasite dans les panneaux CEP — on survit 600 ms et on
    // n'annule que si plus aucun événement n'arrive (cf. ghostArmOrphan).
    if (ghostState) ghostArmOrphan('pointercancel');
  });
  window.addEventListener('blur', function () {
    if (ghostState) ghostArmOrphan('blur');
  });
  // Couche adaptative pointer + souris (cf. utils.js) : dans les moteurs
  // CEP qui ne livrent pas les Pointer Events, le ghost suit la souris.
  U.bindPointerWithMouse(window, 'move', ghostMove);
  U.bindPointerWithMouse(window, 'up', function (e) {
    ghostEnd(e);
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && ghostState) ghostCancel();
  });

  MB.ui = MB.ui || {};
  MB.ui.toast = toast;
  MB.ui.popover = popover;
  MB.ui.closePopover = closePopover;
  MB.ui.dialog = dialog;
  MB.ui.confirmDialog = confirmDialog;
  MB.ui.promptDialog = promptDialog;
  MB.ui.shortcutsDialog = shortcutsDialog;
  MB.ui.aboutDialog = aboutDialog;
  MB.ui.diagnosticsDialog = diagnosticsDialog;
  MB.ui.ghost = {
    start: ghostStart,
    cancel: ghostCancel
  };
})();
