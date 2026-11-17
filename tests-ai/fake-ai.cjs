/* =========================================================
 * fake-ai.cjs — Workers AI の偽物(テスト用・ネットワーク不要)
 * Worker が組み立てたシステムプロンプトを読み、指示どおりの文面を返す。
 * 本物のモデルの品質は確かめられない。確かめるのは配線と約束ごと。
 * ========================================================= */
function makeFakeAI(behavior = "ok") {
  const calls = [];
  const ai = {
    calls,
    behavior,
    async run(model, input) {
      calls.push({ model, input });
      if (ai.behavior === "limit") throw new Error("3036: you have used up your daily free allocation of 10,000 neurons");
      if (ai.behavior === "error") throw new Error("5000: internal error");
      if (ai.behavior === "empty") return { response: "" };
      if (ai.behavior === "named") return { response: "高橋：「価格を教えてください。」" };
      const sys = input.messages[0].content;
      let text;
      const term = sys.match(/知らない言葉「([^」]+)」を使いました/);
      const gist = sys.match(/趣旨: 「([\s\S]+?)」(\s|$)/);
      if (term) text = `「${term[1]}」とは何ですか。患者さんにとって何が嬉しいのか教えてください。`;
      else if (/値引きを口にしました/.test(sys)) text = "他社はもっと下げてくれるそうですよ。それなら他社にしますね。";
      else if (gist) text = gist[1];
      else text = "なるほど。";
      const ack = sys.match(/冒頭は、必ず「([^」]+)」で始めて/);
      if (ack) text = ack[1] + " " + text;
      return { response: text };
    },
  };
  return ai;
}
module.exports = { makeFakeAI };
