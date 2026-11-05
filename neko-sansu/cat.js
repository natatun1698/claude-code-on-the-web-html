/* スコティッシュフォールドのインラインSVG。renderCat(mood) → SVG文字列。mood: idle/think/happy/cheer/sleep
   クリーム色×キャラメルのしま、まんまる顔、前に おれた耳。画像ファイルは使わない */
"use strict";
function renderCat(mood = "idle") {
  const ink = "#4a3a36";
  const eyes = {
    idle: `<ellipse cx="78" cy="98" rx="8" ry="10" fill="${ink}"/><ellipse cx="122" cy="98" rx="8" ry="10" fill="${ink}"/><circle cx="81" cy="94" r="3" fill="#fff"/><circle cx="125" cy="94" r="3" fill="#fff"/>`,
    think: `<ellipse cx="78" cy="98" rx="8" ry="10" fill="${ink}"/><ellipse cx="122" cy="98" rx="8" ry="10" fill="${ink}"/><circle cx="84" cy="95" r="3" fill="#fff"/><circle cx="128" cy="95" r="3" fill="#fff"/><path d="M66 84 q12 -6 24 0" stroke="${ink}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    happy: `<path d="M69 100 q9 -11 18 0" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M113 100 q9 -11 18 0" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    cheer: `<ellipse cx="78" cy="98" rx="9" ry="11" fill="${ink}"/><ellipse cx="122" cy="98" rx="9" ry="11" fill="${ink}"/><circle cx="81" cy="93" r="3.5" fill="#fff"/><circle cx="125" cy="93" r="3.5" fill="#fff"/><circle cx="76" cy="102" r="1.5" fill="#fff"/><circle cx="120" cy="102" r="1.5" fill="#fff"/>`,
    sleep: `<path d="M69 99 q9 7 18 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M113 99 q9 7 18 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/><text x="152" y="62" font-size="18" fill="#9bb" font-weight="700">z</text><text x="165" y="46" font-size="24" fill="#9bb" font-weight="700">Z</text>`,
  }[mood] || "";
  const mouth = mood === "happy" || mood === "cheer"
    ? `<path d="M90 116 q10 13 20 0" stroke="#c96a70" stroke-width="2.5" fill="#f4a3b0"/>`
    : `<path d="M92 114 q4 5 8 0 q4 5 8 0" stroke="#c96a70" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  return `<svg class="cat-svg" viewBox="0 0 200 210" aria-hidden="true" data-mood="${mood}">
  <ellipse cx="100" cy="201" rx="62" ry="7" fill="rgba(0,0,0,.08)"/>
  <path class="tail" d="M150 172 q30 -4 34 -30 q2 -12 -8 -14 q-8 2 -6 12 q2 14 -22 18z" fill="#e2b07a"/>
  <ellipse cx="100" cy="162" rx="56" ry="42" fill="#f7e3c3"/>
  <ellipse cx="100" cy="172" rx="36" ry="26" fill="#fff8ee"/>
  <ellipse cx="70" cy="198" rx="15" ry="8" fill="#f7e3c3"/><ellipse cx="130" cy="198" rx="15" ry="8" fill="#f7e3c3"/>
  <circle cx="100" cy="94" r="54" fill="#f7e3c3"/>
  <!-- おれ耳(スコティッシュフォールドの とくちょう): 前に ぱたんと たおれている -->
  <path d="M52 66 q-2 -22 12 -30 q14 6 26 18 q-14 10 -38 12z" fill="#e2b07a"/><path d="M58 62 q2 -12 10 -18 q8 5 14 12 q-10 5 -24 6z" fill="#f6b8bf"/>
  <path d="M148 66 q2 -22 -12 -30 q-14 6 -26 18 q14 10 38 12z" fill="#e2b07a"/><path d="M142 62 q-2 -12 -10 -18 q-8 5 -14 12 q10 5 24 6z" fill="#f6b8bf"/>
  <!-- ひたいの しま -->
  <path d="M86 50 q4 14 0 24 M100 46 q3 14 0 28 M114 50 q-4 14 0 24" stroke="#e2b07a" stroke-width="5" fill="none" stroke-linecap="round"/>
  <ellipse cx="100" cy="114" rx="27" ry="19" fill="#fff8ee"/>
  <circle cx="72" cy="112" r="9" fill="#f9c3c8" opacity=".75"/><circle cx="128" cy="112" r="9" fill="#f9c3c8" opacity=".75"/>
  ${eyes}
  <path d="M96 106 q4 -3 8 0 q-2 5 -4 5 q-2 0 -4 -5z" fill="#e58a9b"/>
  ${mouth}
  <g stroke="#b9977a" stroke-width="1.5" stroke-linecap="round"><line x1="38" y1="106" x2="64" y2="109"/><line x1="38" y1="116" x2="64" y2="114"/><line x1="162" y1="106" x2="136" y2="109"/><line x1="162" y1="116" x2="136" y2="114"/></g>
  <path d="M84 142 q16 -9 32 0" stroke="#7fbfb0" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="100" cy="143" r="5.5" fill="#ffd36b"/>
</svg>`;
}
if (typeof module !== "undefined") module.exports = { renderCat }; else window.renderCat = renderCat;
