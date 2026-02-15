import { useState, useEffect } from 'react';
import { useAuth } from './components/AuthProvider';
import AuthPage from './pages/AuthPage';
import AttendancePage from './pages/AttendancePage';
import SettingsPage from './pages/SettingsPage';
import MonthsPage from './pages/MonthsPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  var auth = useAuth();
  var _v = useState('attendance'), view = _v[0], setView = _v[1];

  useEffect(function() {
    var hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  if (auth.loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>読み込み中...</p>
      </div>
    );
  }

  if (!auth.user) return (<AuthPage />);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <span className="header-logo">⏱</span>
          <span className="header-brand">勤怠管理</span>
          <span className="header-user">{auth.profile ? auth.profile.full_name : ''}</span>
        </div>
        <nav className="header-nav">
          <button className={view === 'attendance' ? 'nav-btn nav-active' : 'nav-btn'} onClick={function() { setView('attendance'); }}>勤怠入力</button>
          <button className={view === 'months' ? 'nav-btn nav-active' : 'nav-btn'} onClick={function() { setView('months'); }}>月別一覧</button>
          <button className={view === 'settings' ? 'nav-btn nav-active' : 'nav-btn'} onClick={function() { setView('settings'); }}>設定</button>
          {auth.isAdmin && <button className={view === 'admin' ? 'nav-btn nav-active' : 'nav-btn'} onClick={function() { setView('admin'); }}>管理者</button>}
          <button className="nav-logout" onClick={function() { auth.signOut(); }}>ログアウト</button>
        </nav>
      </header>
      <main className="app-main">
        {view === 'attendance' && <AttendancePage />}
        {view === 'settings' && <SettingsPage />}
        {view === 'months' && <MonthsPage onNavigate={function(y, m) { setView('attendance'); }} />}
        {view === 'admin' && auth.isAdmin && <AdminPage />}
      </main>
    </div>
  );
}
