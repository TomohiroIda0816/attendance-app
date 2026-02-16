import { useState, useEffect } from 'react';
import { useAuth } from './components/AuthProvider';
import AuthPage from './pages/AuthPage';
import AttendancePage from './pages/AttendancePage';
import SettingsPage from './pages/SettingsPage';
import MonthsPage from './pages/MonthsPage';
import AdminPage from './pages/AdminPage';
import TripPage from './pages/TripPage';
import TripAdminPage from './pages/TripAdminPage';

export default function App() {
  var auth = useAuth();
  var _mod = useState('home'), module = _mod[0], setModule = _mod[1];
  var _v = useState('attendance'), view = _v[0], setView = _v[1];
  var _tv = useState('trips'), tripView = _tv[0], setTripView = _tv[1];

  useEffect(function() {
    var hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  if (auth.loading) {
    return (<div className="loading-screen"><div className="spinner"></div><p>読み込み中...</p></div>);
  }
  if (!auth.user) return (<AuthPage />);

  if (module === 'home') {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="header-left"><span className="header-logo">📋</span><span className="header-brand">業務管理システム</span><span className="header-user">{auth.profile ? auth.profile.full_name : ''}</span></div>
          <nav className="header-nav"><button className="nav-logout" onClick={function(){auth.signOut();}}>ログアウト</button></nav>
        </header>
        <main className="dashboard-main">
          <div className="dashboard-greeting"><h1 className="dashboard-title">{'こんにちは、'+(auth.profile?auth.profile.full_name:'')+'さん'}</h1><p className="dashboard-subtitle">メニューを選択してください</p></div>
          <div className="dashboard-grid">
            <button className="dashboard-card dc-attendance" onClick={function(){setModule('attendance');setView('attendance');}}><div className="dc-icon">⏱</div><div className="dc-info"><h2 className="dc-title">勤怠管理</h2><p className="dc-desc">出退勤の記録・月次申請</p></div><span className="dc-arrow">→</span></button>
            <button className="dashboard-card dc-trip" onClick={function(){setModule('trip');setTripView('trips');}}><div className="dc-icon">✈️</div><div className="dc-info"><h2 className="dc-title">出張管理</h2><p className="dc-desc">出張申請・手当計算</p></div><span className="dc-arrow">→</span></button>
            <button className="dashboard-card dc-expense" onClick={function(){setModule('expense');}}><div className="dc-icon">💰</div><div className="dc-info"><h2 className="dc-title">経費管理</h2><p className="dc-desc">経費申請・精算</p></div><span className="dc-arrow">→</span></button>
          </div>
          {auth.isAdmin && (<div className="dashboard-admin-section"><p className="dashboard-admin-label">管理者メニュー</p><div className="dashboard-grid">
            <button className="dashboard-card dc-admin" onClick={function(){setModule('attendance');setView('admin');}}><div className="dc-icon">👥</div><div className="dc-info"><h2 className="dc-title">勤怠管理（管理者）</h2><p className="dc-desc">全ユーザーの勤怠申請確認・承認</p></div><span className="dc-arrow">→</span></button>
            <button className="dashboard-card dc-admin" onClick={function(){setModule('trip');setTripView('admin');}}><div className="dc-icon">🗂</div><div className="dc-info"><h2 className="dc-title">出張管理（管理者）</h2><p className="dc-desc">全ユーザーの出張申請確認・承認</p></div><span className="dc-arrow">→</span></button>
          </div></div>)}
        </main>
      </div>
    );
  }

  if (module === 'expense') {
    return (
      <div className="app-container">
        <header className="app-header"><div className="header-left"><button className="btn-home" onClick={function(){setModule('home');}}>◀ ホーム</button><span className="header-logo">💰</span><span className="header-brand">経費管理</span></div><nav className="header-nav"><button className="nav-logout" onClick={function(){auth.signOut();}}>ログアウト</button></nav></header>
        <main className="app-main"><div className="coming-soon"><div className="coming-soon-icon">🚧</div><h2 className="coming-soon-title">準備中</h2><p className="coming-soon-desc">経費管理機能は現在開発中です。</p><button className="btn-outline" onClick={function(){setModule('home');}}>ホームに戻る</button></div></main>
      </div>
    );
  }

  if (module === 'trip') {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="header-left"><button className="btn-home" onClick={function(){setModule('home');}}>◀ ホーム</button><span className="header-logo">✈️</span><span className="header-brand">出張管理</span><span className="header-user">{auth.profile?auth.profile.full_name:''}</span></div>
          <nav className="header-nav">
            <button className={tripView==='trips'?'nav-btn nav-active':'nav-btn'} onClick={function(){setTripView('trips');}}>出張一覧</button>
            {auth.isAdmin && <button className={tripView==='admin'?'nav-btn nav-active':'nav-btn'} onClick={function(){setTripView('admin');}}>管理者</button>}
            <button className="nav-logout" onClick={function(){auth.signOut();}}>ログアウト</button>
          </nav>
        </header>
        <main className="app-main">
          {tripView==='trips' && <TripPage />}
          {tripView==='admin' && auth.isAdmin && <TripAdminPage />}
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left"><button className="btn-home" onClick={function(){setModule('home');}}>◀ ホーム</button><span className="header-logo">⏱</span><span className="header-brand">勤怠管理</span><span className="header-user">{auth.profile?auth.profile.full_name:''}</span></div>
        <nav className="header-nav">
          <button className={view==='attendance'?'nav-btn nav-active':'nav-btn'} onClick={function(){setView('attendance');}}>勤怠入力</button>
          <button className={view==='months'?'nav-btn nav-active':'nav-btn'} onClick={function(){setView('months');}}>月別一覧</button>
          <button className={view==='settings'?'nav-btn nav-active':'nav-btn'} onClick={function(){setView('settings');}}>設定</button>
          {auth.isAdmin && <button className={view==='admin'?'nav-btn nav-active':'nav-btn'} onClick={function(){setView('admin');}}>管理者</button>}
          <button className="nav-logout" onClick={function(){auth.signOut();}}>ログアウト</button>
        </nav>
      </header>
      <main className="app-main">
        {view==='attendance' && <AttendancePage />}
        {view==='settings' && <SettingsPage />}
        {view==='months' && <MonthsPage onNavigate={function(){setView('attendance');}} />}
        {view==='admin' && auth.isAdmin && <AdminPage />}
      </main>
    </div>
  );
}
