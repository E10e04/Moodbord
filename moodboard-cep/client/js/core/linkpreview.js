/* =========================================================================
 * linkpreview.js — Infos légères des liens (v1.10).
 *
 * Demande utilisateur : « je ne veux pas que le site soit chargé quand
 * je mets le lien — juste que le LOGO du site soit pris pour la mise
 * en forme ». Le site n'est donc JAMAIS rendu ni capturé :
 *
 *  - LOGO : favicon haute résolution via le service public s2.favicons
 *    (une simple balise <img>, pas de CORS, pas de chargement de page) ;
 *  - TITRE + DESCRIPTION : lecture best-effort des métadonnées HTML
 *    (og:title / og:description / <title>) — un fetch texte court avec
 *    garde-fou de 5 s, silencieux s'il échoue (CORS, hors ligne…) :
 *    la carte reste complète avec ses valeurs éditables ;
 *  - l'application de bureau n'utilise PLUS de WebContentsView (la
 *    capture d'écran v1.9 est retirée).
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});

  function validUrl(url) {
    var s = String(url || '').trim();
    return /^https?:\/\/[^\s]+$/i.test(s) ? s : '';
  }

  function faviconUrl(url) {
    try {
      var d = MB.util.domainOf(url);
      if (!d) return '';
      return 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(d) + '&sz=128';
    } catch (e) {
      return '';
    }
  }

  /* ---------------------- métadonnées HTML (best effort) ------------- */

  function metaContent(html, patterns) {
    for (var i = 0; i < patterns.length; i++) {
      var m = String(html || '').match(patterns[i]);
      if (m && m[1]) return m[1].replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    }
    return '';
  }

  function decodeEntities(s) {
    var t = document.createElement('textarea');
    t.innerHTML = String(s || '');
    return t.value;
  }

  /* → Promise<{title, desc, site}> — chaîne jamais rejetée. */
  function fetchMeta(url) {
    var u = validUrl(url);
    if (!u) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var done = false;
      function finish(v) {
        if (done) return;
        done = true;
        resolve(v);
      }
      /* Garde-fou : 5 s max — jamais bloquer la carte. */
      var timer = setTimeout(function () {
        finish(null);
      }, 5000);
      fetch(u, { mode: 'cors' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        })
        .then(function (html) {
          clearTimeout(timer);
          var title = metaContent(html, [
            /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
            /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
            /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
            /<title[^>]*>([^<]+)<\/title>/i
          ]);
          var desc = metaContent(html, [
            /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
            /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
            /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
            /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i
          ]);
          var site = metaContent(html, [
            /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
            /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i
          ]);
          finish({
            title: title ? decodeEntities(title).slice(0, 140) : '',
            desc: desc ? decodeEntities(desc).slice(0, 220) : '',
            site: site ? decodeEntities(site).slice(0, 60) : ''
          });
        })
        .catch(function () {
          clearTimeout(timer);
          finish(null);
        });
    });
  }

  /* ------------------------------ API ------------------------------- */

  /* → Promise<{title, desc, site, favicon}|null> : tout ce dont la carte
   * a besoin pour sa mise en forme — sans jamais charger le site. */
  function lookup(url) {
    var u = validUrl(url);
    if (!u) return Promise.resolve(null);
    return fetchMeta(u).then(function (meta) {
      return {
        title: meta && meta.title ? meta.title : '',
        desc: meta && meta.desc ? meta.desc : '',
        site: meta && meta.site ? meta.site : '',
        favicon: faviconUrl(u)
      };
    });
  }

  /* Application à l'élément (arrière-plan, sans entrée d'historique :
   * l'enrichissement n'est pas une action utilisateur).
   *  - le favicon (logo) remplit la carte s'il est absent ;
   *  - les métadonnées ne remplissent que les champs ENCORE VIDES (un
   *    titre ou une description édités ne sont JAMAIS écrasés). */
  function applyToElement(el) {
    if (!el || !el.data) return Promise.resolve(null);
    var id = el.id;
    return lookup(el.data.url).then(function (info) {
      var live = MB.store.el(id);
      if (!live || live.type !== 'link' || !live.data) return null;
      if (!info) {
        /* Même sans métadonnées : le logo (favicon) reste appliqué. */
        if (!live.data.preview) {
          live.data.preview = faviconUrl(live.data.url);
          if (MB.board) MB.board.renderContent(id);
          if (MB.storage) MB.storage.markDirty();
        }
        return null;
      }
      var patch = {};
      if (!live.data.preview && info.favicon) patch.preview = info.favicon;
      if (!live.data.site && info.site) patch.site = info.site;
      /* Le titre par défaut (dérivé de l'URL) est remplacé par le vrai
       * titre de la page ; un titre déjà choisi/édité est respecté. */
      var defaultTitle = MB.util.titleFromUrl(live.data.url);
      if ((!live.data.title || live.data.title === defaultTitle) && info.title) {
        patch.title = info.title;
      }
      if (!live.data.desc && info.desc) patch.desc = info.desc;
      var keys = Object.keys(patch);
      if (!keys.length) return null;
      keys.forEach(function (k) {
        live.data[k] = patch[k];
      });
      if (MB.board) MB.board.renderContent(id);
      if (MB.storage) MB.storage.markDirty();
      return info;
    });
  }

  MB.linkPreview = {
    lookup: lookup,
    fetchMeta: fetchMeta,
    applyToElement: applyToElement,
    faviconUrl: faviconUrl
  };
})();
