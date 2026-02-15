# 勤怠管理システム - Attendance Management System

Supabase + React (Vite) で構築された本格的な勤怠管理Webアプリケーション。

## 機能一覧

- **ユーザー認証**: メールアドレス・パスワード・氏名での登録/ログイン
- **勤怠入力**: 月別カレンダー形式で日別の勤務時間・内容・交通費を入力
- **10分刻み**: 開始/終了/控除時間は10分単位で選択
- **自動入力**: 土日祝日以外はデフォルト値が自動反映
- **祝日対応**: 日本の祝日(2025-2026年)を自動判定
- **申請フロー**: 下書き → 申請済 → 承認済/差戻し
- **月別データ蓄積**: 過去データの閲覧・編集が可能
- **管理者機能**: 全ユーザーの申請確認・承認・差戻し
- **PDF印刷**: 勤怠報告書をA4横でPDF印刷
- **リアルタイム保存**: 入力内容はデバウンスでSupabaseに自動保存

---

## セットアップ手順

### STEP 1: Supabase プロジェクト作成

1. [https://supabase.com](https://supabase.com) にアクセスし、アカウント作成
2. 「New Project」でプロジェクトを作成
   - Project name: `attendance-management`（任意）
   - Database Password: 安全なパスワードを設定（控えておく）
   - Region: `Northeast Asia (Tokyo)` を推奨
3. プロジェクト作成完了まで数分待つ

### STEP 2: データベーステーブル作成

1. Supabaseダッシュボードの左メニューから **SQL Editor** を開く
2. 「New query」をクリック
3. `supabase/schema.sql` ファイルの **内容をすべて** コピーして貼り付け
4. 「Run」ボタンをクリックして実行
5. 「Success」と表示されればOK

> ⚠️ エラーが出た場合は、Table Editor で既存テーブルがないか確認してください。
> 初回実行であればエラーは出ないはずです。

### STEP 3: Supabase 認証設定

1. 左メニューの **Authentication** → **Providers** を開く
2. **Email** が有効になっていることを確認

**（推奨）メール確認を無効化する場合:**

1. Authentication → **Settings** を開く
2. 「Confirm email」を **OFF** にする（開発時に便利）

> 本番環境ではONにすることを推奨します。

### STEP 4: API キー取得

1. 左メニューの **Settings** → **API** を開く
2. 以下の2つの値をメモ:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon / public** キー: `eyJhbGci...` で始まる長い文字列

### STEP 5: ローカル環境セットアップ

```bash
# 1. プロジェクトフォルダに移動
cd attendance-app

# 2. 環境変数ファイルを作成
cp .env.example .env

# 3. .env を編集して Supabase の値を設定
#    VITE_SUPABASE_URL=https://xxxxx.supabase.co
#    VITE_SUPABASE_ANON_KEY=eyJhbGci...

# 4. 依存パッケージのインストール
npm install

# 5. 開発サーバー起動
npm run dev
```

ブラウザで `http://localhost:5173` が自動で開きます。

### STEP 6: 管理者アカウント作成

1. アプリの「新規登録」画面を開く
2. 以下の情報で登録:
   - メールアドレス: `admin@example.com`
   - パスワード: 任意（6文字以上）
   - 氏名: 管理者の名前
3. schema.sql のトリガーにより、`admin@example.com` は自動的に管理者権限が付与されます

> **管理者メールアドレスを変更したい場合:**
> `supabase/schema.sql` の `handle_new_user` 関数内の
> `CASE WHEN NEW.email = 'admin@example.com'` の部分を変更してください。

---

## 本番デプロイ

### Vercel にデプロイする場合

```bash
# 1. Vercel CLI をインストール
npm i -g vercel

# 2. デプロイ
vercel

# 3. 環境変数を設定（Vercel ダッシュボードまたは CLI で）
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY

# 4. 再デプロイ
vercel --prod
```

### Netlify にデプロイする場合

```bash
# 1. ビルド
npm run build

# 2. dist フォルダを Netlify にドラッグ&ドロップ
#    または Netlify CLI を使用

# 3. Site settings → Environment variables で
#    VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を追加
```

---

## プロジェクト構成

```
attendance-app/
├── index.html              # エントリHTML
├── package.json            # 依存パッケージ定義
├── vite.config.js          # Vite設定
├── .env.example            # 環境変数テンプレート
├── .gitignore
├── supabase/
│   └── schema.sql          # DBスキーマ（SQL Editor に貼り付け）
└── src/
    ├── main.jsx            # アプリエントリポイント
    ├── App.jsx             # ルーティング・レイアウト
    ├── index.css           # グローバルスタイル
    ├── components/
    │   ├── AuthProvider.jsx  # 認証コンテキスト
    │   └── AttendanceTable.jsx # 勤怠テーブルコンポーネント
    ├── lib/
    │   ├── supabase.js     # Supabaseクライアント
    │   ├── utils.js        # ユーティリティ関数
    │   └── pdf.js          # PDF生成
    └── pages/
        ├── AuthPage.jsx    # ログイン/登録画面
        ├── AttendancePage.jsx # 勤怠入力画面
        ├── SettingsPage.jsx   # デフォルト設定画面
        ├── MonthsPage.jsx     # 月別一覧画面
        └── AdminPage.jsx      # 管理者画面
```

## DB テーブル構成

| テーブル | 説明 |
|---------|------|
| `profiles` | ユーザー情報（氏名・メール・ロール） |
| `default_settings` | デフォルト勤務設定（開始/終了時間等） |
| `monthly_reports` | 月次レポートのメタ情報とステータス |
| `attendance_rows` | 日別の勤怠データ（各レポートに紐づく） |

すべてのテーブルに **Row Level Security (RLS)** が設定されており、
一般ユーザーは自分のデータのみ、管理者は全データにアクセスできます。

---

## トラブルシューティング

### 「ログインできない」
- Supabase ダッシュボードの Authentication → Settings で「Confirm email」がOFFになっているか確認
- ONの場合はメール確認が必要です

### 「データが保存されない」
- ブラウザの開発者ツール（F12）→ Console でエラーを確認
- `.env` ファイルの SUPABASE_URL と ANON_KEY が正しいか確認
- Supabase ダッシュボードの Table Editor でテーブルが作成されているか確認

### 「管理者画面が表示されない」
- `admin@example.com` でログインしているか確認
- `profiles` テーブルで該当ユーザーの `role` が `admin` になっているか確認
- 手動変更: Supabase Table Editor → profiles → role列を `admin` に変更

### 「PDF印刷が動かない」
- ポップアップブロッカーを無効にしてください
- 新しいウィンドウで印刷ダイアログが開きます
