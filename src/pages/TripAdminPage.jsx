import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';

var LUNCH = 1500;
var DINNER = 2000;

function formatDate(d) {
  if (!d) return '';
  var dt = new Date(d);
  return dt.getFullYear() + '/' + String(dt.getMonth() + 1).padStart(2, '0') + '/' + String(dt.getDate()).padStart(2, '0');
}

function statusClass(s) {
  return {
    '下書き': 'badge-draft', '申請済': 'badge-submitted',
    '承認済': 'badge-approved', '差戻し': 'badge-rejected',
  }[s] || 'badge-draft';
}

export default function TripAdminPage() {
  var auth = useAuth();
  var _trips = useState([]), trips = _trips[0], setTrips = _trips[1];
  var _ld = useState(true), loading = _ld[0], setLoading = _ld[1];
  var _detail = useState(null), detail = _detail[0], setDetail = _detail[1];
  var _t = useState(''), toast = _t[0], setToast = _t[1];

  function flash(msg) { setToast(msg); setTimeout(function() { setToast(''); }, 2500); }

  function loadTrips() {
    setLoading(true);
    supabase.from('trip_reports').select('*').order('departure_date', { ascending: false })
      .then(function(tripRes) {
        if (!tripRes.data) { setTrips([]); setLoading(false); return; }
        return supabase.from('profiles').select('*').then(function(profRes) {
          var profiles = profRes.data || [];
          var result = tripRes.data.map(function(t) {
            var prof = profiles.find(function(p) { return p.id === t.user_id; });
            return Object.assign({}, t, { user_name: prof ? prof.full_name : '不明', user_email: prof ? prof.email : '' });
          });
          setTrips(result);
        });
      })
      .catch(function() { setTrips([]); })
      .finally(function() { setLoading(false); });
  }

  useEffect(function() { loadTrips(); }, []);

  function updateStatus(tripId, newStatus) {
    supabase.from('trip_reports').update({ status: newStatus }).eq('id', tripId)
      .then(function() {
        flash('ステータスを「' + newStatus + '」に更新しました');
        setDetail(null);
        loadTrips();
      })
      .catch(function() { flash('更新に失敗しました'); });
  }

  if (detail) {
    var t = detail;
    return (
      <div className="trip-page">
        {toast && <div className="toast">{toast}</div>}
        <div className="month-header">
          <button className="btn-ghost" onClick={function() { setDetail(null); }}>← 戻る</button>
          <h2 className="month-title">{t.user_name} の出張詳細</h2>
        </div>
        <div className="card">
          <div className="trip-detail-grid">
            <div className="trip-detail-item">
              <span className="trip-detail-label">申請者</span>
              <span className="trip-detail-value">{t.user_name}</span>
            </div>
            <div className="trip-detail-item">
              <span className="trip-detail-label">出張先</span>
              <span className="trip-detail-value">{t.destination}</span>
            </div>
            <div className="trip-detail-item">
              <span className="trip-detail-label">出発日</span>
              <span className="trip-detail-value">{formatDate(t.departure_date)}</span>
            </div>
            <div className="trip-detail-item">
              <span className="trip-detail-label">帰着日</span>
              <span className="trip-detail-value">{formatDate(t.return_date)}</span>
            </div>
            <div className="trip-detail-item">
              <span className="trip-detail-label">泊数</span>
              <span className="trip-detail-value">{t.nights}泊{t.nights + 1}日</span>
            </div>
          </div>
          <div className="trip-breakdown">
            <h3 className="trip-breakdown-title">手当内訳</h3>
            <table className="trip-calc-table">
              <thead><tr><th>項目</th><th>単価</th><th>回数</th><th>小計</th></tr></thead>
              <tbody>
                <tr>
                  <td>昼食代</td><td>¥{LUNCH.toLocaleString()}</td>
                  <td>{t.nights + 1}日分</td><td className="trip-calc-amount">¥{t.lunch_allowance.toLocaleString()}</td>
                </tr>
                <tr>
                  <td>夕食代</td><td>¥{DINNER.toLocaleString()}</td>
                  <td>{t.nights}泊分</td><td className="trip-calc-amount">¥{t.dinner_allowance.toLocaleString()}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="trip-calc-total">
                  <td colSpan={3}>合計</td><td className="trip-calc-amount">¥{t.total_allowance.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="trip-detail-actions">
            <span className={'status-badge ' + statusClass(t.status)}>{t.status}</span>
            {t.status === '申請済' && (
              <>
                <button className="btn-submit" onClick={function() { updateStatus(t.id, '承認済'); }}>✓ 承認</button>
                <button className="btn-danger" onClick={function() { updateStatus(t.id, '差戻し'); }}>✗ 差戻し</button>
              </>
            )}
            {t.status === '差戻し' && (
              <button className="btn-submit" onClick={function() { updateStatus(t.id, '承認済'); }}>✓ 承認</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="trip-page">
      {toast && <div className="toast">{toast}</div>}
      <div className="month-header">
        <h2 className="month-title">出張申請一覧（管理者）</h2>
      </div>
      {loading ? (
        <div className="page-loading"><div className="spinner"></div><span>読み込み中...</span></div>
      ) : trips.length === 0 ? (
        <div className="card"><p className="empty-state">出張申請はまだありません。</p></div>
      ) : (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>申請者</th>
                <th style={{ textAlign: 'left' }}>出張先</th>
                <th style={{ textAlign: 'center' }}>期間</th>
                <th style={{ textAlign: 'center' }}>泊数</th>
                <th style={{ textAlign: 'right' }}>手当合計</th>
                <th style={{ textAlign: 'center', width: '80px' }}>ステータス</th>
                <th style={{ textAlign: 'center', width: '120px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {trips.map(function(t) {
                return (
                  <tr key={t.id} className="admin-table-row">
                    <td style={{ fontWeight: 600 }}>{t.user_name}</td>
                    <td>{t.destination}</td>
                    <td style={{ textAlign: 'center', fontSize: '13px' }}>{formatDate(t.departure_date)} 〜 {formatDate(t.return_date)}</td>
                    <td style={{ textAlign: 'center' }}>{t.nights}泊</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>¥{t.total_allowance.toLocaleString()}</td>
                    <td style={{ textAlign: 'center' }}><span className={'status-badge ' + statusClass(t.status)}>{t.status}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="admin-actions">
                        <button className="btn-small" onClick={function() { setDetail(t); }}>詳細</button>
                        {t.status === '申請済' && (
                          <>
                            <button className="btn-small btn-small-approve" onClick={function() { updateStatus(t.id, '承認済'); }}>承認</button>
                            <button className="btn-small btn-small-reject" onClick={function() { updateStatus(t.id, '差戻し'); }}>差戻</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
