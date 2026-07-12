---
name: chara-maker
description: AIキャラクター作成アプリ「そっくりメーカー」(/chara-maker/)を開発・拡張する。顔パーツ(輪郭・肌・髪・目・眉・鼻・口・耳・服・小物、各50種以上)を組み合わせてSVGアバターを作り、コレクション保存・PNG書き出し・写真からのAIサジェストができる、ログイン不要の静的Webアプリ。「キャラメーカー」「似顔絵アプリ」「アバター作成」「パーツ追加」などの依頼で使用する。
---

# そっくりメーカー 開発スキル

## アプリ概要

- 場所: リポジトリ直下の `chara-maker/`(GitHub Pagesで `/chara-maker/` として公開)
- 構成: `index.html`(骨格) / `style.css`(見た目) / `parts.js`(パーツ定義+SVG描画) / `app.js`(UIロジック)
- 完全静的・ログイン不要・外部通信なし。データはlocalStorage(キー `sokkuri-maker-collection-v1`)

## アーキテクチャの約束事

1. **パーツはパラメトリック生成で50種以上を保証する**
   - 各カテゴリは「形 × サイズ/太さ/色」の直積で配列を生成する
     (例: `EYES = 形8種 × 大きさ7段階 = 56種`)
   - 新しい形を1つ足すと自動的に5〜7種増える。個別に50個手描きしない
2. **描画は `parts.js` の `renderAvatar(state)` に集約**
   - 純関数: state(選択+微調整)→ SVGインナーマークアップ文字列
   - 描画順: 後ろ髪 → 服 → 耳 → 顔 → 眉 → 目 → 鼻 → 口 → 小物 → 前髪 → (帽子/リボン/カチューシャ系小物は前髪より上)
   - キャンバスは viewBox `0 0 320 360`、顔の中心は x=160
3. **state 構造**(`defaultState()` 参照)
   - `sel`: 各カテゴリのインデックス / `tune`: 微調整値(位置・角度・色の濃さ)
   - state形式を変える場合は localStorage の後方互換(古い保存データの読込)を守るか、キーのバージョンを上げる
4. **サムネイル**は「現在のstateに候補パーツを当てた全身描画+カテゴリ別ズーム」
   - ズーム範囲は `parts.js` 末尾の `CATEGORY_ZOOM`(nullはスウォッチ表示)
5. **AIサジェストはブラウザ内完結**(`app.js` の `suggestFromPhoto`)
   - 写真を canvas に縮小 → 肌色っぽい画素/上部の暗い画素の中央値 → 最近傍スウォッチ
   - 写真を外部送信するコードを追加しないこと(プライバシー方針)

## よくある変更のレシピ

- **パーツの形を追加**: `parts.js` の該当 `*_SHAPES` 配列に名前を足し、`renderAvatar` 内の対応する形状分岐(例: `mouthShapes`)に描画を追加。配列は自動で size 倍数分増える
- **カテゴリを追加**: `parts.js` に items 配列と描画、`CATEGORY_ZOOM` にズーム、`app.js` の `CATEGORIES` にエントリ(label/items/hint/sliders)、`defaultState().sel` にキー追加
- **微調整スライダー追加**: `defaultState().tune` にキー → `renderAvatar` で参照 → `CATEGORIES[].sliders` に `{k,label,min,max}` を追加
- **色系カテゴリ**: `swatch: true` を付けると グリッドが色見本表示になる

## 動作確認(必須)

Playwright + 同梱Chromiumで実画面を確認する:

```js
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
// file:///.../chara-maker/index.html を開き、pageerror/console errorがないこと、
// タブ切替・パーツ選択・保存→コレクション表示・PNG書き出しを一通り操作して確認
```

確認観点:
- 前髪・後ろ髪が頭頂部(y≈78)を必ず覆うこと(髪のQ制御点は負のy値にしてある)
- 全カテゴリで `items.length >= 50` を維持
- 保存→リロード→コレクションに残ること
