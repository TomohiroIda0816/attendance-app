import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';

export default function MonthsPage({ onNavigate }) {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('monthly_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      setReports(data || []);
      setLoading(false);
    })();
  }, [user]);

  const statusClass = (s) => ({
    '下書き': 'badge-draft',
    '申請済': 'badge-submitted',
    '承認済': 'badge-approved',
    '差戻し': 'badge-rejected',
  }[s] || 'badge-draft');

  if (loading) return <div className="page-loading"><div className="spinner" /><span>読み込み中...</span></div>;

  return (
    <div className="months-page">
      <div className="card">
        <h2 className="card-title">月別レポート一覧</h2>

        {reports.length === 0 ? (
          <p className="empty-state">まだレポートはありません。「勤怠入力」から月を選択すると自動的に作成されます。</p>
        ) : (
          <div className="months-list">
            {reports.map(r => (
              <div
                key={r.id}
                className="month-item"
                onClick={() => onNavigate && onNavigate(r.year, r.month)}
              >
                <div className="month-item-left">
                  <span className="month-item-label">{r.year}年{r.month}月</span>
                  {r.submitted_at && (
                    <span className="month-item-date">
                      申請日: {new Date(r.submitted_at).toLocaleDateString('ja-JP')}
                    </span>
                  )}
                </div>
                <div className="month-item-right">
                  <span className={`status-badge ${statusClass(r.status)}`}>{r.status}</span>
                  <span className="month-item-arrow">→</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
