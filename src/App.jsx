import { useState } from 'react';
import { useAuth } from './components/AuthProvider';
import AuthPage from './pages/AuthPage';
import AttendancePage from './pages/AttendancePage';
import SettingsPage from './pages/SettingsPage';
import MonthsPage from './pages/MonthsPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  const { user, profile, loading, signOut, isAdmin } = useAuth();
  const [view, setView] = useState('attendance');

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>読み込み中...</p>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  const handleMonthNavigate = (year, month) => {
    // MonthsPage → AttendancePage への遷移を window イベントで通知
    window.__attNav = { year, month };
    setView('attendance');
    // 少し待ってからイベント発火
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('att-navigate', { detail: { year, month } }));
    }, 100);
  };

  return (
    <div className="app-container">
      {/* Header */}
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
            ...(isAdmin ? [['admin', '管理者']] : []),
          ].map(([key, label]) => (
            <button
              key={key}
              className={`nav-btn ${view === key ? 'nav-active' : ''}`}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
          <button className="nav-logout" onClick={signOut}>ログアウト</button>
        </nav>
      </header>

      {/* Content */}
      <main className="app-main">
        {view === 'attendance' && <AttendancePage />}
        {view === 'settings' && <SettingsPage />}
        {view === 'months' && <MonthsPage onNavigate={handleMonthNavigate} />}
        {view === 'admin' && isAdmin && <AdminPage />}
      </main>
    </div>
  );
}
