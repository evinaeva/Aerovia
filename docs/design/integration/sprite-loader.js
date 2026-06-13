/* PlaneFlow sprite loader
   Rasterises inline-SVG <symbol> sheets into <img> once, caches by id+size,
   and blits them onto a 2D canvas. DPR-aware so sprites stay crisp on phones.

   Usage:
     PFSprites.blitC(ctx, 'plane-vip', x, y, 44, 44, ang + Math.PI/2);  // centered+rotated
     PFSprites.blit (ctx, 'tile-tarmac', dx, dy, 64, 64);               // top-left
   blit/blitC return false if the sprite isn't decoded yet — callers should
   fall back to the existing procedural draw so nothing pops in/out. */
(function (global) {
  const cache = new Map();

  function aspect(id) {            // [w,h] from the symbol's viewBox
    const sym = document.getElementById(id);
    if (!sym) return [1, 1];
    const vb = (sym.getAttribute('viewBox') || '0 0 1 1').split(/\s+/).map(Number);
    return [vb[2] || 1, vb[3] || 1];
  }

  function rasterize(id, w, h) {
    const sym = document.getElementById(id);
    if (!sym) { if (global.console) console.warn('PFSprites: missing', id); return null; }
    const vb = sym.getAttribute('viewBox') || '0 0 64 64';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb +
                '" width="' + w + '" height="' + h + '">' + sym.innerHTML + '</svg>';
    const img = new Image();
    img.decoding = 'async';
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return img;
  }

  function img(id, w, h) {
    const dpr = global.devicePixelRatio || 1;
    const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
    const key = id + '@' + pw + 'x' + ph;
    let im = cache.get(key);
    if (!im) { im = rasterize(id, pw, ph); if (im) cache.set(key, im); }
    return im;
  }

  function ready(im) { return im && im.complete && im.naturalWidth > 0; }

  function blit(ctx, id, dx, dy, dw, dh) {
    const im = img(id, dw, dh);
    if (!ready(im)) return false;
    ctx.drawImage(im, dx, dy, dw, dh);
    return true;
  }

  function blitC(ctx, id, cx, cy, dw, dh, rot) {
    const im = img(id, dw, dh);
    if (!ready(im)) return false;
    ctx.save();
    ctx.translate(cx, cy);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(im, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    return true;
  }

  // Warm the cache for a list of [id, w, h] so first frame has no pop-in.
  function preload(list) { list.forEach(function (e) { img(e[0], e[1], e[2]); }); }

  global.PFSprites = { aspect, rasterize, img, blit, blitC, preload, ready, cache };
})(typeof window !== 'undefined' ? window : globalThis);
