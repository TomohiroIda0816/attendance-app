import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';

export default function MonthsPage({ onNavigate }) {
  var auth = useAuth();
  var _r = useState([]), reports = _r[0], setReports = _r[1];
  var _ld = useState(true), loading = _ld[0], setLoading = _ld[1];

  useEffect(function() {
    if (!auth.user) return;
    supabase.from('monthly_reports').select('*')
      .eq('user_id', auth.user.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .then(function(res) { setReports(res.data || []); })
      .catch(function() { setReports([]); })
      .finally(function() { setLoading(false); });
  }, [auth.user]);

  if (loading) return (<div className="page-loading"><div className="spinner"></div><span>読み込み中...</span></div>);

  return (
    <div className="months-page">
      <div className="card">
        <h2 className="card-title">月別レポート一覧</h2>
        {reports.length === 0 ? (
          <p className="empty-state">まだレポートはありません。</p>
        ) : (
          <div className="months-list">
            {reports.map(function(r) {
              return (
                <div key={r.id} className="month-item" onClick={function() { if (onNavigate) onNavigate(r.year, r.month); }}>
                  <div className="month-item-left">
                    <span className="month-item-label">{r.year}年{r.month}月</span>
                  </div>
                  <div className="month-item-right">
                    <span className="month-item-arrow">→</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
