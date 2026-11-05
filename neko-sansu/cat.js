/* スコティッシュフォールドのインラインSVG。renderCat(mood) → SVG文字列。mood: idle/think/happy/cheer/sleep */
"use strict";
function renderCat(mood = "idle") {
  const eyes = {
    idle: `<ellipse cx="78" cy="96" rx="7" ry="9" fill="#3b2f2f"/><ellipse cx="122" cy="96" rx="7" ry="9" fill="#3b2f2f"/><circle cx="81" cy="93" r="2.5" fill="#fff"/><circle cx="125" cy="93" r="2.5" fill="#fff"/>`,
    think: `<ellipse cx="78" cy="96" rx="7" ry="9" fill="#3b2f2f"/><ellipse cx="122" cy="96" rx="7" ry="9" fill="#3b2f2f"/><circle cx="83" cy="93" r="2.5" fill="#fff"/><circle cx="127" cy="93" r="2.5" fill="#fff"/><path d="M66 82 q12 -6 24 0" stroke="#3b2f2f" stroke-width="2.5" fill="none"/>`,
    happy: `<path d="M70 98 q8 -10 16 0" stroke="#3b2f2f" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M114 98 q8 -10 16 0" stroke="#3b2f2f" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    cheer: `<ellipse cx="78" cy="96" rx="8" ry="10" fill="#3b2f2f"/><ellipse cx="122" cy="96" rx="8" ry="10" fill="#3b2f2f"/><circle cx="81" cy="92" r="3" fill="#fff"/><circle cx="125" cy="92" r="3" fill="#fff"/>`,
    sleep: `<path d="M70 97 q8 6 16 0" stroke="#3b2f2f" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M114 97 q8 6 16 0" stroke="#3b2f2f" stroke-width="3" fill="none" stroke-linecap="round"/><text x="150" y="60" font-size="18" fill="#8aa">z</text><text x="162" y="44" font-size="22" fill="#8aa">Z</text>`,
  }[mood] || "";
  const mouth = mood === "happy" || mood === "cheer"
    ? `<path d="M90 114 q10 12 20 0" stroke="#c0606f" stroke-width="2.5" fill="#f4a3b0"/>`
    : `<path d="M92 113 q8 6 16 0" stroke="#c0606f" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  return `<svg class="cat-svg" viewBox="0 0 200 210" aria-hidden="true" data-mood="${mood}">
  <ellipse cx="100" cy="200" rx="60" ry="8" fill="rgba(0,0,0,.08)"/>
  <ellipse class="tail" cx="152" cy="168" rx="26" ry="11" fill="#b9b6c9" transform="rotate(-25 152 168)"/>
  <ellipse cx="100" cy="160" rx="54" ry="42" fill="#d9d6e6"/>
  <ellipse cx="100" cy="170" rx="34" ry="26" fill="#f6f3fb"/>
  <ellipse cx="72" cy="196" rx="14" ry="8" fill="#d9d6e6"/><ellipse cx="128" cy="196" rx="14" ry="8" fill="#d9d6e6"/>
  <circle cx="100" cy="92" r="52" fill="#d9d6e6"/>
  <!-- おれ耳(スコティッシュフォールドの とくちょう) -->
  <path d="M54 62 q2 -24 18 -26 q10 6 20 18 q-18 6 -38 8z" fill="#c9c5db"/><path d="M60 58 q4 -14 12 -16 q6 4 12 12 q-12 3 -24 4z" fill="#f4b6c2"/>
  <path d="M146 62 q-2 -24 -18 -26 q-10 6 -20 18 q18 6 38 8z" fill="#c9c5db"/><path d="M140 58 q-4 -14 -12 -16 q-6 4 -12 12 q12 3 24 4z" fill="#f4b6c2"/>
  <!-- もよう -->
  <path d="M80 48 q20 -10 40 0 q-6 -16 -20 -18 q-14 2 -20 18z" fill="#c9c5db"/>
  <ellipse cx="100" cy="112" rx="26" ry="18" fill="#f6f3fb"/>
  <circle cx="74" cy="110" r="9" fill="#f9c6cf" opacity=".7"/><circle cx="126" cy="110" r="9" fill="#f9c6cf" opacity=".7"/>
  ${eyes}
  <path d="M96 104 q4 -3 8 0 q-2 5 -4 5 q-2 0 -4 -5z" fill="#e58a9b"/>
  ${mouth}
  <g stroke="#9a94b0" stroke-width="1.5"><line x1="40" y1="104" x2="66" y2="107"/><line x1="40" y1="114" x2="66" y2="112"/><line x1="160" y1="104" x2="134" y2="107"/><line x1="160" y1="114" x2="134" y2="112"/></g>
  <path d="M86 140 q14 -8 28 0" stroke="#f08aa0" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="100" cy="140" r="5" fill="#f4b6c2"/>
</svg>`;
}
if (typeof module !== "undefined") module.exports = { renderCat }; else window.renderCat = renderCat;
