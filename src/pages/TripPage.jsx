import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';

var LUNCH = 1500;
var DINNER = 2000;

function calcAllowance(departureDate, returnDate) {
  if (!departureDate || !returnDate) return { nights: 0, lunch: 0, dinner: 0, total: 0 };
  var d1 = new Date(departureDate);
  var d2 = new Date(returnDate);
  var diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  if (diff < 0) diff = 0;
  var nights = diff;
  var days = nights + 1;
  var lunch = days * LUNCH;
  var dinner = nights * DINNER;
  return { nights: nights, lunch: lunch, dinner: dinner, total: lunch + dinner };
}

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

export default function TripPage() {
  var auth = useAuth();
  var _trips = useState([]), trips = _trips[0], setTrips = _trips[1];
  var _ld = useState(true), loading = _ld[0], setLoading = _ld[1];
  var _show = useState(false), showForm = _show[0], setShowForm = _show[1];
  var _edit = useState(null), editId = _edit[0], setEditId = _edit[1];
  var _dep = useState(''), dep = _dep[0], setDep = _dep[1];
  var _ret = useState(''), ret = _ret[0], setRet = _ret[1];
  var _dest = useState(''), dest = _dest[0], setDest = _dest[1];
  var _saving = useState(false), saving = _saving[0], setSaving = _saving[1];
  var _t = useState(''), toast = _t[0], setToast = _t[1];
  var _detail = useState(null), detail = _detail[0], setDetail = _detail[1];

  function flash(msg) { setToast(msg); setTimeout(function() { setToast(''); }, 2500); }

  function loadTrips() {
    if (!auth.user) return;
    setLoading(true);
    supabase.from('trip_reports').select('*')
      .eq('user_id', auth.user.id)
      .order('departure_date', { ascending: false })
      .then(function(res) { setTrips(res.data || []); })
      .catch(function() { setTrips([]); })
      .finally(function() { setLoading(false); });
  }

  useEffect(function() { loadTrips(); }, [auth.user]);

  function resetForm() {
    setDep(''); setRet(''); setDest('');
    setEditId(null); setShowForm(false);
  }

  function handleSave() {
    if (!dep || !ret || !dest.trim()) { flash('すべての項目を入力してください'); return; }
    var allow = calcAllowance(dep, ret);
    if (allow.nights < 0) { flash('帰着日は出発日以降にしてください'); return; }

    setSaving(true);
    var data = {
      user_id: auth.user.id,
      departure_date: dep,
      return_date: ret,
      destination: dest.trim(),
      nights: allow.nights,
      lunch_allowance: allow.lunch,
      dinner_allowance: allow.dinner,
      total_allowance: allow.total,
      status: '下書き',
    };

    var promise;
    if (editId) {
      promise = supabase.from('trip_reports').update(data).eq('id', editId);
    } else {
      promise = supabase.from('trip_reports').insert(data);
    }

    promise
      .then(function() {
        flash(editId ? '出張を更新しました' : '出張を登録しました');
        resetForm();
        loadTrips();
      })
      .catch(function() { flash('保存に失敗しました'); })
      .finally(function() { setSaving(false); });
  }

  function handleEdit(trip) {
    setDep(trip.departure_date);
    setRet(trip.return_date);
    setDest(trip.destination);
    setEditId(trip.id);
    setShowForm(true);
    setDetail(null);
  }

  function handleDelete(tripId) {
    if (!confirm('この出張記録を削除しますか？')) return;
    supabase.from('trip_reports').delete().eq('id', tripId)
      .then(function() { flash('削除しました'); loadTrips(); })
      .catch(function() { flash('削除に失敗しました'); });
  }

  function handleSubmit(tripId) {
    supabase.from('trip_reports')
      .update({ status: '申請済', submitted_at: new Date().toISOString() })
      .eq('id', tripId)
      .then(function() { flash('申請しました'); loadTrips(); })
      .catch(function() { flash('申請に失敗しました'); });
  }

  function handleUnsubmit(tripId) {
    supabase.from('trip_reports')
      .update({ status: '下書き', submitted_at: null })
      .eq('id', tripId)
      .then(function() { flash('申請を取り消しました'); loadTrips(); })
      .catch(function() { flash('取り消しに失敗しました'); });
  }

  var allow = calcAllowance(dep, ret);

  // 詳細ビュー
  if (detail) {
    var t = detail;
    return (
      <div className="trip-page">
        {toast && <div className="toast">{toast}</div>}
        <div className="month-header">
          <button className="btn-ghost" onClick={function() { setDetail(null); }}>← 戻る</button>
          <h2 className="month-title">出張詳細</h2>
        </div>
        <div className="card">
          <div className="trip-detail-grid">
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
              <thead>
                <tr><th>項目</th><th>単価</th><th>回数</th><th>小計</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>昼食代</td>
                  <td>¥{LUNCH.toLocaleString()}</td>
                  <td>{t.nights + 1}日分</td>
                  <td className="trip-calc-amount">¥{t.lunch_allowance.toLocaleString()}</td>
                </tr>
                <tr>
                  <td>夕食代</td>
                  <td>¥{DINNER.toLocaleString()}</td>
                  <td>{t.nights}泊分</td>
                  <td className="trip-calc-amount">¥{t.dinner_allowance.toLocaleString()}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="trip-calc-total">
                  <td colSpan={3}>合計</td>
                  <td className="trip-calc-amount">¥{t.total_allowance.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="trip-detail-actions">
            <span className={'status-badge ' + statusClass(t.status)}>{t.status}</span>
            {t.status === '下書き' && (
              <>
                <button className="btn-submit" onClick={function() { handleSubmit(t.id); setDetail(null); }}>✓ 申請</button>
                <button className="btn-outline" onClick={function() { handleEdit(t); }}>✏️ 編集</button>
                <button className="btn-danger" onClick={function() { handleDelete(t.id); setDetail(null); }}>🗑 削除</button>
              </>
            )}
            {t.status === '申請済' && (
              <button className="btn-danger" onClick={function() { handleUnsubmit(t.id); setDetail(null); }}>申請取消</button>
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
        <h2 className="month-title">出張一覧</h2>
        <button className="btn-submit" onClick={function() { resetForm(); setShowForm(!showForm); }}>
          {showForm ? '✕ 閉じる' : '＋ 新規出張'}
        </button>
      </div>

      {/* 入力フォーム */}
      {showForm && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 className="card-title">{editId ? '出張を編集' : '新規出張登録'}</h3>
          <div className="trip-form-grid">
            <div className="form-group">
              <label className="form-label">出張先</label>
              <input className="form-input" value={dest} onChange={function(e) { setDest(e.target.value); }} placeholder="例: 大阪本社" />
            </div>
            <div className="form-group">
              <label className="form-label">出発日</label>
              <input className="form-input" type="date" value={dep} onChange={function(e) { setDep(e.target.value); }} />
            </div>
            <div className="form-group">
              <label className="form-label">帰着日</label>
              <input className="form-input" type="date" value={ret} onChange={function(e) { setRet(e.target.value); }} />
            </div>
          </div>

          {dep && ret && (
            <div className="trip-preview">
              <div className="trip-preview-row">
                <span>{allow.nights}泊{allow.nights + 1}日</span>
                <span>昼食代: ¥{allow.lunch.toLocaleString()}</span>
                <span>夕食代: ¥{allow.dinner.toLocaleString()}</span>
                <span className="trip-preview-total">合計: ¥{allow.total.toLocaleString()}</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }} onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : editId ? '更新' : '登録'}
            </button>
            <button className="btn-outline" onClick={resetForm}>キャンセル</button>
          </div>
        </div>
      )}

      {/* 出張一覧 */}
      {loading ? (
        <div className="page-loading"><div className="spinner"></div><span>読み込み中...</span></div>
      ) : trips.length === 0 ? (
        <div className="card"><p className="empty-state">出張記録はまだありません。「新規出張」から登録してください。</p></div>
      ) : (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>出張先</th>
                <th style={{ textAlign: 'center' }}>出発日</th>
                <th style={{ textAlign: 'center' }}>帰着日</th>
                <th style={{ textAlign: 'center' }}>泊数</th>
                <th style={{ textAlign: 'right' }}>手当合計</th>
                <th style={{ textAlign: 'center', width: '80px' }}>ステータス</th>
              </tr>
            </thead>
            <tbody>
              {trips.map(function(t) {
                return (
                  <tr key={t.id} className="admin-table-row" style={{ cursor: 'pointer' }} onClick={function() { setDetail(t); }}>
                    <td style={{ fontWeight: 600 }}>{t.destination}</td>
                    <td style={{ textAlign: 'center' }}>{formatDate(t.departure_date)}</td>
                    <td style={{ textAlign: 'center' }}>{formatDate(t.return_date)}</td>
                    <td style={{ textAlign: 'center' }}>{t.nights}泊</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>¥{t.total_allowance.toLocaleString()}</td>
                    <td style={{ textAlign: 'center' }}><span className={'status-badge ' + statusClass(t.status)}>{t.status}</span></td>
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
