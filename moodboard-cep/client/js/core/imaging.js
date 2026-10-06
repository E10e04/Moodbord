/* =========================================================================
 * imaging.js — Images du canvas vers le SYSTEME (v1.11).
 *
 * Le canvas a son propre presse-papiers interne (⌘C/⌘V d'éléments) ;
 * ce module ouvre les images au reste du monde :
 *
 *   - copyImage(el)        : bitmap PNG dans le presse-papiers SYSTEME
 *                            (collable dans Photoshop, Discord, Mail…) ;
 *   - downloadImage(el)    : fichier sur disque — dialogue natif dans
 *                            l'extension CEP et l'application, simple
 *                            téléchargement dans le navigateur ;
 *   - readClipboardImage() : lit une image DU presse-papiers système
 *                            (coller depuis l'extérieur) ;
 *   - pasteImageAt()       : pose une image (data URL) sur le canvas.
 *
 * Sources gérées : data URLs (imports) et chemins relatifs d'assets
 * (bibliothèque, démo) — tout passe par un canvas de ré-encodage PNG
 * pour une image propre, sans métadonnées exotiques.
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});

  /* v1.20 — toasts traduits (ils restaient en français en anglais). */
  function T(k, vars) {
    return MB.i18n ? MB.i18n.t(k, vars) : k;
  }

  function isImageEl(el) {
    return !!el && el.type === 'image' && !!el.data && !!el.data.src;
  }

  /* Charge n'importe quelle source de l'application (data URL ou chemin
   * relatif d'asset) en Image décodée. */
  function loadImg(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        reject(new Error('Image illisible'));
      };
      img.src = src;
    });
  }

  /* data.src → data URL PNG (ré-encodée), avec dimensions naturelles. */
  function toPngDataUrl(src) {
    return loadImg(src).then(function (img) {
      var cv = document.createElement('canvas');
      cv.width = img.naturalWidth || img.width || 512;
      cv.height = img.naturalHeight || img.height || 512;
      var ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return {
        dataUrl: cv.toDataURL('image/png'),
        w: cv.width,
        h: cv.height
      };
    });
  }

  function dataUrlToBase64(dataUrl) {
    var i = String(dataUrl || '').indexOf(',');
    return i >= 0 ? String(dataUrl).slice(i + 1) : '';
  }

  function extOf(src) {
    var m = /^data:image\/([a-z0-9+.-]+);/i.exec(String(src || ''));
    if (m) return m[1] === 'jpeg' || m[1] === 'jpg' ? 'jpg' : m[1];
    return 'png';
  }

  function safeImageName(el) {
    var base = 'image';
    try {
      var proj = (MB.store.s().project && MB.store.s().project.name) || '';
      proj = proj.trim().replace(/[\\/:*?"<>|]+/g, '-');
      if (proj) base = proj;
    } catch (e) {
      /* projet absent : nom générique */
    }
    return base + '.' + extOf(el.data.src);
  }

  /* ------------------------------------------------------------- COPIER */

  /* Copie l'image dans le presse-papiers SYSTEME en PNG bitmap.
   * Repli honnête : si le moteur (CEF ancien, permission refusée)
   * refuse l'écriture bitmap, l'élément reste copié dans le
   * presse-papiers DE L'APPLICATION (⌘V le recolle) et l'utilisateur
   * est informé du périmètre. */
  function copyImage(el) {
    if (!isImageEl(el)) return Promise.resolve(false);
    return toPngDataUrl(el.data.src)
      .then(function (info) {
        var byteStr = atob(dataUrlToBase64(info.dataUrl));
        var len = byteStr.length;
        var buf = new Uint8Array(len);
        for (var i = 0; i < len; i++) buf[i] = byteStr.charCodeAt(i);
        var blob = new Blob([buf], { type: 'image/png' });
        if (navigator.clipboard && window.ClipboardItem && navigator.clipboard.write) {
          return navigator.clipboard
            .write([new ClipboardItem({ 'image/png': blob })])
            .then(function () {
              MB.ui.toast(T('toast.imageCopied'), 'success');
              return true;
            });
        }
        throw new Error('no-clipboard-item');
      })
      .catch(function (err) {
        /* repli : copie applicative (l'élément est déjà sélectionné) */
        try {
          if (MB.store.selectedIds().indexOf(el.id) < 0) MB.store.setSelection([el.id]);
          MB.store.copySelection();
        } catch (e) {
          /* noop */
        }
        MB.ui.toast(T('toast.imageCopyFallback'), 'info');
        return false;
      });
  }

  /* ---------------------------------------------------- TÉLÉCHARGER */

  /* Enregistre l'image sur le disque. Extension/application : dialogue
   * natif + écriture binaire (Base64). Navigateur : téléchargement. */
  function downloadImage(el) {
    if (!isImageEl(el)) return Promise.resolve(false);
    var name = safeImageName(el);
    var ext = extOf(el.data.src);
    return toPngDataUrl(el.data.src)
      .then(function (info) {
        var b64 = dataUrlToBase64(info.dataUrl);
        var savePng = ext !== 'png' && ext !== 'jpg' && ext !== 'jpeg';
        var finalName = savePng ? name.replace(/\.[a-z0-9]+$/i, '') + '.png' : name;

        /* Navigateur (aperçu web) : téléchargement direct. */
        if (!MB.storage.isCep() && !MB.storage.isDesktop()) {
          var b = atob(b64);
          var arr = new Uint8Array(b.length);
          for (var j = 0; j < b.length; j++) arr[j] = b.charCodeAt(j);
          var url = URL.createObjectURL(new Blob([arr], { type: 'image/png' }));
          var a = document.createElement('a');
          a.href = url;
          a.download = finalName;
          document.body.appendChild(a);
          a.click();
          setTimeout(function () {
            URL.revokeObjectURL(url);
            a.remove();
          }, 400);
          MB.ui.toast(T('toast.imageDownloaded', { n: finalName }), 'success');
          return true;
        }

        /* Extension / application : dialogue natif puis écriture. */
        return MB.storage
          .pickSavePath('Enregistrer l’image', finalName, savePng ? 'png' : ext)
          .then(function (target) {
            if (!target) return false; // annulé
            var w = MB.storage.writeFileAny(target, b64, 'Base64');
            if (w && w.err === 0) {
              MB.ui.toast(T('toast.imageSaved', { p: target }), 'success');
              return true;
            }
            MB.ui.toast('Écriture impossible (' + (w && w.err) + ')', 'error');
            return false;
          });
      })
      .catch(function () {
        MB.ui.toast(T('toast.imageCantSave'), 'error');
        return false;
      });
  }

  /* ------------------------------------------------------------- COLLER */

  /* Lit une image du presse-papiers SYSTÈME (si le moteur l'autorise).
   * Le chemin privilégié reste l'événement `paste` (main.js), qui
   * transporte les fichiers sans permission. */
  function readClipboardImage() {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      return Promise.resolve(null);
    }
    return navigator.clipboard
      .read()
      .then(function (items) {
        for (var i = 0; i < items.length; i++) {
          var type = items[i].types && items[i].types.indexOf('image/png') >= 0 ? 'image/png'
            : items[i].types && items[i].types.indexOf('image/jpeg') >= 0 ? 'image/jpeg'
            : null;
          if (type) {
            return items[i].getType(type).then(function (blob) {
              return new Promise(function (resolve) {
                var fr = new FileReader();
                fr.onload = function () {
                  resolve(String(fr.result));
                };
                fr.onerror = function () {
                  resolve(null);
                };
                fr.readAsDataURL(blob);
              });
            });
          }
        }
        return null;
      })
      .catch(function () {
        return null;
      });
  }

  /* Pose une image (data URL) sur le canvas — dimensionnée comme un
   * import classique, sélectionnée, entrée d'historique unique. */
  function pasteImageAt(dataUrl, point) {
    if (!dataUrl) return Promise.resolve(null);
    return loadImg(dataUrl).then(function (img) {
      var w = img.naturalWidth || 512;
      var h = img.naturalHeight || 512;
      var scale = Math.min(1, 340 / Math.max(w, h));
      var el = MB.factory.create('image', point || MB.interact.canvasPoint({
        clientX: window.innerWidth / 2,
        clientY: window.innerHeight / 2
      }), {
        src: dataUrl,
        naturalW: w,
        naturalH: h,
        w: Math.max(48, Math.round(w * scale)),
        h: Math.max(48, Math.round(h * scale))
      });
      el._sized = true;
      MB.store.addElements([el], { label: 'Coller une image' });
      MB.store.setSelection([el.id]);
      MB.ui.toast(T('toast.imagePasted'), 'success');
      return el;
    });
  }

  MB.imaging = {
    copyImage: copyImage,
    downloadImage: downloadImage,
    readClipboardImage: readClipboardImage,
    pasteImageAt: pasteImageAt,
    toPngDataUrl: toPngDataUrl
  };
})();
