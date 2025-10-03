```md

\# Travel Memory MVP





二人でも一人でも、行った場所にピン→写真複数＋メモを残す。将来 “巡礼/100選パック” を拡張可能な基盤。





\## セットアップ

1\. `pnpm i` または `npm i`

2\. Supabase プロジェクト作成 → `.env` 設定

3\. Supabase SQL エディタで `supabase/migrations/001\_init.sql` と `supabase/storage\_policies.sql` を順に実行

4\. Supabase Storage に `memories` バケットを \*\*手動作成\*\*（パブリックはOFFのままでOK）

5\. `npm run dev`





\## デプロイ

\- GitHub 連携 → Vercel。環境変数（`.env` と同じキー）を \*\*Preview/Production\*\* 両方に設定。

```

