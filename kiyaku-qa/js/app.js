/* =========================================================
 * app.js — 規約Q&Aチャットボット(完全クライアントサイド)
 * kiyaku-data.js(恒常ルール層)+ sokuho-data.js(回答速報層)を
 * キーワードスコアリングで検索し、根拠条文つきで回答する。
 * ========================================================= */

(function () {
  "use strict";

  const chatLog = document.getElementById("chat-log");
  const input = document.getElementById("chat-input");
  const btnSend = document.getElementById("btn-send");
  const chipsBox = document.getElementById("quick-chips");

  /* ---------- 正規化(カタカナ→ひらがな、全角→半角、小文字化) ---------- */
  function normalize(s) {
    return (s || "")
      .toLowerCase()
      .replace(/[ァ-ヶ]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0x60))
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0xfee0))
      .replace(/[\s、。・,\.\?？!！「」『』()（）]/g, "");
  }

  /* ---------- 検索エンジン ---------- */
  function allEntries() {
    // 回答速報(新しい順)を先、恒常ルールを後に
    const sokuho = (typeof SOKUHO_ENTRIES !== "undefined" ? SOKUHO_ENTRIES : [])
      .slice()
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return { sokuho, base: KIYAKU_ENTRIES };
  }

  function scoreEntry(entry, nq, rawQ) {
    let score = 0;
    for (const kw of entry.keywords) {
      const nkw = normalize(kw);
      if (!nkw) continue;
      if (nq.includes(nkw)) {
        // 長いキーワードほど高得点(specificity)
        score += 10 + nkw.length * 2;
      }
    }
    // 質問文そのものとの部分一致(補助)
    const nqTitle = normalize(entry.q);
    if (nqTitle && nq.length >= 4) {
      let common = 0;
      for (let i = 0; i <= nq.length - 2; i++) {
        if (nqTitle.includes(nq.substr(i, 2))) common++;
      }
      score += Math.min(common, 8);
    }
    return score;
  }

  function search(query) {
    const nq = normalize(query);
    if (!nq) return { hits: [], sokuhoHits: [] };
    const { sokuho, base } = allEntries();
    const rank = (list) =>
      list
        .map((e) => ({ e, s: scoreEntry(e, nq, query) }))
        .filter((x) => x.s >= 12)
        .sort((a, b) => b.s - a.s);
    return { sokuhoHits: rank(sokuho), hits: rank(base) };
  }

  /* ---------- 表示 ---------- */
  const VERDICT_LABEL = {
    ok: ["提供可", "v-ok"],
    ng: ["原則不可", "v-ng"],
    cond: ["条件付き可", "v-cond"],
    info: ["解説", "v-info"],
  };

  function el(tag, cls, text) {
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    if (text != null) d.textContent = text;
    return d;
  }

  function addUserMsg(text) {
    const m = el("div", "msg user");
    m.appendChild(el("div", "bubble", text));
    chatLog.appendChild(m);
    scrollBottom();
  }

  function entryCard(entry, isSokuho) {
    const card = el("div", "answer-card" + (isSokuho ? " sokuho" : ""));
    const head = el("div", "answer-head");
    const [label, vcls] = VERDICT_LABEL[entry.verdict] || VERDICT_LABEL.info;
    head.appendChild(el("span", "verdict " + vcls, label));
    head.appendChild(el("span", "cat-tag", isSokuho ? "回答速報" : entry.cat));
    if (isSokuho && entry.date) head.appendChild(el("span", "date-tag", entry.date));
    card.appendChild(head);
    card.appendChild(el("p", "answer-body", entry.a));
    if (entry.refs && entry.refs.length) {
      const refs = el("div", "refs");
      refs.appendChild(el("span", "refs-label", "根拠: "));
      refs.appendChild(el("span", null, entry.refs.join(" / ")));
      card.appendChild(refs);
    }
    return card;
  }

  function addBotAnswer(query) {
    const { sokuhoHits, hits } = search(query);
    const m = el("div", "msg bot");
    const b = el("div", "bubble");

    if (!sokuhoHits.length && !hits.length) {
      b.appendChild(
        el(
          "p",
          "answer-body",
          "申し訳ありません。ご質問に対応する項目を本資料(公正競争規約・運用基準解説集等)から見つけられませんでした。" +
            "言い回しを変えて(例:「貸出し」「立会い」「寄付」「飲食」などのキーワードで)もう一度お試しください。" +
            "本資料に記載のない事案や解釈が分かれ得る事案については、医療機器業公正取引協議会(事前相談窓口: 各支部運営委員会事務局)へご確認ください。"
        )
      );
    } else {
      // 回答速報が該当すれば最優先で表示
      sokuhoHits.slice(0, 2).forEach((h) => b.appendChild(entryCard(h.e, true)));
      hits.slice(0, 2).forEach((h) => b.appendChild(entryCard(h.e, false)));

      // 関連質問
      const rel = hits.slice(2, 5);
      if (rel.length) {
        const relBox = el("div", "related");
        relBox.appendChild(el("div", "related-label", "関連する質問:"));
        rel.forEach((h) => {
          const btn = el("button", "chip chip-small", h.e.q);
          btn.addEventListener("click", () => ask(h.e.q));
          relBox.appendChild(btn);
        });
        b.appendChild(relBox);
      }
      b.appendChild(
        el(
          "p",
          "disclaimer-inline",
          "※本回答は参考情報です。個別事案の最終判断は医療機器業公正取引協議会にご確認ください。"
        )
      );
    }
    m.appendChild(b);
    chatLog.appendChild(m);
    scrollBottom();
  }

  function scrollBottom() {
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  /* ---------- 質問処理 ---------- */
  function ask(text) {
    const q = (text || "").trim();
    if (!q) return;
    addUserMsg(q);
    input.value = "";
    // 少し間を置いて回答(体感向上)
    setTimeout(() => addBotAnswer(q), 250);
  }

  btnSend.addEventListener("click", () => ask(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      ask(input.value);
    }
  });

  /* ---------- 初期表示 ---------- */
  function welcome() {
    const m = el("div", "msg bot");
    const b = el("div", "bubble");
    b.appendChild(
      el(
        "p",
        "answer-body",
        "こんにちは。医療機器業公正競争規約Q&Aです。贈答品・接待・貸出し・立会い・サンプル提供・寄付などが規約上問題ないか、根拠条文つきでお答えします。質問を入力するか、下の例をタップしてください。"
      )
    );
    const meta = el("p", "meta-note",
      "知識ベース: " + KIYAKU_META.sources.join(" / ") +
      (typeof SOKUHO_ENTRIES !== "undefined" && SOKUHO_ENTRIES.length
        ? " + 回答速報 " + SOKUHO_ENTRIES.length + "件"
        : ""));
    b.appendChild(meta);
    m.appendChild(b);
    chatLog.appendChild(m);
  }

  QUICK_QUESTIONS.forEach((q) => {
    const c = el("button", "chip", q);
    c.addEventListener("click", () => ask(q));
    chipsBox.appendChild(c);
  });

  welcome();
})();
