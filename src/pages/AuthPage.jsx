import { useState } from 'react';
import { useAuth } from '../components/AuthProvider';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        if (!fullName.trim()) { setError('氏名を入力してください'); setLoading(false); return; }
        await signUp(email, password, fullName);
        setSuccess('確認メールを送信しました。メールを確認してください。（Supabaseの設定でメール確認を無効にしている場合は自動でログインされます）');
      }
    } catch (err) {
      const msg = err.message || 'エラーが発生しました';
      if (msg.includes('Invalid login')) setError('メールアドレスまたはパスワードが正しくありません');
      else if (msg.includes('already registered')) setError('このメールアドレスは既に登録されています');
      else if (msg.includes('Password should be')) setError('パスワードは6文字以上で入力してください');
      else setError(msg);
    }
    setLoading(false);
  };

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-icon">⏱</div>
          <h1 className="auth-title">勤怠管理システム</h1>
          <p className="auth-subtitle">ATTENDANCE MANAGEMENT</p>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">氏名</label>
              <input
                className="form-input"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="山田 太郎"
                required
              />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">メールアドレス</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@company.com"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">パスワード</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="6文字以上"
              required
              minLength={6}
            />
          </div>

          {error && <div className="form-error">{error}</div>}
          {success && <div className="form-success">{success}</div>}

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? '処理中...' : mode === 'login' ? 'ログイン' : 'アカウント登録'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? 'アカウントをお持ちでない方は' : '既にアカウントをお持ちの方は'}
          <button
            className="auth-link"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSuccess(''); }}
          >
            {mode === 'login' ? '新規登録' : 'ログイン'}
          </button>
        </p>
      </div>
    </div>
  );
}
