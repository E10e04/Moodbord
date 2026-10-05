/* =========================================================================
 * elementView.js — Vue DOM d'un élément.
 * Géomètre mise à jour à chaque frame de drag (styles only),
 * contenu re-rendu seulement quand `_rev` change.
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});

  function create(el) {
    var node = document.createElement('div');
    node.className = 'mb-el mb-el--' + el.type;
    node.dataset.id = el.id;

    var view = {
      el: el,
      node: node,
      rev: -1,

      update: function (e) {
        view.el = e || view.el;
        var x = view.el;
        node.style.left = x.x + 'px';
        node.style.top = x.y + 'px';
        node.style.width = x.w + 'px';
        node.style.height = x.h + 'px';
        node.style.transform = x.rotation ? 'rotate(' + x.rotation + 'deg)' : '';
        if (x.hidden) {
          node.style.display = 'none';
        } else {
          node.style.display = '';
        }
        if (x.locked) node.classList.add('is-locked');
        else node.classList.remove('is-locked');

        // lignes et croquis : la géométrie vit dans data → re-rendu complet
        if (view.rev !== x._rev || x.type === 'line' || x.type === 'sketch') {
          view.renderContent(x);
        }
      },

      renderContent: function (e) {
        var x = e || view.el;
        if (!x) return;
        var wasEditing = node.querySelector('.is-editing');
        /* v1.13 — CORRECTIF PERTE DE TEXTE (2e couche, cf.
         * interactions.js pour la 1re) : la frappe en cours vit dans
         * le DOM (commitée à la sortie d'édition) ; un re-rendu
         * pendant l'édition (inspecteur, autoH, autre nextRev…)
         * réinjectait le contenu du MODÈLE et effaçait la frappe. Le
         * contenu VIVANT du champ édité est capturé avant le
         * re-rendu, puis réinjecté tel quel — la source de vérité
         * reste le champ tant que l'édition est ouverte. */
        var wasHtml = wasEditing ? wasEditing.innerHTML : null;
        var cropMode = MB.store.s().ui.cropId === x.id;
        node.innerHTML = MB.content.render(x);
        view.rev = x._rev;
        if (wasEditing) {
          // l'édition en cours est restaurée sur le nouveau DOM
          var field = wasEditing.getAttribute('data-field');
          var again = node.querySelector('[data-field="' + field + '"]');
          if (again && MB.store.s().ui.editingId === x.id) {
            again.classList.add('is-editing');
            if (wasHtml !== null) again.innerHTML = wasHtml;
            /* v1.8 — les champs riches (corps des notes/textes) repassent
             * en contenteditable HTML, les autres en texte brut.
             * v1.17 — les TITRES des cartes texte/note sont riches
             * eux aussi (comme les en-têtes de colonnes). */
            var rich =
              (field === 'text' && (x.type === 'note' || x.type === 'text')) ||
              (field === 'title' &&
                (x.type === 'text' || x.type === 'note' || x.type === 'column'));
            again.setAttribute('contenteditable', rich ? 'true' : 'plaintext-only');
          }
        }
        void cropMode;
        MB.content.afterMount(view, x);
      },

      destroy: function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }
    };

    view.update(el);
    return view;
  }

  MB.elementView = { create: create };
})();
