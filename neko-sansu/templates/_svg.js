/* 図のための小さなSVGヘルパー。色は CSS 変数で決める */
"use strict";
const SVG = {
  svg(inner, w = 320, h = 220) { return `<svg viewBox="0 0 ${w} ${h}" width="100%" class="fig" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--fig-hatch,#f08aa0)" stroke-width="2"/></pattern></defs>${inner}</svg>`; },
  line(x1, y1, x2, y2, cls = "edge") { return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}"/>`; },
  rect(x, y, w, h, cls = "edge") { return `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${cls}"/>`; },
  text(x, y, str, cls = "lbl") { return `<text x="${x}" y="${y}" class="${cls}" text-anchor="middle">${str}</text>`; },
  circle(cx, cy, r, cls = "edge") { return `<circle cx="${cx}" cy="${cy}" r="${r}" class="${cls}"/>`; },
  arcPath(cx, cy, r, a0, a1) { const p = a => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); const large = (a1 - a0) % 360 > 180 ? 1 : 0; return `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z`; },
  path(d, cls = "edge") { return `<path d="${d}" class="${cls}"/>`; },
  hatch(d) { return `<path d="${d}" class="shade"/>`; },
  polyline(pts, cls = "graph") { return `<polyline points="${pts.map(p => p.join(",")).join(" ")}" class="${cls}" fill="none"/>`; },
};
if (typeof module !== "undefined") module.exports = SVG; else window.SVG = SVG;
