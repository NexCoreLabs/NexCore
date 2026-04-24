/*!
 * NexCore Wave Code — client-side SVG renderer
 * Spotify-style vertical bar waveform per project.
 * Usage: NexCoreWave.render(container, barHeights, options?)
 *        NexCoreWave.downloadSVG(container, filename?)
 */
(function (global) {
  'use strict';

  var BAR_COUNT    = 23;
  var HEIGHT_LEVELS = 8; // bar values are 0–7

  // ── Layout constants (all in SVG user units) ──────────────────────────
  var CARD_W       = 300;
  var CARD_H       = 88;
  var CARD_R       = 14;          // corner radius
  var LOGO_CX      = 38;          // logo circle centre-x
  var LOGO_CY      = CARD_H / 2;
  var LOGO_R       = 22;
  var DIVIDER_X    = 68;          // vertical separator line x
  var WAVE_X0      = 82;          // wave region left edge
  var WAVE_X1      = CARD_W - 12; // wave region right edge
  var BAR_MAX_H    = 52;          // pixel height for level 7
  var BAR_MIN_H    = 6;           // pixel height for level 0
  var BAR_W        = 4;
  var BAR_R_TOP    = 2;           // bar top-corner radius
  var WAVE_CY      = CARD_H / 2;  // bars are centred vertically

  var DEFAULT_COLOR = '#6ee7f3';
  var BG_COLOR      = '#090d1a';
  var DIVIDER_COLOR = 'rgba(110,231,243,0.18)';
  var LOGO_RING     = 'rgba(110,231,243,0.30)';

  // ── Helpers ───────────────────────────────────────────────────────────

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function barHeight(level) {
    var t = clamp(level, 0, HEIGHT_LEVELS - 1) / (HEIGHT_LEVELS - 1);
    return BAR_MIN_H + t * (BAR_MAX_H - BAR_MIN_H);
  }

  function svgEl(tag, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) {
        el.setAttribute(k, attrs[k]);
      }
    }
    return el;
  }

  // Rounded-top rectangle path (flat bottom, rounded top)
  function roundedTopRect(x, y, w, h, r) {
    var b = y + h;
    return (
      'M ' + (x + r) + ' ' + y +
      ' H ' + (x + w - r) +
      ' Q ' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) +
      ' V ' + b +
      ' H ' + x +
      ' V ' + (y + r) +
      ' Q ' + x + ' ' + y + ' ' + (x + r) + ' ' + y +
      ' Z'
    );
  }

  // ── Core render ───────────────────────────────────────────────────────

  /**
   * Render a NexCore wave code into `container`.
   * @param {HTMLElement} container  – cleared and filled with an SVG
   * @param {number[]}    barHeights – array of 23 integers, each 0–7
   * @param {object}      [opts]
   * @param {string}      [opts.color]    – bar/accent colour (default #6ee7f3)
   * @param {boolean}     [opts.animate]  – subtle pulse on hover (default true)
   */
  function render(container, barHeights, opts) {
    if (!container) return;
    opts = opts || {};
    var color   = opts.color   || DEFAULT_COLOR;
    var animate = opts.animate !== false;

    // Normalise heights
    var heights = [];
    for (var i = 0; i < BAR_COUNT; i++) {
      heights.push(typeof barHeights[i] === 'number' ? barHeights[i] : 3);
    }

    var svg = svgEl('svg', {
      viewBox:  '0 0 ' + CARD_W + ' ' + CARD_H,
      width:    CARD_W,
      height:   CARD_H,
      xmlns:    'http://www.w3.org/2000/svg',
      role:     'img',
      'aria-label': 'NexCore project wave code'
    });

    // ── Background card ──────────────────────────────────────────────
    svg.appendChild(svgEl('rect', {
      x: 0, y: 0,
      width: CARD_W, height: CARD_H,
      rx: CARD_R, ry: CARD_R,
      fill: BG_COLOR
    }));

    // ── Logo circle ──────────────────────────────────────────────────
    // Outer ring
    svg.appendChild(svgEl('circle', {
      cx: LOGO_CX, cy: LOGO_CY, r: LOGO_R,
      fill: 'none',
      stroke: LOGO_RING,
      'stroke-width': 1.5
    }));
    // Inner filled circle
    svg.appendChild(svgEl('circle', {
      cx: LOGO_CX, cy: LOGO_CY, r: LOGO_R - 5,
      fill: 'rgba(110,231,243,0.10)'
    }));
    // "N" letter
    var txt = svgEl('text', {
      x: LOGO_CX, y: LOGO_CY + 5,
      'text-anchor': 'middle',
      'font-family': 'Inter, Arial, sans-serif',
      'font-size': '14',
      'font-weight': '800',
      fill: color,
      'letter-spacing': '-0.5'
    });
    txt.textContent = 'N';
    svg.appendChild(txt);

    // ── Divider line ─────────────────────────────────────────────────
    svg.appendChild(svgEl('line', {
      x1: DIVIDER_X, y1: 10,
      x2: DIVIDER_X, y2: CARD_H - 10,
      stroke: DIVIDER_COLOR,
      'stroke-width': 1
    }));

    // ── Wave bars ────────────────────────────────────────────────────
    var waveW    = WAVE_X1 - WAVE_X0;
    var spacing  = waveW / BAR_COUNT;
    var barsGroup = svgEl('g', { class: 'nxc-bars' });

    for (var j = 0; j < BAR_COUNT; j++) {
      var bh = barHeight(heights[j]);
      var bx = WAVE_X0 + j * spacing + (spacing - BAR_W) / 2;
      var by = WAVE_CY - bh / 2;

      barsGroup.appendChild(svgEl('path', {
        d:    roundedTopRect(bx, by, BAR_W, bh, BAR_R_TOP),
        fill: color,
        opacity: 0.85 + 0.15 * (heights[j] / 7)
      }));
    }
    svg.appendChild(barsGroup);

    // ── Hover animation (CSS injected once) ──────────────────────────
    if (animate) {
      var styleId = 'nxc-wave-style';
      if (!document.getElementById(styleId)) {
        var style = document.createElement('style');
        style.id = styleId;
        style.textContent = [
          '.nxc-wave-svg:hover .nxc-bars path {',
          '  animation: nxcBarPulse 0.9s ease-in-out infinite alternate;',
          '}',
          '@keyframes nxcBarPulse {',
          '  from { opacity: 0.7; transform: scaleY(0.96); transform-origin: center; }',
          '  to   { opacity: 1;   transform: scaleY(1);    transform-origin: center; }',
          '}'
        ].join('\n');
        document.head.appendChild(style);
      }
      svg.classList.add('nxc-wave-svg');
    }

    container.innerHTML = '';
    container.appendChild(svg);
  }

  // ── Download helpers ──────────────────────────────────────────────────

  /**
   * Download the SVG inside `container` as an SVG file.
   * @param {HTMLElement} container
   * @param {string}      [filename]
   */
  function downloadSVG(container, filename) {
    var svg = container && container.querySelector('svg');
    if (!svg) return;
    var serializer = new XMLSerializer();
    var src = '<?xml version="1.0" encoding="utf-8"?>\n' + serializer.serializeToString(svg);
    var blob = new Blob([src], { type: 'image/svg+xml;charset=utf-8' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = filename || 'nexcore-wave-code.svg';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * Download the SVG inside `container` as a PNG (via canvas).
   * @param {HTMLElement} container
   * @param {string}      [filename]
   * @param {number}      [scale=2]   – retina scale factor
   */
  function downloadPNG(container, filename, scale) {
    var svg = container && container.querySelector('svg');
    if (!svg) return;
    scale = scale || 2;
    var serializer = new XMLSerializer();
    var src  = new Blob([serializer.serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' });
    var url  = URL.createObjectURL(src);
    var img  = new Image();
    img.onload = function () {
      var canvas  = document.createElement('canvas');
      canvas.width  = CARD_W * scale;
      canvas.height = CARD_H * scale;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      var a = document.createElement('a');
      a.href     = canvas.toDataURL('image/png');
      a.download = filename || 'nexcore-wave-code.png';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { document.body.removeChild(a); }, 100);
    };
    img.src = url;
  }

  // ── Public API ────────────────────────────────────────────────────────
  global.NexCoreWave = { render: render, downloadSVG: downloadSVG, downloadPNG: downloadPNG };

}(typeof window !== 'undefined' ? window : this));
