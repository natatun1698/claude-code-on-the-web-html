# claude-code-on-the-web-html

## Slackリアクション分析ダッシュボード

`.claude/skills/slack-reaction-dashboard/` にスキルがあります。
「Slackのリアクション分析をして」と依頼すると、過去30日分のリアクションを分析した
Excelダッシュボード(グラフ8点)とNotion掲載用エクスポートを生成します。
使い方の詳細は [SKILL.md](.claude/skills/slack-reaction-dashboard/SKILL.md) を、
出力サンプルは [examples/demo_output/](examples/demo_output/) を参照してください。

実データの取得には、リポジトリのActions secretsに `SLACK_TOKEN` の登録が必要です
(`.github/workflows/slack-fetch.yml` 参照)。
