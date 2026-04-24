(function (global) {
  'use strict';
  var CARD_W = 300, CARD_H = 88, CARD_R = 14;
  var LOGO_CX = 36, LOGO_CY = CARD_H / 2, LOGO_R = 22;
  var DIV_X = 66;
  var ZONE_X0 = 76, ZONE_X1 = CARD_W - 8, ZONE_Y0 = 8, ZONE_Y1 = CARD_H - 8;
  var ZONE_W = ZONE_X1 - ZONE_X0, ZONE_H = ZONE_Y1 - ZONE_Y0;
  var STAR_COUNT = 16, CONN_DIST = 68;
  var DEFAULT_COLOR = '#6ee7f3', BG_COLOR = '#090d1a';
  var DIVIDER_COLOR = 'rgba(110,231,243,0.18)', LOGO_RING = 'rgba(110,231,243,0.28)';

  function svgEl(tag, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) el.setAttribute(k, attrs[k]);
    }
    return el;
  }

  function dist2(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function render(container, codeBytes, opts) {
    if (!container) return;
    if (!Array.isArray(codeBytes) || codeBytes.length < 32) return;
    opts = opts || {};
    var color = opts.color || DEFAULT_COLOR;
    var stars = [];
    for (var i = 0; i < STAR_COUNT; i++) {
      var bx = codeBytes[i], by = codeBytes[i + 16];
      stars.push({
        x: ZONE_X0 + (bx / 255) * ZONE_W,
        y: ZONE_Y0 + (by / 255) * ZONE_H,
        r: 1.2 + ((bx ^ by) % 4) * 0.55,
        op: 0.40 + (by / 255) * 0.60
      });
    }
    var svg = svgEl('svg', {
      viewBox: '0 0 ' + CARD_W + ' ' + CARD_H,
      width: CARD_W, height: CARD_H,
      xmlns: 'http://www.w3.org/2000/svg',
      role: 'img',
      'aria-label': 'NexCore project constellation code'
    });
    svg.appendChild(svgEl('rect', { x: 0, y: 0, width: CARD_W, height: CARD_H, rx: CARD_R, ry: CARD_R, fill: BG_COLOR }));
    var dustSeeds = [17, 53, 89, 131, 167, 211, 241, 29, 73];
    dustSeeds.forEach(function (s) {
      svg.appendChild(svgEl('circle', {
        cx: ZONE_X0 + (s * 23 % Math.round(ZONE_W)),
        cy: ZONE_Y0 + (s * 11 % Math.round(ZONE_H)),
        r: 0.55, fill: color, opacity: 0.16
      }));
    });
    var linesG = svgEl('g', { 'class': 'nxc-lines' });
    for (var a = 0; a < stars.length; a++) {
      for (var b = a + 1; b < stars.length; b++) {
        var d = dist2(stars[a], stars[b]);
        if (d < CONN_DIST) {
          var lineOp = ((1 - d / CONN_DIST) * 0.28).toFixed(3);
          linesG.appendChild(svgEl('line', {
            x1: stars[a].x.toFixed(2), y1: stars[a].y.toFixed(2),
            x2: stars[b].x.toFixed(2), y2: stars[b].y.toFixed(2),
            stroke: color, 'stroke-width': 0.55, opacity: lineOp
          }));
        }
      }
    }
    svg.appendChild(linesG);
    var starsG = svgEl('g', { 'class': 'nxc-stars' });
    stars.forEach(function (s) {
      if (s.op > 0.72) {
        starsG.appendChild(svgEl('circle', { cx: s.x.toFixed(2), cy: s.y.toFixed(2), r: (s.r * 2.8).toFixed(2), fill: color, opacity: (s.op * 0.13).toFixed(3) }));
      }
      starsG.appendChild(svgEl('circle', { cx: s.x.toFixed(2), cy: s.y.toFixed(2), r: s.r.toFixed(2), fill: color, opacity: s.op.toFixed(3) }));
    });
    svg.appendChild(starsG);
    svg.appendChild(svgEl('line', { x1: DIV_X, y1: 10, x2: DIV_X, y2: CARD_H - 10, stroke: DIVIDER_COLOR, 'stroke-width': 1 }));
    svg.appendChild(svgEl('circle', { cx: LOGO_CX, cy: LOGO_CY, r: LOGO_R, fill: 'none', stroke: LOGO_RING, 'stroke-width': 1.5 }));
    svg.appendChild(svgEl('circle', { cx: LOGO_CX, cy: LOGO_CY, r: LOGO_R - 5, fill: 'rgba(110,231,243,0.09)' }));
    var txt = svgEl('text', { x: LOGO_CX, y: LOGO_CY + 5, 'text-anchor': 'middle', 'font-family': 'Inter, Arial, sans-serif', 'font-size': '14', 'font-weight': '800', fill: color, 'letter-spacing': '-0.5' });
    txt.textContent = 'N';
    svg.appendChild(txt);
    if (opts.animate !== false) {
      var styleId = 'nxc-constellation-style';
      var existing = document.getElementById(styleId);
      if (!existing) {
        var style = document.createElement('style');
        style.id = styleId;
        style.textContent = '.nxc-constellation:hover .nxc-stars circle { animation: nxcStarPulse 1.6s ease-in-out infinite alternate; }' +
          '@keyframes nxcStarPulse { from { opacity: 0.7; } to { opacity: 1; } }';
        document.head.appendChild(style);
      }
      svg.classList.add('nxc-constellation');
    }
    container.innerHTML = '';
    container.appendChild(svg);
  }

  function downloadSVG(container, filename) {
    var svg = container && container.querySelector('svg');
    if (!svg) return;
    var src = new XMLSerializer().serializeToString(svg);
    var blob = new Blob([src], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename || 'nexcore-code.svg';
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  function downloadPNG(container, filename, scale) {
    var svg = container && container.querySelector('svg');
    if (!svg) return;
    scale = scale || 3;
    var blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = CARD_W * scale; canvas.height = CARD_H * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      var a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = filename || 'nexcore-code.png';
      document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); }, 100);
    };
    img.src = url;
  }

  global.NexCoreWave = { render: render, downloadSVG: downloadSVG, downloadPNG: downloadPNG };

}(typeof window !== 'undefined' ? window : this));