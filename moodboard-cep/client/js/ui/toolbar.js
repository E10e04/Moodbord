/* =========================================================================
 * toolbar.js — Rail d'outils vertical + drag-out vers le canvas (§27).
 * Clic = activer l'outil (création par clic sur le canvas).
 * Glisser depuis le bouton = créer directement au point du drop.
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  var TOOLS = [
    { id: 'select', icon: 'select', label: 'Sélection', key: 'V', hint: 'Cliquer un objet, glisser pour déplacer' },
    { id: 'pan', icon: 'pan', label: 'Main', key: 'H', hint: 'Glisser pour déplacer la vue' },
    { sep: true },
    { id: 'note', icon: 'note', label: 'Note', key: 'N', hint: 'Cliquer ou glisser sur le canvas' },
    { id: 'text', icon: 'text', label: 'Texte', key: 'T', hint: 'Cliquer pour créer un texte' },
    { id: 'checklist', icon: 'checklist', label: 'Checklist', key: 'C', hint: 'Cliquer pour créer une checklist' },
    { id: 'comment', icon: 'comment', label: 'Commentaire', key: 'M', hint: 'Cliquer pour créer un commentaire' },
    { sep: true },
    { id: 'image', icon: 'image', label: 'Image', key: 'I', hint: 'Cliquer pour importer des images' },
    { id: 'link', icon: 'link', label: 'Lien', key: 'L', hint: 'Cliquer pour créer un lien' },
    { sep: true },
    { id: 'line', icon: 'line', label: 'Ligne', key: 'P', hint: 'Glisser pour tracer une ligne' },
    { id: 'shape', icon: 'shape', label: 'Forme', key: 'R', hint: 'Glisser pour dessiner un rectangle' },
    { id: 'sketch', icon: 'sketch', label: 'Croquis', key: 'B', hint: 'Glisser pour dessiner à main levée' },
    { sep: true },
    { id: 'section', icon: 'section', label: 'Section', key: 'S', hint: 'Glisser pour délimiter une section' },
    { id: 'column', icon: 'column', label: 'Colonne', hint: 'Glisser pour délimiter une colonne' },
    { id: 'table', icon: 'table', label: 'Tableau', hint: 'Cliquer pour créer un tableau' },
    { id: 'board', icon: 'board', label: 'Planche', key: 'E', hint: 'Créer un moodboard lié dans ce moodboard — cliquez sur sa flèche pour l’ouvrir' },
    { sep: true },
    { id: 'color', icon: 'color', label: 'Couleur', key: 'K', hint: 'Cliquer pour créer une pastille couleur' },
    { id: 'palette', icon: 'palette', label: 'Palette', key: 'A', hint: 'Cliquer pour créer une palette' },
    { id: 'typography', icon: 'typography', label: 'Typographie', key: 'Y', hint: 'Cliquer pour créer une carte typo' },
    { sep: true },
    { id: 'import', icon: 'import', label: 'Importer', hint: 'Importer des images depuis le disque' }
  ];

  function init() {
    var rail = document.getElementById('toolrail');
    var frag = document.createDocumentFragment();

    TOOLS.forEach(function (t) {
      if (t.sep) {
        frag.appendChild(U.el('div', 'tool-sep'));
        return;
      }
      var btn = U.el('button', 'tool-btn');
      btn.dataset.tool = t.id;
      btn.type = 'button';
      btn.setAttribute('aria-label', t.label);
      btn.setAttribute('data-tip', t.label + (t.key ? ' (' + t.key + ')' : ''));
      btn.innerHTML = MB.icons.get(t.icon, 19);
      btn.title = t.label + (t.key ? ' (' + t.key + ')' : '');
      bindTool(btn, t);
      frag.appendChild(btn);
    });

    rail.appendChild(frag);

    MB.store.on('tool', function (tool) {
      refresh();
    });
    MB.store.on('ui', function (patch) {
      if (patch && patch.activeGroupId !== undefined) refresh();
    });
    refresh();

    // raccourcis clavier outils
    window.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      var keyMap = {};
      TOOLS.forEach(function (tool) {
        if (tool.key) keyMap[tool.key.toLowerCase()] = tool.id;
      });
      var id = keyMap[e.key.toLowerCase()];
      if (id) {
        MB.store.setTool(id);
        e.preventDefault();
      }
    });
  }

  function bindTool(btn, t) {
    /* Couche adaptative pointer + souris (cf. utils.js) : le drag-out
     * doit démarrer même dans les moteurs CEP qui ne livrent PAS
     * pointerdown (flux hybride documenté par le diagnostic v1.1.0 :
     * pointermove sans pointerdown). Un listener « pointerdown » seul
     * rendait le glisser-déposer des outils impossible dans Illustrator. */
    U.bindPointerWithMouse(btn, 'down', function (e) {
      if (e.button !== 0) return;
      // drag-out : ghost + drop sur le canvas
      MB.ui.ghost.start(
        {
          sx: e.clientX,
          sy: e.clientY,
          label: 'outil:' + t.id,
          html: '<div class="ghost-card">' + MB.icons.get(t.icon, 18) + '<span>' + U.escapeHtml(t.label) + '</span></div>'
        },
        function (point) {
          MB.interact.createAt(t.id, point);
        }
      );
    });

    // clic simple (pas de drag) : active l'outil
    btn.addEventListener('click', function () {
      MB.store.setTool(t.id);
    });
  }

  function refresh() {
    var st = MB.store.s();
    var rail = document.getElementById('toolrail');
    rail.classList.toggle('is-group-mode', !!st.ui.activeGroupId);
    rail.querySelectorAll('.tool-btn').forEach(function (b) {
      var active = b.dataset.tool === st.tool;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    var hint = document.getElementById('sb-hint');
    if (hint) {
      var tool = null;
      TOOLS.forEach(function (t) {
        if (t.id === st.tool) tool = t;
      });
      hint.textContent = tool && tool.hint ? tool.label + ' — ' + tool.hint : '';
      if (st.ui.activeGroupId) {
        hint.textContent = 'Dans le groupe — Échap pour sortir';
      }
    }
  }

  MB.ui = MB.ui || {};
  MB.ui.toolbar = { init: init, TOOLS: TOOLS };
})();
