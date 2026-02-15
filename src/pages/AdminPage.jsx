import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { openPrintPDF } from '../lib/pdf';
import AttendanceTable from '../components/AttendanceTable';

export default function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailView, setDetailView] = useState(null); // { report, rows, profile }
  const [detailLoading, setDetailLoading] = useState(false);
  const [toast, setToast] = useState('');

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  // ── 全ユーザー＆レポート取得 ─────────────────────────────────
  const loadUsers = useCallback(async () => {
    setLoading(true);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at');

    if (profiles) {
      const result = [];
      for (const p of profiles) {
        const { data: reports } = await supabase
          .from('monthly_reports')
          .select('*')
          .eq('user_id', p.id)
          .order('year', { ascending: false })
          .order('month', { ascending: false });
        result.push({ ...p, reports: reports || [] });
      }
      setUsers(result);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // ── レポート詳細表示 ──────────────────────────────────────
  const viewReport = async (report, profile) => {
    setDetailLoading(true);
    const { data: rows } = await supabase
      .from('attendance_rows')
      .select('*')
      .eq('report_id', report.id)
      .order('day');
    setDetailView({ report, rows: rows || [], profile });
    setDetailLoading(false);
  };

  // ── ステータス更新 ────────────────────────────────────────
  const updateStatus = async (reportId, newStatus) => {
    await supabase
      .from('monthly_reports')
      .update({ status: newStatus })
      .eq('id', reportId);
    flash(`ステータスを「${newStatus}」に更新しました`);

    // 詳細ビュー更新
    if (detailView && detailView.report.id === reportId) {
      setDetailView(prev => ({
        ...prev,
        report: { ...prev.report, status: newStatus }
      }));
    }
    // リスト更新
    loadUsers();
  };

  const statusClass = (s) => ({
    '下書き': 'badge-draft',
    '申請済': 'badge-submitted',
    '承認済': 'badge-approved',
    '差戻し': 'badge-rejected',
  }[s] || 'badge-draft');

  // ── 詳細ビュー ────────────────────────────────────────────
  if (detailView) {
    const { report: rpt, rows, profile: prof } = detailView;
    return (
      <div className="admin-page">
        {toast && <div className="toast">{toast}</div>}

        <div className="month-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn-ghost" onClick={() => setDetailView(null)}>← 戻る</button>
            <h2 className="month-title">
              {prof.full_name} — {rpt.year}年{rpt.month}月
            </h2>
          </div>
          <div className="header-actions">
            <span className={`status-badge ${statusClass(rpt.status)}`}>{rpt.status}</span>

            {rpt.status === '申請済' && (
              <>
                <button
                  className="btn-submit"
                  onClick={() => updateStatus(rpt.id, '承認済')}
                >
                  ✓ 承認
                </button>
                <button
                  className="btn-danger"
                  onClick={() => updateStatus(rpt.id, '差戻し')}
                >
                  ✗ 差戻し
                </button>
              </>
            )}

            <button
              className="btn-outline"
              onClick={() => openPrintPDF(rows, rpt.year, rpt.month, prof.full_name, rpt.status)}
            >
              📄 PDF印刷
            </button>
          </div>
        </div>

        {detailLoading ? (
          <div className="page-loading"><div className="spinner" /><span>読み込み中...</span></div>
        ) : (
          <AttendanceTable rows={rows} readOnly />
        )}
      </div>
    );
  }

  // ── ユーザー一覧 ──────────────────────────────────────────
  if (loading) return <div className="page-loading"><div className="spinner" /><span>読み込み中...</span></div>;

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
            {users.map(u => (
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
                    {u.reports.map(r => (
                      <button
                        key={r.id}
                        className={`admin-month-btn ${statusClass(r.status)}`}
                        onClick={() => viewReport(r, u)}
                      >
                        {r.year}年{r.month}月
                        <span className="admin-month-status">{r.status}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
