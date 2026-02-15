import { useState } from 'react';
import { useAuth } from '../components/AuthProvider';

export default function AuthPage() {
  var auth = useAuth();
  var _m = useState('login'), mode = _m[0], setMode = _m[1];
  var _e = useState(''), email = _e[0], setEmail = _e[1];
  var _pw = useState(''), password = _pw[0], setPassword = _pw[1];
  var _fn = useState(''), fullName = _fn[0], setFullName = _fn[1];
  var _err = useState(''), error = _err[0], setError = _err[1];
  var _ld = useState(false), busy = _ld[0], setBusy = _ld[1];
  var _sc = useState(''), success = _sc[0], setSuccess = _sc[1];

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);

    if (mode === 'login') {
      auth.signIn(email, password)
        .catch(function(err) {
          var msg = err.message || 'エラーが発生しました';
          if (msg.includes('Invalid login')) setError('メールアドレスまたはパスワードが正しくありません');
          else if (msg.includes('Email not confirmed')) setError('メール認証が完了していません。メール内のリンクをクリックしてください。');
          else setError(msg);
        })
        .finally(function() { setBusy(false); });
    } else {
      if (!fullName.trim()) { setError('氏名を入力してください'); setBusy(false); return; }
      auth.signUp(email, password, fullName)
        .then(function() {
          setSuccess('確認メールを送信しました。メール内のリンクをクリックして認証を完了してください。');
        })
        .catch(function(err) {
          var msg = err.message || 'エラーが発生しました';
          if (msg.includes('already registered')) setError('このメールアドレスは既に登録されています');
          else if (msg.includes('Password should be')) setError('パスワードは6文字以上で入力してください');
          else setError(msg);
        })
        .finally(function() { setBusy(false); });
    }
  }

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
              <input className="form-input" value={fullName} onChange={function(e) { setFullName(e.target.value); }} placeholder="山田 太郎" required />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">メールアドレス</label>
            <input className="form-input" type="email" value={email} onChange={function(e) { setEmail(e.target.value); }} placeholder="example@company.com" required />
          </div>
          <div className="form-group">
            <label className="form-label">パスワード</label>
            <input className="form-input" type="password" value={password} onChange={function(e) { setPassword(e.target.value); }} placeholder="6文字以上" required minLength={6} />
          </div>
          {error && <div className="form-error">{error}</div>}
          {success && <div className="form-success">{success}</div>}
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? '処理中...' : mode === 'login' ? 'ログイン' : 'アカウント登録'}
          </button>
        </form>
        <p className="auth-switch">
          {mode === 'login' ? 'アカウントをお持ちでない方は' : '既にアカウントをお持ちの方は'}
          <button className="auth-link" onClick={function() { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSuccess(''); }}>
            {mode === 'login' ? '新規登録' : 'ログイン'}
          </button>
        </p>
      </div>
    </div>
  );
}
