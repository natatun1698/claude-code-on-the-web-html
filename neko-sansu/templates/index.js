/* テンプレートの登録。追加するときは TEMPLATE_IDS に ID を 1 行足すだけ */
"use strict";
const TEMPLATE_IDS = [
  "gyakusan",
  "noudo",
  "baibai-soneki",
  "tsurukame",
  "ougigata-shasen",
  "ten-idou-graph",
  "tabibito-deau",
];
if (typeof module !== "undefined") {
  module.exports = { TEMPLATE_IDS, TEMPLATES: TEMPLATE_IDS.map(id => require(`./${id}.js`)) };
} else {
  window.TEMPLATE_IDS = TEMPLATE_IDS;
}
