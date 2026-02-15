import { useState, useEffect } from 'react';
import { useAuth } from './components/AuthProvider';
import AuthPage from './pages/AuthPage';
import AttendancePage from './pages/AttendancePage';
import SettingsPage from './pages/SettingsPage';
import MonthsPage from './pages/MonthsPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  const { user, profile, loading, signOut, isAdmin } = useAuth();
  const [view, setView] = useState('attendance');
  const [confirmMsg, setConfirmMsg] = useState('');

  useEffect(() => {
    var hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    if (hash && hash.includes('error_description')) {
      var params = new URLSearchParams(hash.substring(1));
      var desc = params.get('error_description');
      if (desc && desc.includes('expired')) {
        setConfirmMsg('認証リンクの有効期限が切れています。再度登録してください。');
      }
    }
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>読み込み中...</p>
      </div>
    );
  }

  if (!user) return <AuthPage message={confirmMsg} />;

  var handleMonthNavigate = function(year, month) {
    window.__attNav = { year: year, month: month };
    setView('attendance');
    setTimeout(function() {
      window.dispatchEvent(new CustomEvent('att-navigate', { detail: { year: year, month: month } }));
    }, 100);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <span className="header-logo">⏱</span>
          <span className="header-brand">勤怠管理</span>
          <span className="header-user">{profile?.full_name}</span>
        </div>
        <nav className="header-nav">
          {[
            ['attendance', '勤怠入力'],
            ['months', '月別一覧'],
            ['settings', '設定'],
          ].concat(isAdmin ? [['admin', '管理者']] : []).map(function(item) {
            return (
              <button
                key={item[0]}
                className={'nav-btn ' + (view === item[0] ? 'nav-active' : '')}
                onClick={function() { setView(item[0]); }}
              >
                {item[1]}
              </button>
            );
          })}
          <button className="nav-logout" onClick={signOut}>ログアウト</button>
        </nav>
      </header>

      <main className="app-main">
        {view === 'attendance' && <AttendancePage />}
        {view === 'settings' && <SettingsPage />}
        {view === 'months' && <MonthsPage onNavigate={handleMonthNavigate} />}
        {view === 'admin' && isAdmin && <AdminPage />}
      </main>
    </div>
  );
}
