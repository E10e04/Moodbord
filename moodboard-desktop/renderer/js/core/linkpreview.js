/* =========================================================================
 * linkpreview.js — Aperçu STATIQUE des liens (v1.9).
 *
 * Objectif : chaque carte de lien peut afficher une image figée du site
 * visé — jamais une page animée.
 *
 * Stratégie par environnement :
 *  - APPLICATION (Electron) : capture d'écran réelle par le processus
 *    principal (WebContentsView hors écran → PNG → data URL, 480 px de
 *    large) ; repli og:image, puis favicon ;
 *  - EXTENSION CEP : lecture de la page (og:image / twitter:image, dont
 *    l'image est convertie en data URL pour un fichier autonome) ;
 *    repli favicon haute résolution ;
 *  - WEB (aperçu) : essai og:image (limité par CORS) ; repli favicon.
 *
 * La favicon de repli passe par le service public s2.favicons (chargée
 * en <img>, sans CORS) et reste une simple URL — si elle est invisible
 * hors ligne, la carte retombe sur sa tuile lettre.
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

  /* Extrait l'URL de l'image sociale déclarée par la page. */
  function extractOgImage(html) {
    var s = String(html || '');
    if (!s) return '';
    var patterns = [
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/i
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = s.match(patterns[i]);
      if (m && m[1]) return m[1].replace(/&amp;/g, '&');
    }
    return '';
  }

  function fetchAsDataUrl(url) {
    return fetch(url, { mode: 'cors' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.blob();
      })
      .then(function (b) {
        if (!b || b.size > 4 * 1024 * 1024) throw new Error('trop volumineux');
        return new Promise(function (resolve, reject) {
          var fr = new FileReader();
          fr.onload = function () {
            resolve(String(fr.result));
          };
          fr.onerror = function () {
            reject(new Error('lecture impossible'));
          };
          fr.readAsDataURL(b);
        });
      });
  }

  /* ------- capture par le processus principal (application) ------- */

  function desktopShot(url) {
    if (!MB.desktop || !MB.desktop.canLinkPreview) return Promise.resolve('');
    return MB.desktop.linkPreview(url).then(function (r) {
      if (r && r.err === 0 && r.dataUrl && r.dataUrl.indexOf('data:image') === 0) return r.dataUrl;
      return '';
    });
  }

  /* -------- og:image (extension CEP + essai web, best effort) -------- */

  function ogImage(url) {
    return fetch(url, { mode: 'cors' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (html) {
        var img = extractOgImage(html);
        if (!img) throw new Error('pas d’og:image');
        /* Résolution relative (rares sites déclarent « /img/og.jpg »). */
        if (img.indexOf('//') !== 0 && img.indexOf('http') !== 0) {
          var origin = '';
          var m = url.match(/^https?:\/\/[^/]+/i);
          if (m) origin = m[0];
          img = origin + (img.charAt(0) === '/' ? '' : '/') + img;
        }
        return img;
      })
      .then(function (img) {
        /* Autonomie du fichier : on tente la conversion en data URL ;
         * sinon l'URL reste affichable directement (balise <img>). */
        return fetchAsDataUrl(img).catch(function () {
          return img;
        });
      });
  }

  /* ------------------------------ API ------------------------------- */

  /* → Promise<dataUrl|url|null> : meilleure prévisualisation disponible. */
  function capture(url) {
    var u = validUrl(url);
    if (!u) return Promise.resolve(null);
    var chain =
      MB.desktop && MB.desktop.active
        ? desktopShot(u).then(function (shot) {
            return shot || ogImage(u).catch(function () {
              return '';
            });
          })
        : ogImage(u).catch(function () {
            return '';
          });
    return chain
      .then(function (img) {
        return img || faviconUrl(u) || null;
      })
      .catch(function () {
        return faviconUrl(u) || null;
      });
  }

  /* Capture + application à l'élément (arrière-plan, sans entrée
   * d'historique : l'aperçu est un enrichissement, pas une action).
   * autoGrow : la carte s'agrandit pour accueillir l'image UNE fois,
   * uniquement si l'utilisateur n'a pas déjà redimensionné la carte.
   * kind : 'icon' (favicon carrée, centrée) | 'shot'/'og' (pleine
   * largeur, recadrée) — pilote le rendu de la carte. */
  function applyToElement(el) {
    if (!el || !el.data) return Promise.resolve(null);
    var id = el.id;
    return capture(el.data.url).then(function (img) {
      var live = MB.store.el(id);
      if (!live || live.type !== 'link' || !live.data) return null;
      if (!img) return null;
      var isIcon = /s2\/favicons/.test(img);
      live.data.preview = img;
      live.data.previewKind = isIcon ? 'icon' : 'shot';
      /* La carte ne grandit que pour une VRAIE image (capture, og:image)
       * — une favicon reste dans la tuite, carte compacte. */
      if (!isIcon && live.h < 110 && !live._shotSized) {
        live._shotSized = true;
        live.h = Math.round(Math.max(150, live.w * 0.62));
      }
      if (MB.board) MB.board.renderContent(id);
      if (MB.storage) MB.storage.markDirty();
      return img;
    });
  }

  MB.linkPreview = {
    capture: capture,
    applyToElement: applyToElement,
    faviconUrl: faviconUrl
  };
})();
