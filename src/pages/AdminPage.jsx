import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { openPrintPDF } from '../lib/pdf';
import AttendanceTable from '../components/AttendanceTable';

export default function AdminPage() {
  var auth = useAuth();
  var _u = useState([]), users = _u[0], setUsers = _u[1];
  var _ld = useState(true), loading = _ld[0], setLoading = _ld[1];
  var _dv = useState(null), detailView = _dv[0], setDetailView = _dv[1];
  var _t = useState(''), toast = _t[0], setToast = _t[1];

  function flash(msg) { setToast(msg); setTimeout(function() { setToast(''); }, 2500); }

  function loadUsers() {
    setLoading(true);
    supabase.from('profiles').select('*').order('created_at')
      .then(function(res) {
        if (!res.data) { setUsers([]); setLoading(false); return; }
        var promises = res.data.map(function(p) {
          return supabase.from('monthly_reports').select('*')
            .eq('user_id', p.id)
            .order('year', { ascending: false })
            .order('month', { ascending: false })
            .then(function(rRes) {
              return Object.assign({}, p, { reports: rRes.data || [] });
            });
        });
        return Promise.all(promises).then(function(result) { setUsers(result); });
      })
      .catch(function() { setUsers([]); })
      .finally(function() { setLoading(false); });
  }

  useEffect(function() { loadUsers(); }, []);

  function viewReport(report, profile) {
    supabase.from('attendance_rows').select('*').eq('report_id', report.id).order('day')
      .then(function(res) {
        setDetailView({ report: report, rows: res.data || [], profile: profile });
      })
      .catch(function() {});
  }

  function updateStatus(reportId, newStatus) {
    supabase.from('monthly_reports').update({ status: newStatus }).eq('id', reportId)
      .then(function() {
        flash('ステータスを「' + newStatus + '」に更新しました');
        if (detailView && detailView.report.id === reportId) {
          setDetailView(Object.assign({}, detailView, {
            report: Object.assign({}, detailView.report, { status: newStatus })
          }));
        }
        loadUsers();
      })
      .catch(function() { flash('更新に失敗しました'); });
  }

  function statusClass(s) {
    return { '下書き': 'badge-draft', '申請済': 'badge-submitted', '承認済': 'badge-approved', '差戻し': 'badge-rejected' }[s] || 'badge-draft';
  }

  if (detailView) {
    var rpt = detailView.report;
    var prof = detailView.profile;
    return (
      <div className="admin-page">
        {toast && <div className="toast">{toast}</div>}
        <div className="month-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="btn-ghost" onClick={function() { setDetailView(null); }}>← 戻る</button>
            <h2 className="month-title">{prof.full_name} — {rpt.year}年{rpt.month}月</h2>
          </div>
          <div className="header-actions">
            <span className={'status-badge ' + statusClass(rpt.status)}>{rpt.status}</span>
            {rpt.status === '申請済' && (
              <>
                <button className="btn-submit" onClick={function() { updateStatus(rpt.id, '承認済'); }}>✓ 承認</button>
                <button className="btn-danger" onClick={function() { updateStatus(rpt.id, '差戻し'); }}>✗ 差戻し</button>
              </>
            )}
            <button className="btn-outline" onClick={function() { openPrintPDF(detailView.rows, rpt.year, rpt.month, prof.full_name, rpt.status); }}>📄 PDF印刷</button>
          </div>
        </div>
        <AttendanceTable rows={detailView.rows} readOnly={true} />
      </div>
    );
  }

  if (loading) return (<div className="page-loading"><div className="spinner"></div><span>読み込み中...</span></div>);

  return (
    <div className="admin-page">
      {toast && <div className="toast">{toast}</div>}
      <div className="card">
        <h2 className="card-title">全ユーザー管理</h2>
        <p className="card-desc">全ユーザーの勤怠申請を確認・承認できます。</p>
        {users.length === 0 ? (
          <p className="empty-state">登録ユーザーはいません</p>
        ) : (
          <div className="admin-users">
            {users.map(function(u) {
              return (
                <div key={u.id} className="admin-user-card">
                  <div className="admin-user-header">
                    <div>
                      <span className="admin-user-name">{u.full_name}</span>
                      <span className="admin-user-email">{u.email}</span>
                      {u.role === 'admin' && <span className="admin-role-badge">管理者</span>}
                    </div>
                  </div>
                  {u.reports.length === 0 ? (
                    <p className="admin-no-data">データなし</p>
                  ) : (
                    <div className="admin-month-list">
                      {u.reports.map(function(r) {
                        return (
                          <button key={r.id} className={'admin-month-btn ' + statusClass(r.status)} onClick={function() { viewReport(r, u); }}>
                            {r.year}年{r.month}月
                            <span className="admin-month-status">{r.status}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
