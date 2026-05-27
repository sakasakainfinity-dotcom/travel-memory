# Travel Memory / PhotoMapper

新しい Supabase プロジェクトへの移行前提で、接続先・SQL・Vercel 設定を整理したリポジトリです。

## セットアップの入口

詳細は `SETUP.md` を参照してください。

- 新 Supabase の初期化
- Vercel に入れる env 一覧
- `photos` bucket 作成方針
- Stripe / share API の注意点
- build crash を避けるための env 方針

## クイックスタート

1. `npm install`
2. `.env.example` を元に `.env.local` を作成
3. Supabase SQL Editor で `supabase/migrations/20260321000000_new_project_bootstrap.sql` を実行
4. `npx tsc --noEmit`
5. `npm run build`
6. `npm run dev`

## 補足

- `SUPABASE_SERVICE_ROLE_KEY` は **build 時必須ではありません**。  
  ただし share / spot / stripe webhook 系 API を実際に使う時点では必要です。
- 旧 Supabase の `photos_bak` / `places_bak` は、新規プロジェクト移行では再作成していません。
