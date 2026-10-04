/* =========================================================================
 * mb-preview-bridge.js — pont entre le moteur Preview du Moodboard et
 * ce template (TemplateMo 622 Clearwave).
 *
 * Le parent (panneau CEP / application / preview web) recolore le site
 * en injectant une feuille de style :root{} de variables --preview-*.
 * Deux voies, la plus rapide gagne :
 *   1. accès direct au document (same-origin — web preview, CEP avec
 *      --allow-file-access-from-files) ;
 *   2. postMessage (repli universel — fonctionne même origines opaques).
 *
 * Le bridge signale aussi son chargement au parent (mb-preview-ready)
 * pour que le moteur pousse les couleurs dès que le document existe.
 * ========================================================================= */
(function () {
  'use strict';

  var STYLE_ID = 'mb-preview-vars';

  function apply(css) {
    var d = document;
    var s = d.getElementById(STYLE_ID);
    if (!s) {
      s = d.createElement('style');
      s.id = STYLE_ID;
      (d.head || d.documentElement).appendChild(s);
    }
    s.textContent = css;
  }

  window.addEventListener('message', function (e) {
    var m = e && e.data;
    if (m && m.type === 'mb-preview-vars' && typeof m.css === 'string') {
      apply(m.css);
    }
  });

  /* Le parent peut demander l'état (prêt / déjà coloré). */
  window.addEventListener('message', function (e) {
    var m = e && e.data;
    if (m && m.type === 'mb-preview-ping') {
      var origin = '*';
      try {
        e.source.postMessage({
          type: 'mb-preview-pong',
          ready: true,
          hasVars: !!document.getElementById(STYLE_ID),
          href: location.href
        }, origin);
      } catch (err) { /* origine inaccessible : silencieux */ }
    }
  });

  /* Signalement de démarrage : le moteur en profite pour pousser les
   * couleurs SANS attendre un éventuel load complet (fonts, images). */
  try {
    window.parent.postMessage({ type: 'mb-preview-ready', href: location.href }, '*');
  } catch (err) { /* hors iframe : silencieux */ }
})();
