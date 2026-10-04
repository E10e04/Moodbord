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
      /* v1.7 — _close (idempotente) quand le dialogue en fournit une. */
      if (this._close) {
        this._close(null);
        return;
      }
      this.parentNode.removeChild(this);
      var back = this;
      back._resolve && back._resolve(null);
    }
  }

  function dialog(bodyHtml, actions, opts) {
    return new Promise(function (resolve) {
      var host = document.getElementById('layer-dialogs');
      var back = U.el('div', 'dialog-backdrop');
      back._resolve = resolve;
      var box = U.el('div', 'dialog');
      box.innerHTML = bodyHtml;
      /* v1.7 — fermeture programmatique (dialogues interactifs :
       * Préférences, mises à jour…) ; idempotente. */
      var closed = false;
      function close(val) {
        if (closed) return;
        closed = true;
        if (back.parentNode) back.parentNode.removeChild(back);
        resolve(val);
      }
      back._close = close;
      var foot = U.el('div', 'dialog-actions');
      (actions || []).forEach(function (a) {
        var b = U.el(
          'button',
          'btn ' + (a.kind === 'primary' ? 'btn-primary' : a.kind === 'danger' ? 'btn-danger' : 'btn-ghost'),
          a.label
        );
        b.addEventListener('click', function () {
          var val = a.value;
          if (a.getValue) val = a.getValue(box);
          close(val);
        });
        foot.appendChild(b);
      });
      if ((actions || []).length) box.appendChild(foot);
      back.appendChild(box);
      host.appendChild(back);
      var firstInput = box.querySelector('input, textarea');
      if (firstInput) {
        setTimeout(function () {
          firstInput.focus();
          if (firstInput.select) firstInput.select();
        }, 0);
      }
      /* v1.7 — corps interactif : le dialogue peut se re-rendre en place
       * (choix de dossier, progression de téléchargement…). */
      if (opts && typeof opts.bind === 'function') opts.bind(box, close);
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
        { label: opts.cancelLabel || (MB.i18n ? MB.i18n.t('dlg.cancel') : 'Annuler'), value: false, kind: 'ghost' },
        { label: opts.confirmLabel || (MB.i18n ? MB.i18n.t('dlg.confirm') : 'Confirmer'), value: true, kind: opts.danger ? 'danger' : 'primary' }
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
    var en = !!(MB.i18n && MB.i18n.lang() === 'en');
    var rows = [
      ['V', en ? 'Select tool' : 'Outil Sélection'],
      ['H', en ? 'Hand tool (pan)' : 'Outil Main (pan)'],
      ['N', en ? 'Note' : 'Note'],
      ['T', en ? 'Text' : 'Texte'],
      ['I', en ? 'Image (import)' : 'Image (importer)'],
      ['C', en ? 'Checklist' : 'Checklist'],
      ['L', en ? 'Link' : 'Lien'],
      ['S', en ? 'Section' : 'Section'],
      ['M', en ? 'Comment' : 'Commentaire'],
      ['P', en ? 'Line' : 'Ligne'],
      ['B', en ? 'Sketch' : 'Croquis'],
      ['K', en ? 'Color' : 'Couleur'],
      ['A', en ? 'Palette' : 'Palette'],
      ['Y', en ? 'Typography' : 'Typographie'],
      ['R', en ? 'Shape' : 'Forme'],
      ['E', en ? 'Board (linked moodboard)' : 'Planche (moodboard lié)'],
      [en ? 'Space + drag' : 'Espace + glisser', en ? 'Pan across the canvas' : 'Se déplacer dans le canvas'],
      [en ? 'Scroll' : 'Molette', en ? 'Cursor-focused zoom' : 'Zoom focalisé sur le curseur'],
      ['⌘/Ctrl + +/−', en ? 'Zoom in / out (macOS: ⌘+ / ⌘−)' : 'Zoom avant / arrière (standard macOS : ⌘+ / ⌘−)'],
      [en ? 'Arrows' : 'Flèches', en ? 'Move the selection (⇧ = ×10)' : 'Déplacer la sélection (⇧ = ×10)'],
      [en ? 'Shift + click' : 'Maj + clic', en ? 'Add / remove from the selection' : 'Ajouter / retirer de la sélection'],
      [en ? 'Empty area + drag' : 'Zone vide + glisser', en ? 'Lasso selection (marquee)' : 'Sélection au lasso (marquee)'],
      [en ? 'Double-click' : 'Double-clic', en ? 'Edit (text, note, cell, image → crop)' : 'Éditer (texte, note, cellule, image → recadrer)'],
      ['Alt + ←', en ? 'Back from the linked board to the parent moodboard (or click its name at the top)' : 'Revenir du planche liée au moodboard parent (ou clic sur son nom en haut)'],
      [en ? 'Alt + drag' : 'Alt + glisser', en ? 'Duplicate (on a column: move the container alone)' : 'Dupliquer (sur une colonne : déplacer le conteneur seul)'],
      [en ? 'Delete / Backspace' : 'Suppr / Retour arr.', en ? 'Delete the selection' : 'Supprimer la sélection'],
      ['Échap', en ? 'Exit editing → cancel → deselect' : 'Quitter édition → annuler → déselection'],
      ['⌘/Ctrl + Z', en ? 'Undo' : 'Annuler'],
      ['⌘/Ctrl + ⇧ + Z', en ? 'Redo' : 'Rétablir'],
      ['⌘/Ctrl + C / V / X', en ? 'Copy / Paste / Cut' : 'Copier / Coller / Couper'],
      ['⌘/Ctrl + D', en ? 'Duplicate' : 'Dupliquer'],
      ['⌘/Ctrl + A', en ? 'Select all' : 'Tout sélectionner'],
      ['⌘/Ctrl + G', en ? 'Group (⇧ to ungroup)' : 'Grouper (⇧ pour dissocier)'],
      ['⌘/Ctrl + S', en ? 'Save (current file; first save asks for the location)' : 'Enregistrer (fichier courant ; 1er enregistrement : choix de l‘emplacement)'],
      ['⌘/Ctrl + ⇧ + S', en ? 'Save as… (pick a new location)' : 'Enregistrer sous… (choisir un nouvel emplacement)'],
      ['⌘/Ctrl + ,', en ? 'Preferences (language, temporary files & auto-saves)' : 'Préférences (langue, dossier des fichiers temporaires et autosaves)'],
      ['⌘/Ctrl + 0', en ? 'Zoom 100%' : 'Zoom 100 %'],
      ['⇧ + 1', en ? 'Fit to screen' : 'Ajuster à l‘écran'],
      ['⇧ + 2', en ? 'Zoom to selection' : 'Zoom sur la sélection'],
      [en ? '⌘/Ctrl while dragging' : '⌘/Ctrl pendant un drag', en ? 'Disable snapping' : 'Désactiver l’aimantage']
    ];
    var html = '<div class="dialog-title">' + (MB.i18n ? MB.i18n.t('shortcuts.title') : 'Raccourcis clavier') + '</div><div class="dialog-body"><table class="kbd-table">';
    rows.forEach(function (r) {
      html += '<tr><td><span class="kbd">' + U.escapeHtml(r[0]) + '</span></td><td>' + U.escapeHtml(r[1]) + '</td></tr>';
    });
    html += '</table></div>';
    dialog(html, [{ label: MB.i18n ? MB.i18n.t('dlg.close') : 'Fermer', value: true, kind: 'primary' }]);
  }

  function aboutDialog() {
    var desktop = MB.desktop && MB.desktop.active;
    var TT = function (k) {
      return MB.i18n ? MB.i18n.t(k) : k;
    };
    dialog(
      '<img class="about-logo" src="assets/logo.png" alt="" width="56" height="56" draggable="false">' +
      '<div class="dialog-title">Moodboard</div>' +
      '<div class="dialog-body">' + TT('about.tagline') + '<br><br>' +
      'Version ' + MB.VERSION +
      (desktop ? ' · ' + TT('about.desktop') : ' · ' + TT('about.cep')) +
      '<br>' +
      (desktop
        ? TT('about.env.desktop')
        : MB.storage && MB.storage.isCep()
          ? TT('about.env.cep')
          : TT('about.env.web')) +
      '</div>',
      [{ label: TT('dlg.close'), value: true, kind: 'primary' }]
    );
  }

  /* ------------------------------------------------------ préférences */

  /* v1.9 — Préférences (Fichier ▸ Préférences… / ⌘,) :
   *  - LANGUE de l'interface : « Langue du système » (par défaut —
   *    l'application ET l'extension suivent le système), ou forçage
   *    Français / English ;
   *  - dossier des fichiers temporaires et des enregistrements
   *    automatiques (v1.7) : le choix est global (tous les moodboards),
   *    chaque projet y garde son propre autosave. */
  function preferencesDialog() {
    var S = MB.storage;
    var T = function (k, vars) {
      return MB.i18n ? MB.i18n.t(k, vars) : k;
    };

    function langRows(cur) {
      var opts = [
        { id: 'auto', label: T('prefs.lang.auto') },
        { id: 'fr', label: T('prefs.lang.fr') },
        { id: 'en', label: T('prefs.lang.en') }
      ];
      var html = '';
      opts.forEach(function (o) {
        html +=
          '<button type="button" class="pref-lang' + (cur === o.id ? ' is-active' : '') + '" data-lang="' + o.id + '" ' +
          'role="radio" aria-checked="' + (cur === o.id ? 'true' : 'false') + '">' +
          '<span class="pref-lang-dot" aria-hidden="true"></span>' +
          '<span class="pref-lang-name">' + U.escapeHtml(o.label) + '</span>' +
          (o.id === 'auto'
            ? '<span class="pref-lang-sub">' + U.escapeHtml(
                (MB.i18n && MB.i18n.lang() === 'en' ? 'English' : 'Français') +
                ' · ' + (navigator.language || '')
              ) + '</span>'
            : '') +
          '</button>';
      });
      return '<div class="pref-lang-group" role="radiogroup" aria-label="' + T('prefs.lang') + '">' + html + '</div>';
    }

    function render(box) {
      var canFs = S.isFs();
      var custom = S.dataDirIsCustom();
      var cur = S.dataDir() || '(indisponible)';
      var def = S.dataDirDefault() || '';
      var revealable = !!(MB.desktop && MB.desktop.canReveal);
      var langPref = MB.i18n ? MB.i18n.pref() : 'auto';
      box.innerHTML =
        '<div class="dialog-title">' + T('prefs.title') + '</div>' +
        '<div class="dialog-body">' +

        /* ---- langue ---- */
        '<span class="field-label">' + T('prefs.lang') + '</span>' +
        langRows(langPref) +
        '<div class="prefs-sub">' + T('prefs.lang.note') + '</div>' +

        /* ---- fichiers temporaires ---- */
        '<span class="field-label" style="margin-top:14px">' + T('prefs.files') + '</span>' +
        '<div class="prefs-path' + (custom ? ' is-custom' : '') + '" title="' + U.escapeHtml(cur) + '">' +
        U.escapeHtml(cur) +
        '</div>' +
        '<div class="prefs-sub">' +
        (custom
          ? T('prefs.files.custom')
          : T('prefs.files.default', { dir: def })) +
        '</div>' +
        '<div class="prefs-actions">' +
        '<button type="button" class="btn btn-primary btn--xs" data-act="pick"' +
        (canFs ? '' : ' disabled') + '>' + T('prefs.pick') + '</button>' +
        '<button type="button" class="btn btn-ghost btn--xs" data-act="reveal"' +
        (canFs && revealable ? '' : ' disabled') + '>' + T('prefs.reveal') + '</button>' +
        '<button type="button" class="btn btn-ghost btn--xs" data-act="reset"' +
        (custom ? '' : ' disabled') + '>' + T('prefs.reset') + '</button>' +
        '</div>' +
        (canFs
          ? ''
          : '<p class="prefs-note">' + T('prefs.webNote') + '</p>') +
        '</div>' +
        '<div class="dialog-actions">' +
        '<button type="button" class="btn btn-primary" data-act="close">' + T('prefs.close') + '</button>' +
        '</div>';

      /* langue : application immédiate (préférence + rechargement). */
      box.querySelectorAll('[data-lang]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (b.getAttribute('aria-checked') === 'true') return;
          if (MB.i18n) MB.i18n.setLang(b.dataset.lang);
        });
      });

      box.querySelector('[data-act="close"]').addEventListener('click', function () {
        closePrefs();
      });
      if (!canFs) return;

      box.querySelector('[data-act="pick"]').addEventListener('click', function () {
        S.pickDataDir().then(function (dir) {
          if (!dir) return; // annulé
          var r = S.setDataDir(dir);
          if (r.error) {
            toast(r.error, 'error');
            return;
          }
          if (!r.unchanged) {
            toast(
              r.moved && r.moved.length
                ? T('prefs.movedToast', { n: r.moved.length })
                : T('prefs.savedToast'),
              'success'
            );
          }
          render(box);
        });
      });

      var revealBtn = box.querySelector('[data-act="reveal"]');
      if (!revealBtn.disabled) {
        revealBtn.addEventListener('click', function () {
          var d = S.dataDir();
          if (d) MB.desktop.reveal(d);
        });
      }

      var resetBtn = box.querySelector('[data-act="reset"]');
      if (!resetBtn.disabled) {
        resetBtn.addEventListener('click', function () {
          var r = S.resetDataDir();
          if (r.error) {
            toast(r.error, 'error');
            return;
          }
          toast(T('prefs.resetToast'), 'success');
          render(box);
        });
      }
    }

    var closePrefs = null;
    dialog('', [], {
      bind: function (box, close) {
        closePrefs = close;
        render(box);
      }
    });
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
  var ghostOrphan = null; // blur / pointercancel → survie 600 ms
  var ghostSilence = null; // silence total prolongé → nettoyage (v1.2.0)
  var GHOST_SILENCE_MS = 8000;

  /* Même politique que les gestes du canvas (cf. interactions.js) :
   * les blur/pointercancel parasites d'un hôte CEP ne doivent plus
   * tuer le ghost au milieu d'un drag — on survit 600 ms et on
   * n'annule que si plus rien n'arrive. */
  function ghostArmOrphan(reason) {
    if (ghostOrphan) clearTimeout(ghostOrphan);
    ghostOrphan = setTimeout(function () {
      ghostOrphan = null;
      if (ghostState) ghostCancel(reason || 'orphelin');
    }, 600);
  }

  function ghostDisarmOrphan() {
    if (ghostOrphan) {
      clearTimeout(ghostOrphan);
      ghostOrphan = null;
    }
  }

  /* Chien de garde anti-fuite (v1.2.0) : un ghost « vivant » qui ne
   * reçoit PLUS AUCUN événement pendant 8 s est un ghost orphelin
   * (mouseup avalé par le moteur, relâchement hors panneau…). Sans
   * lui, le ghost fantôme déposerait son objet au prochain clic
   * innocent sur le canvas — mesuré v1.1.3 : ghostStart=9,
   * ghostDrop=4, ghostCancel=0 → 5 fuites silencieuses. */
  function ghostArmSilence() {
    if (ghostSilence) clearTimeout(ghostSilence);
    ghostSilence = setTimeout(function () {
      ghostSilence = null;
      if (ghostState) {
        if (MB.diaglog) MB.diaglog.trace('ghost silencieux depuis 8 s — annulation (anti-fuite)');
        ghostCancel('silence-8s');
      }
    }, GHOST_SILENCE_MS);
  }

  function ghostDisarmSilence() {
    if (ghostSilence) {
      clearTimeout(ghostSilence);
      ghostSilence = null;
    }
  }

  function ghostCount(key) {
    try {
      if (MB.EVT_DIAG) MB.EVT_DIAG[key] = (MB.EVT_DIAG[key] || 0) + 1;
    } catch (e) {
      /* le diagnostic ne doit jamais casser l'application */
    }
  }

  function ghostStart(opts, onDrop) {
    ghostDisarmOrphan();
    ghostDisarmSilence();
    var node = document.getElementById('drag-ghost');
    node.innerHTML = opts.html || '';
    /* Le ghost n'apparaît qu'après le seuil de 5 px (ghostMove) : pas
     * de flash sous le curseur lors d'un simple clic sur un outil. */
    node.hidden = true;
    ghostState = {
      onDrop: onDrop,
      label: opts.label || '?',
      started: false,
      sx: opts.sx,
      sy: opts.sy,
      bornAt: Date.now()
    };
    ghostCount('ghostStart');
    MB.diaglog && MB.diaglog.trace('drag panneau démarré (' + ghostState.label + ')');
    move(opts.sx, opts.sy);
    ghostArmSilence();
  }

  function move(x, y) {
    var node = document.getElementById('drag-ghost');
    node.style.left = x + 'px';
    node.style.top = y + 'px';
  }

  function ghostMove(e) {
    ghostDisarmOrphan();
    if (!ghostState) return;
    /* Le bouton n'est plus enfoncé et le mouseup n'a jamais été livré
     * (relâchement hors panneau, événement volé par l'hôte) : ce
     * mouvement sans bouton est le premier signe de vie APRÈS la
     * perte — on annule proprement au lieu de laisser un ghost
     * fantôme qui « déposerait » son objet au prochain clic. */
    if (typeof e.buttons === 'number' && e.buttons === 0) {
      var started = ghostState.started;
      ghostCancel('bouton relâché hors panneau', !started);
      return;
    }
    ghostDisarmSilence();
    if (!ghostState.started) {
      if (Math.hypot(e.clientX - ghostState.sx, e.clientY - ghostState.sy) < 5) return;
      ghostState.started = true;
      document.getElementById('drag-ghost').hidden = false;
      document.body.classList.add('is-ghosting');
    }
    move(e.clientX, e.clientY);
    ghostArmSilence();
  }

  function ghostEnd(e) {
    ghostDisarmOrphan();
    ghostDisarmSilence();
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
      ghostCount('ghostDrop');
      MB.diaglog && MB.diaglog.trace(
        'drop panneau → ' + st.label + ' @ (' + Math.round(point.x) + ', ' + Math.round(point.y) + ')'
      );
      st.onDrop(point);
      return true;
    }
    MB.diaglog && MB.diaglog.trace('drag panneau relâché hors canvas (' + st.label + ')');
    return false;
  }

  /* silent=true : nettoyage interne sans compteur (ex. simple appui
     * sans déplacement sur la source, bouton relâché avant le seuil). */
  function ghostCancel(reason, silent) {
    ghostDisarmOrphan();
    ghostDisarmSilence();
    if (ghostState && !silent) {
      ghostCount('ghostCancel');
      MB.diaglog && MB.diaglog.trace(
        'drag panneau annulé (' + ghostState.label + (reason ? ' — ' + reason : '') + ')'
      );
    }
    ghostState = null;
    var node = document.getElementById('drag-ghost');
    node.hidden = true;
    node.innerHTML = '';
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
  // CEP qui ne livrent pas les événements pointer de bouton, le ghost
  // suit la souris et se pose au mouseup.
  U.bindPointerWithMouse(window, 'move', ghostMove);
  U.bindPointerWithMouse(window, 'up', function (e) {
    ghostEnd(e);
  });
  /* Un NOUVEAU appui alors qu'un ghost traîne (mouseup précédent avalé
   * par le moteur) : le ghost obsolète est annulé AVANT que la source
   * ne démarre le nouveau — sinon il déposerait son objet au prochain
   * relâchement. Garde d'âge : dans un navigateur sain, pointerdown
   * puis son mousedown de compatibilité arrivent en paire sur le MÊME
   * appui — seuls les appuis réellement NOUVEAUX (>400 ms après la
   * naissance du ghost) annulent. */
  function onGhostGuardDown() {
    if (ghostState && Date.now() - (ghostState.bornAt || 0) > 400) ghostCancel('nouvel appui');
  }
  document.addEventListener('pointerdown', onGhostGuardDown, true);
  document.addEventListener('mousedown', onGhostGuardDown, true);
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && ghostState) ghostCancel('Échap');
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
  MB.ui.preferencesDialog = preferencesDialog;
  MB.ui.diagnosticsDialog = diagnosticsDialog;
  MB.ui.ghost = {
    start: ghostStart,
    cancel: ghostCancel
  };
})();
