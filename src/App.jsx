import { useState, useEffect } from 'react';
import { useAuth } from './components/AuthProvider';
import logoImg from './assets/logo.png';
import AuthPage from './pages/AuthPage';
import AttendancePage from './pages/AttendancePage';
import MonthsPage from './pages/MonthsPage';
import AdminPage from './pages/AdminPage';
import TripPage from './pages/TripPage';
import TripAdminPage from './pages/TripAdminPage';
import ExpensePage from './pages/ExpensePage';
import ExpenseAdminPage from './pages/ExpenseAdminPage';
import ProfilePage from './pages/ProfilePage';
import InternPage from './pages/InternPage';
import InternAdminPage from './pages/InternAdminPage';

export default function App() {
  var auth = useAuth();
  var _mod = useState('home'), module = _mod[0], setModule = _mod[1];
  var _v = useState('attendance'), view = _v[0], setView = _v[1];
  var _tv = useState('trips'), tripView = _tv[0], setTripView = _tv[1];
  var _ev = useState('expenses'), expView = _ev[0], setExpView = _ev[1];

  useEffect(function() {
    var hash = window.location.hash;
    if (hash && hash.includes('access_token')) { window.history.replaceState(null, '', window.location.pathname); }
  }, []);

  if (auth.loading) { return (<div className="loading-screen"><div className="spinner"></div><p>読み込み中...</p></div>); }
  if (!auth.user) return (<AuthPage />);

  // プロフィール画面
  if (module === 'profile') {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="header-left"><button className="btn-home" onClick={function(){setModule('home');}}>◀ ホーム</button><img src={logoImg} alt="ロゴ" className="header-logo-img" /><span className="header-brand">アカウント設定</span></div>
          <nav className="header-nav"><button className="nav-logout" onClick={function(){auth.signOut();}}>ログアウト</button></nav>
        </header>
        <main className="app-main"><ProfilePage /></main>
      </div>
    );
  }

  // インターン日報
  if (module === 'intern') {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="header-left"><button className="btn-home" onClick={function(){setModule('home');}}>◀ ホーム</button><img src={logoImg} alt="ロゴ" className="header-logo-img" /><span className="header-brand">日報・勤怠</span></div>
          <nav className="header-nav">
            <button className="nav-btn" onClick={function(){setModule('profile');}}>👤</button>
            <button className="nav-logout" onClick={function(){auth.signOut();}}>ログアウト</button>
          </nav>
        </header>
        <main className="app-main"><InternPage /></main>
      </div>
    );
  }

  // インターン管理者
  if (module === 'intern-admin') {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="header-left"><button className="btn-home" onClick={function(){setModule('home');}}>◀ ホーム</button><img src={logoImg} alt="ロゴ" className="header-logo-img" /><span className="header-brand">インターン日報（管理者）</span></div>
          <nav className="header-nav">
            <button className="nav-btn" onClick={function(){setModule('profile');}}>👤</button>
            <button className="nav-logout" onClick={function(){auth.signOut();}}>ログアウト</button>
          </nav>
        </header>
        <main className="app-main"><InternAdminPage /></main>
      </div>
    );
  }

  // ホーム画面
  if (module === 'home') {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="header-left"><img src={logoImg} alt="ロゴ" className="header-logo-img" /><span className="header-brand">業務管理システム</span></div>
          <nav className="header-nav">
            <button className="nav-btn" onClick={function(){setModule('profile');}}><span className="nav-user-icon">👤</span> {auth.profile?auth.profile.full_name:''}</button>
            <button className="nav-logout" onClick={function(){auth.signOut();}}>ログアウト</button>
          </nav>
        </header>
        <main className="dashboard-main">
          <div className="dashboard-greeting"><h1 className="dashboard-title">{'こんにちは、'+(auth.profile?auth.profile.full_name:'')+'さん'}</h1><p className="dashboard-subtitle">メニューを選択してください</p></div>
          <div className="dashboard-grid">
            {auth.isIntern && (
              <button className="dashboard-card dc-intern" onClick={function(){setModule('intern');}}><div className="dc-icon">🎓</div><div className="dc-info"><h2 className="dc-title">日報・勤怠</h2><p className="dc-desc">日報の記録・勤怠管理</p></div><span className="dc-arrow">→</span></button>
            )}
            {!auth.isIntern && (
              <button className="dashboard-card dc-attendance" onClick={function(){setModule('attendance');setView('attendance');}}><div className="dc-icon">⏱</div><div className="dc-info"><h2 className="dc-title">勤怠管理</h2><p className="dc-desc">出退勤の記録</p></div><span className="dc-arrow">→</span></button>
            )}
            <button className="dashboard-card dc-trip" onClick={function(){setModule('trip');setTripView('trips');}}><div className="dc-icon">✈️</div><div className="dc-info"><h2 className="dc-title">出張管理</h2><p className="dc-desc">出張申請・手当計算</p></div><span className="dc-arrow">→</span></button>
            <button className="dashboard-card dc-expense" onClick={function(){setModule('expense');setExpView('expenses');}}><div className="dc-icon">💰</div><div className="dc-info"><h2 className="dc-title">経費管理</h2><p className="dc-desc">交通費・経費の申請・領収書読取</p></div><span className="dc-arrow">→</span></button>
          </div>
          {auth.isAdmin && (<div className="dashboard-admin-section"><p className="dashboard-admin-label">管理者メニュー</p><div className="dashboard-grid">
            <button className="dashboard-card dc-admin" onClick={function(){setModule('attendance');setView('admin');}}><div className="dc-icon">👥</div><div className="dc-info"><h2 className="dc-title">勤怠管理（管理者）</h2><p className="dc-desc">全ユーザーの勤怠確認・承認</p></div><span className="dc-arrow">→</span></button>
            <button className="dashboard-card dc-admin" onClick={function(){setModule('trip');setTripView('admin');}}><div className="dc-icon">🗂</div><div className="dc-info"><h2 className="dc-title">出張管理（管理者）</h2><p className="dc-desc">全ユーザーの出張申請確認・承認</p></div><span className="dc-arrow">→</span></button>
            <button className="dashboard-card dc-admin" onClick={function(){setModule('expense');setExpView('admin');}}><div className="dc-icon">📊</div><div className="dc-info"><h2 className="dc-title">経費管理（管理者）</h2><p className="dc-desc">全ユーザーの経費申請確認・承認</p></div><span className="dc-arrow">→</span></button>
            <button className="dashboard-card dc-admin" onClick={function(){setModule('intern-admin');}}><div className="dc-icon">🎓</div><div className="dc-info"><h2 className="dc-title">インターン日報（管理者）</h2><p className="dc-desc">インターン生の日報・勤怠確認</p></div><span className="dc-arrow">→</span></button>
          </div></div>)}
        </main>
      </div>
    );
  }

  // 出張管理
  if (module === 'trip') {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="header-left"><button className="btn-home" onClick={function(){setModule('home');}}>◀ ホーム</button><img src={logoImg} alt="ロゴ" className="header-logo-img" /><span className="header-brand">出張管理</span></div>
          <nav className="header-nav">
            <button className={tripView==='trips'?'nav-btn nav-active':'nav-btn'} onClick={function(){setTripView('trips');}}>出張一覧</button>
            {auth.isAdmin&&<button className={tripView==='admin'?'nav-btn nav-active':'nav-btn'} onClick={function(){setTripView('admin');}}>管理者</button>}
            <button className="nav-btn" onClick={function(){setModule('profile');}}>👤</button>
            <button className="nav-logout" onClick={function(){auth.signOut();}}>ログアウト</button>
          </nav>
        </header>
        <main className="app-main">
          {tripView==='trips'&&<TripPage />}
          {tripView==='admin'&&auth.isAdmin&&<TripAdminPage />}
        </main>
      </div>
    );
  }

  // 経費管理
  if (module === 'expense') {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="header-left"><button className="btn-home" onClick={function(){setModule('home');}}>◀ ホーム</button><img src={logoImg} alt="ロゴ" className="header-logo-img" /><span className="header-brand">経費管理</span></div>
          <nav className="header-nav">
            <button className={expView==='expenses'?'nav-btn nav-active':'nav-btn'} onClick={function(){setExpView('expenses');}}>経費一覧</button>
            {auth.isAdmin&&<button className={expView==='admin'?'nav-btn nav-active':'nav-btn'} onClick={function(){setExpView('admin');}}>管理者</button>}
            <button className="nav-btn" onClick={function(){setModule('profile');}}>👤</button>
            <button className="nav-logout" onClick={function(){auth.signOut();}}>ログアウト</button>
          </nav>
        </header>
        <main className="app-main">
          {expView==='expenses'&&<ExpensePage />}
          {expView==='admin'&&auth.isAdmin&&<ExpenseAdminPage />}
        </main>
      </div>
    );
  }

  // 勤怠管理
  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left"><button className="btn-home" onClick={function(){setModule('home');}}>◀ ホーム</button><img src={logoImg} alt="ロゴ" className="header-logo-img" /><span className="header-brand">勤怠管理</span></div>
        <nav className="header-nav">
          <button className={view==='attendance'?'nav-btn nav-active':'nav-btn'} onClick={function(){setView('attendance');}}>勤怠入力</button>
          <button className={view==='months'?'nav-btn nav-active':'nav-btn'} onClick={function(){setView('months');}}>月別一覧</button>
          {auth.isAdmin&&<button className={view==='admin'?'nav-btn nav-active':'nav-btn'} onClick={function(){setView('admin');}}>管理者</button>}
          <button className="nav-btn" onClick={function(){setModule('profile');}}>👤</button>
          <button className="nav-logout" onClick={function(){auth.signOut();}}>ログアウト</button>
        </nav>
      </header>
      <main className="app-main">
        {view==='attendance'&&<AttendancePage />}
        {view==='months'&&<MonthsPage onNavigate={function(){setView('attendance');}} />}
        {view==='admin'&&auth.isAdmin&&<AdminPage />}
      </main>
    </div>
  );
}
