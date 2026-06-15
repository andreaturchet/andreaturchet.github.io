/* =====================================================================
   Liquid-glass refraction for the top nav — Apple-style, after
   https://aave.com/design/building-glass-for-the-web

   `backdrop-filter: url(#svg)` is not usable cross-browser, so instead the
   page (orb background + scrolling content) is cloned inside the nav,
   kept aligned with the real page on every scroll frame, and refracted
   with a regular `filter: url(#lens)` — the route that works in
   Chromium, Safari and Firefox alike. The lens filter blurs, displaces
   R/G/B at slightly different strengths (chromatic fringe), then
   saturates/brightens.

   On unsupported browsers nothing here runs and the nav keeps its
   frosted glass.
   ===================================================================== */
(function () {
  'use strict';

  var nav = document.getElementById('nav');
  if (!nav) return;

  var supported =
    typeof CSS !== 'undefined' &&
    CSS.supports('filter', 'url(#x)');
  if (!supported) return;

  var BLEED = 48;       // px rendered past each nav edge so displaced samples exist (keep in sync with styles.css)
  var STRENGTH = 0.7;   // global multiplier on the size-derived displacement scale
  var CHROMA = 0.14;    // red/blue displacement split -> chromatic fringe at the rim
  var BLUR = 3.2;       // frosted blur (SVG units = px), applied before displacement
  var SATURATE = 1.38;
  var BRIGHTNESS = 1.04;
  var FILTER_ID = 'navLensFilter';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var XLINK = 'http://www.w3.org/1999/xlink';

  var built = false;
  var active = false;
  var lens, frame, fixedLayer, scrollLayer;
  var svgHost, feImage, dispR, dispG, dispB;
  var stylePairs = [];  // [originalEl, cloneEl] whose inline styles are mirrored each frame (hero phone)
  var mapW = 0, mapH = 0;
  var ticking = false;
  var scrollLooping = false;
  var lastScrollY = -1;
  var idleFrames = 0;
  var regenTimer = 0;
  var resizeObserver = null;

  /* ---- Displacement map ------------------------------------------------ */

  /* Signed distance to a rounded rectangle (negative = inside). */
  function sdRoundRect(px, py, hw, hh, r) {
    var qx = Math.abs(px) - (hw - r);
    var qy = Math.abs(py) - (hh - r);
    var ox = Math.max(qx, 0), oy = Math.max(qy, 0);
    return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
  }

  /* The map covers the whole frame (nav + bleed margin); the lens — a bevel
     whose slope drives the displacement — is the nav's rounded rect in the
     middle, neutral (128,128) everywhere else. Red = horizontal shift,
     green = vertical. Sampling points inward so the glass magnifies the
     backdrop instead of smearing pixels in from outside the nav. */
  function buildMap(fw, fh, navW, navH, radius, band) {
    var cv = document.createElement('canvas');
    cv.width = fw; cv.height = fh;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(fw, fh);
    var d = img.data;
    var hw = navW / 2, hh = navH / 2;
    var cx = fw / 2, cy = fh / 2;
    var r = Math.min(radius, hw, hh);
    var rim = Math.max(1, Math.min(band, hw, hh));

    for (var y = 0; y < fh; y++) {
      for (var x = 0; x < fw; x++) {
        var px = x - cx + 0.5, py = y - cy + 0.5;
        var inward = -sdRoundRect(px, py, hw, hh, r); // >0 inside, 0 on the edge
        var R = 128, G = 128;
        if (inward >= 0 && inward < rim) {
          // Outward unit normal from the SDF gradient (central differences).
          var gx = sdRoundRect(px + 1, py, hw, hh, r) - sdRoundRect(px - 1, py, hw, hh, r);
          var gy = sdRoundRect(px, py + 1, hw, hh, r) - sdRoundRect(px, py - 1, hw, hh, r);
          var len = Math.hypot(gx, gy) || 1;
          var e = inward / rim;                      // 0 at edge -> 1 at inner rim
          var slope = Math.cos(e * Math.PI / 2);     // bevel slope: 1 at edge -> 0 inside
          R = 128 - (gx / len) * slope * 127;
          G = 128 - (gy / len) * slope * 127;
        }
        var i = (y * fw + x) * 4;
        d[i] = R; d[i + 1] = G; d[i + 2] = 128; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL();
  }

  /* ---- SVG filter -------------------------------------------------------- */

  /* One displacement pass reduced to a single colour channel, alpha forced
     to 1 so the three channels sum back cleanly in premultiplied space. */
  function dispPass(resultName, channelMatrix, outName) {
    var disp = document.createElementNS(SVGNS, 'feDisplacementMap');
    disp.setAttribute('in', 'src');
    disp.setAttribute('in2', 'smap');
    disp.setAttribute('xChannelSelector', 'R');
    disp.setAttribute('yChannelSelector', 'G');
    disp.setAttribute('result', resultName);
    var cm = document.createElementNS(SVGNS, 'feColorMatrix');
    cm.setAttribute('type', 'matrix');
    cm.setAttribute('values', channelMatrix);
    cm.setAttribute('in', resultName);
    cm.setAttribute('result', outName);
    return { disp: disp, cm: cm };
  }

  /* Additive composite (a + b) of two filter results. */
  function addImages(inA, inB, resultName) {
    var c = document.createElementNS(SVGNS, 'feComposite');
    c.setAttribute('in', inA); c.setAttribute('in2', inB);
    c.setAttribute('operator', 'arithmetic');
    c.setAttribute('k1', '0'); c.setAttribute('k2', '1');
    c.setAttribute('k3', '1'); c.setAttribute('k4', '0');
    if (resultName) c.setAttribute('result', resultName);
    return c;
  }

  function buildSvg() {
    svgHost = document.createElementNS(SVGNS, 'svg');
    svgHost.setAttribute('width', '0');
    svgHost.setAttribute('height', '0');
    svgHost.setAttribute('aria-hidden', 'true');
    svgHost.setAttribute('focusable', 'false');
    svgHost.style.position = 'absolute';

    var filter = document.createElementNS(SVGNS, 'filter');
    filter.setAttribute('id', FILTER_ID);
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    filter.setAttribute('x', '0'); filter.setAttribute('y', '0');
    filter.setAttribute('width', '100%'); filter.setAttribute('height', '100%');

    feImage = document.createElementNS(SVGNS, 'feImage');
    feImage.setAttribute('result', 'map');
    feImage.setAttribute('preserveAspectRatio', 'none');
    feImage.setAttribute('x', '0');
    feImage.setAttribute('y', '0');

    var mapBlur = document.createElementNS(SVGNS, 'feGaussianBlur');
    mapBlur.setAttribute('in', 'map');
    mapBlur.setAttribute('stdDeviation', '1');
    mapBlur.setAttribute('result', 'smap');

    var srcBlur = document.createElementNS(SVGNS, 'feGaussianBlur');
    srcBlur.setAttribute('in', 'SourceGraphic');
    srcBlur.setAttribute('stdDeviation', String(BLUR));
    srcBlur.setAttribute('result', 'src');

    var R = dispPass('dR', '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1', 'cR');
    var G = dispPass('dG', '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 0 1', 'cG');
    var B = dispPass('dB', '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 0 1', 'cB');
    dispR = R.disp; dispG = G.disp; dispB = B.disp;

    var sat = document.createElementNS(SVGNS, 'feColorMatrix');
    sat.setAttribute('type', 'saturate');
    sat.setAttribute('values', String(SATURATE));
    sat.setAttribute('in', 'rgb');
    sat.setAttribute('result', 'sat');

    var bright = document.createElementNS(SVGNS, 'feComponentTransfer');
    bright.setAttribute('in', 'sat');
    ['feFuncR', 'feFuncG', 'feFuncB'].forEach(function (fn) {
      var f = document.createElementNS(SVGNS, fn);
      f.setAttribute('type', 'linear');
      f.setAttribute('slope', String(BRIGHTNESS));
      bright.appendChild(f);
    });

    filter.append(
      feImage, mapBlur, srcBlur,
      R.disp, R.cm, G.disp, G.cm, B.disp, B.cm,
      addImages('cR', 'cG', 'cRG'), addImages('cRG', 'cB', 'rgb'),
      sat, bright
    );

    var defs = document.createElementNS(SVGNS, 'defs');
    defs.appendChild(filter);
    svgHost.appendChild(defs);
    document.body.appendChild(svgHost);
  }

  /* ---- Lens DOM ----------------------------------------------------------- */

  function buildLens() {
    lens = document.createElement('div');
    lens.className = 'nav-lens';
    lens.setAttribute('aria-hidden', 'true');
    if ('inert' in lens) lens.inert = true;

    frame = document.createElement('div');
    frame.className = 'nav-lens-frame';
    frame.style.filter = 'url(#' + FILTER_ID + ')';

    fixedLayer = document.createElement('div');
    fixedLayer.className = 'nav-lens-fixed';
    scrollLayer = document.createElement('div');
    scrollLayer.className = 'nav-lens-scroll';

    frame.appendChild(fixedLayer);
    frame.appendChild(scrollLayer);
    lens.appendChild(frame);
    nav.insertBefore(lens, nav.firstChild);
  }

  /* ---- Cloning -------------------------------------------------------------
     The page is deep-cloned into the lens. ids are stripped (the clones come
     BEFORE the real content in DOM order, so duplicate ids would hijack
     getElementById in script.js). The clone is simplified aggressively because
     the lens needs colour and motion cues, not full image/detail fidelity. */

  function stripIds(root) {
    root.removeAttribute('id');
    var els = root.querySelectorAll('[id]');
    for (var i = 0; i < els.length; i++) els[i].removeAttribute('id');
  }

  /* CSS animations restart from zero on cloned nodes; resync them to the
     originals (orbs float on 20-35s loops, visibly out of phase otherwise). */
  function syncAnimations(src, dst) {
    if (!src.getAnimations) return;
    var a = [src].concat([].slice.call(src.querySelectorAll('*')));
    var b = [dst].concat([].slice.call(dst.querySelectorAll('*')));
    if (a.length !== b.length) return;
    for (var i = 0; i < a.length; i++) {
      var sa = a[i].getAnimations ? a[i].getAnimations() : [];
      if (!sa.length) continue;
      var da = b[i].getAnimations();
      for (var j = 0; j < sa.length && j < da.length; j++) {
        try {
          da[j].currentTime = sa[j].currentTime;
          da[j].playbackRate = sa[j].playbackRate;
        } catch (e) { /* detached/finished animation — ignore */ }
      }
    }
  }

  /* script.js drives the hero phone via inline style on every scroll frame;
     mirror inline styles of those elements instead of re-cloning. */
  function collectStylePairs(src, dst) {
    var a = src.querySelectorAll('[style]');
    var b = dst.querySelectorAll('[style]');
    if (a.length !== b.length) return;
    for (var i = 0; i < a.length; i++) stylePairs.push([a[i], b[i]]);
  }

  function mirrorStyles() {
    for (var i = 0; i < stylePairs.length; i++) {
      var s = stylePairs[i][0].getAttribute('style') || '';
      if (s !== stylePairs[i][1].getAttribute('style')) {
        stylePairs[i][1].setAttribute('style', s);
      }
    }
  }

  function makeImageProxy(img) {
    var proxy = document.createElement('span');
    proxy.className = (img.className ? img.className + ' ' : '') + 'nav-lens-img-proxy';
    proxy.setAttribute('aria-hidden', 'true');

    var w = parseFloat(img.getAttribute('width')) || img.naturalWidth || 1;
    var h = parseFloat(img.getAttribute('height')) || img.naturalHeight || 1;
    proxy.style.aspectRatio = w + ' / ' + h;
    return proxy;
  }

  function simplifyClone(root) {
    var remove = root.querySelectorAll('canvas, video, iframe, noscript, source, picture, .game-modal');
    for (var i = 0; i < remove.length; i++) remove[i].remove();

    var images = root.querySelectorAll('img');
    for (var j = 0; j < images.length; j++) {
      images[j].replaceWith(makeImageProxy(images[j]));
    }
  }

  function rebuildClones() {
    stylePairs = [];
    fixedLayer.textContent = '';
    scrollLayer.textContent = '';

    var orbs = document.querySelector('.bg-orbs');
    if (orbs) {
      var oc = orbs.cloneNode(true);
      stripIds(oc);
      fixedLayer.appendChild(oc);
      syncAnimations(orbs, oc);
    }

    var children = document.body.children;
    for (var i = 0; i < children.length; i++) {
      var el = children[i];
      if (el === nav || el === orbs || el === svgHost || el === lens) continue;
      var tag = el.tagName.toUpperCase();
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK' || tag === 'SVG') continue;
      if (el.matches && (el.matches('.game-modal') || el.hidden)) continue;
      var c = el.cloneNode(true);
      stripIds(c);
      simplifyClone(c);
      scrollLayer.appendChild(c);
      collectStylePairs(el, c);
    }

    layout();
  }

  /* ---- Geometry -------------------------------------------------------------
     frame-local (0,0) sits at viewport (navLeft - BLEED, navTop - BLEED).
     The fixed layer (page bg + orbs) is glued to the viewport; the scroll
     layer (page content laid out at document coordinates) is offset by
     -scrollY on top of that. */

  function layout() {
    if (!active) return;
    var rect = nav.getBoundingClientRect();
    var vw = document.documentElement.clientWidth;
    var vh = window.innerHeight;

    frame.style.width = (rect.width + 2 * BLEED) + 'px';
    frame.style.height = (rect.height + 2 * BLEED) + 'px';

    var ox = BLEED - rect.left;
    fixedLayer.style.width = vw + 'px';
    fixedLayer.style.height = vh + 'px';
    fixedLayer.style.transform = 'translate(' + ox + 'px,' + (BLEED - rect.top) + 'px)';

    scrollLayer.style.width = vw + 'px';
    scrollLayer.style.transform =
      'translate(' + ox + 'px,' + (BLEED - rect.top - window.scrollY) + 'px)';

    mirrorStyles();
  }

  function regenMap() {
    var rect = nav.getBoundingClientRect();
    var w = Math.max(2, Math.round(rect.width));
    var h = Math.max(2, Math.round(rect.height));
    if (w === mapW && h === mapH) return;
    mapW = w; mapH = h;

    var radius = parseFloat(getComputedStyle(nav).borderTopLeftRadius) || h / 2;
    var band = Math.max(12, Math.min(h / 2, 30));
    var fw = w + 2 * BLEED, fh = h + 2 * BLEED;

    var url = buildMap(fw, fh, w, h, radius, band);
    feImage.setAttributeNS(XLINK, 'href', url);
    feImage.setAttribute('href', url);
    feImage.setAttribute('width', fw);
    feImage.setAttribute('height', fh);

    var s = Math.max(6, Math.min(band * 0.9, 90)) * STRENGTH;
    dispG.setAttribute('scale', s);
    dispR.setAttribute('scale', s * (1 + CHROMA));
    dispB.setAttribute('scale', s * (1 - CHROMA));
  }

  /* ---- Wiring ---------------------------------------------------------------- */

  function scheduleGeometryRefresh() {
    requestTick();
    clearTimeout(regenTimer);
    regenTimer = setTimeout(function () {
      if (active) { regenMap(); layout(); }
    }, 120);
  }

  function requestTick() {
    if (!ticking && active) {
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        layout();
      });
    }
  }

  function scrollStep() {
    if (!active) {
      scrollLooping = false;
      return;
    }

    var y = window.scrollY || document.documentElement.scrollTop || 0;
    if (y !== lastScrollY) {
      lastScrollY = y;
      idleFrames = 0;
      layout();
    } else if (++idleFrames > 8) {
      scrollLooping = false;
      return;
    }

    requestAnimationFrame(scrollStep);
  }

  function startScrollLoop() {
    if (!active) return;
    idleFrames = 0;
    if (scrollLooping) return;
    scrollLooping = true;
    lastScrollY = -1;
    requestAnimationFrame(scrollStep);
  }

  function activate() {
    if (active) return;
    if (!built) {
      built = true;
      buildSvg();
      buildLens();
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(function () {
          if (!active) return;
          scheduleGeometryRefresh();
        });
      }
      window.addEventListener('scroll', startScrollLoop, { passive: true });
      document.addEventListener('scroll', startScrollLoop, { passive: true, capture: true });
      window.addEventListener('wheel', startScrollLoop, { passive: true });
      window.addEventListener('touchmove', startScrollLoop, { passive: true });
      if (window.visualViewport) {
        window.visualViewport.addEventListener('scroll', startScrollLoop, { passive: true });
      }
      window.addEventListener('resize', scheduleGeometryRefresh);

      var menuButton = document.getElementById('mobileMenuBtn');
      if (menuButton) menuButton.addEventListener('click', scheduleGeometryRefresh);
    }
    active = true;
    nav.classList.add('nav--lens');
    rebuildClones();
    regenMap();
    layout();
    if (resizeObserver) resizeObserver.observe(nav);
  }

  function deactivate() {
    if (!active) return;
    active = false;
    nav.classList.remove('nav--lens');
    if (resizeObserver) resizeObserver.disconnect();
    stylePairs = [];
    fixedLayer.textContent = '';
    scrollLayer.textContent = '';
    mapW = 0; mapH = 0;
    scrollLooping = false;
    lastScrollY = -1;
    idleFrames = 0;
  }

  activate();
})();
