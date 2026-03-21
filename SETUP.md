# Supabase / Vercel migration setup (new project)

このアプリは**旧 Supabase を復旧するのではなく、新しい Supabase プロジェクトへ切り替える**前提で整理しています。  
旧プロジェクトが `Services restricted` でも、この手順だけで新環境を再構築できます。

## 1. 影響ファイル一覧

### Supabase / env まわり
- `src/lib/server/env.ts`
- `src/lib/server/supabaseAdmin.ts`
- `src/lib/server/stripe.ts`
- `src/app/api/share/create/route.ts`
- `src/app/api/share/[token]/route.ts`
- `src/app/api/spot/[slug]/route.ts`
- `src/app/api/stripe/checkout-premium/route.ts`
- `src/app/api/stripe/customer-portal/route.ts`
- `src/app/api/stripe/webhook/route.ts`
- `src/lib/supabaseClient.ts`

### 新 Supabase 再構築用の成果物
- `.env.example`
- `supabase/migrations/20260321000000_new_project_bootstrap.sql`
- `SETUP.md`
- `README.md`

## 2. 修正方針

1. **新 Supabase を唯一の接続先にする**  
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` を新プロジェクト値へ差し替える運用に統一。
2. **service role 未設定でも build で落とさない**  
   `SUPABASE_SERVICE_ROLE_KEY` はトップレベルで読まず、`getSupabaseAdmin()` 実行時にだけ確認。
3. **server env の参照を共通化**  
   server-side env は `src/lib/server/env.ts` に集約。
4. **admin client の生成を共通化**  
   service role を使う処理は `src/lib/server/supabaseAdmin.ts` だけを経由。
5. **旧プロジェクトからの live export を前提にしない**  
   コード上で参照しているテーブル・RLS・RPC・Storage を、新プロジェクトへ再構築する SQL を追加。
6. **復旧優先・ただし危険すぎる public 書き込みは整理**  
   公開閲覧は維持しつつ、更新系は原則 `authenticated` + 自分/所属 space/pair ベースで制限。

## 3. 必要 env 一覧

### Supabase（必須）
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Stripe（課金機能を使うなら必須）
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PREMIUM_PRICE_ID`

### URL 系
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SITE_URL`

### Yahoo API（検索機能を使うなら）
- `NEXT_PUBLIC_YAHOO_APPID`
  - 互換のため `YAHOO_API_KEY` / `NEXT_PUBLIC_YAHOO_APP_ID` / `YAHOO_APP_ID` も読めます。

## 4. Vercel でやること

### 4-1. Project Settings → Environment Variables
最低限、以下を **Production / Preview / Development** に入れてください。

#### そのまま入れる値
- `NEXT_PUBLIC_SUPABASE_URL` = `https://fyxppcfffmnhurfdxkwb.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = 新 anon key

#### あとで入れる値
- `SUPABASE_SERVICE_ROLE_KEY` = 新 Supabase の service role key
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PREMIUM_PRICE_ID`

#### URL 系
- `NEXT_PUBLIC_BASE_URL` = 本番URL
- `NEXT_PUBLIC_APP_URL` = 本番URL
- `NEXT_PUBLIC_SITE_URL` = 本番URL

### 4-2. 再デプロイ
環境変数を入れたあと、Vercel で **Redeploy** してください。  
特に `SUPABASE_SERVICE_ROLE_KEY` を追加したあとは、share / spot / stripe webhook 系 API の動作確認のため再デプロイ推奨です。

## 5. Supabase（新アカウント / 新プロジェクト）でやること

### 5-1. 新規プロジェクト作成
Supabase で新規 project を作成し、以下を控えます。
- Project URL
- anon key
- service_role key

### 5-2. SQL Editor で bootstrap SQL を実行
以下のファイルを **丸ごと** SQL Editor に貼って実行してください。

- `supabase/migrations/20260321000000_new_project_bootstrap.sql`

この SQL で以下を作成します。
- テーブル
- index
- RLS
- policy
- `photos` bucket
- pair / public feed 用 RPC
- `profiles` 自動作成 trigger

### 5-3. Authentication の確認
- Email 認証を使うなら **Auth > Providers > Email** を ON
- Site URL を本番 URL に設定
- Redirect URLs に以下を追加
  - `https://<your-domain>/auth/callback`
  - `http://localhost:3000/auth/callback`

### 5-4. Storage の確認
このアプリで必須なのは **`photos` bucket** です。

| Bucket | 用途 | 公開設定 |
| --- | --- | --- |
| `photos` | 投稿写真の保存・表示 | Public |

### 5-5. Stripe を使う場合
Stripe webhook から `profiles` を更新するため、Vercel 側に `SUPABASE_SERVICE_ROLE_KEY` を入れてください。  
未設定だと build は通りますが、以下は runtime で失敗します。
- `/api/share/create`
- `/api/share/[token]`
- `/api/spot/[slug]`
- `/api/stripe/customer-portal`
- `/api/stripe/webhook`

## 6. 必要 SQL 一覧

### 必須
- schema / tables 作成
- indexes 作成
- RLS 有効化
- policies 作成
- `photos` bucket 作成
- storage policies 作成
- profiles 自動同期 trigger
- pair 系 RPC
- public feed RPC

### 今回 SQL に含めたテーブル
- `feedbacks`
- `memories`（互換用。現行 UI では主経路ではない）
- `pair_invites`
- `pair_members`
- `pairs`
- `photos`
- `pilgrimage_missions`
- `pilgrimage_progress`
- `pilgrimage_spots`
- `place_flags`
- `place_reactions`
- `places`
- `post_likes`
- `profiles`
- `purchases`
- `space_members`
- `space_shares`
- `spaces`
- `spot_collection_items`
- `spot_collections`

### 今回あえて再作成していないもの
- `photos_bak`
- `places_bak`

理由: 新規プロジェクト移行ではバックアップテーブルは不要で、移行阻害要因になるため。

## 7. 実際の差分案

### コード
- server env を `src/lib/server/env.ts` に集約
- `SUPABASE_SERVICE_ROLE_KEY` を lazy 読み出しに変更
- admin client を `src/lib/server/supabaseAdmin.ts` に統一
- Stripe secret も runtime 評価に変更
- webhook で env 不足時に build ではなく runtime error になるよう整理

### インフラ資料
- `.env.example` に新 Supabase URL / anon key を反映
- 新 Supabase をゼロから再構築する SQL を追加
- Vercel / Supabase の設定手順を `SETUP.md` に整理

## 8. 動作確認の順番

1. ローカル `.env.local` を `.env.example` ベースで作成
2. `SUPABASE_SERVICE_ROLE_KEY` だけ空のままでも `npx tsc --noEmit` / `npm run build` が通ることを確認
3. 新 Supabase に bootstrap SQL を投入
4. Vercel env を設定
5. service role を設定後に share / spot / stripe 系 API を確認
6. 以下を手動確認
   - ログイン
   - private 投稿作成
   - 写真アップロード
   - 投稿編集 / 削除
   - public 投稿一覧
   - いいね
   - place flags
   - pair 作成 / 参加
   - 巡礼 progress upsert
   - まとめ共有

