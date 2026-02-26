import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { exportAttendanceExcel } from '../lib/attendanceExcel';
import AttendanceTable from '../components/AttendanceTable';

export default function AdminPage() {
  var auth = useAuth();
  var now = new Date();
  var _y = useState(now.getFullYear()), year = _y[0], setYear = _y[1];
  var _m = useState(now.getMonth() + 1), month = _m[0], setMonth = _m[1];
  var _users = useState([]), users = _users[0], setUsers = _users[1];
  var _ld = useState(true), loading = _ld[0], setLoading = _ld[1];
  var _dv = useState(null), detailView = _dv[0], setDetailView = _dv[1];
  var _t = useState(''), toast = _t[0], setToast = _t[1];
  var _editing = useState(false), editing = _editing[0], setEditing = _editing[1];
  var _editRows = useState([]), editRows = _editRows[0], setEditRows = _editRows[1];
  var _transportEntries = useState([]), transportEntries = _transportEntries[0], setTransportEntries = _transportEntries[1];

  function flash(msg) { setToast(msg); setTimeout(function() { setToast(''); }, 2500); }

  function loadMonthData() {
    setLoading(true); setDetailView(null); setEditing(false); setTransportEntries([]);
    supabase.from('profiles').select('*').order('full_name')
      .then(function(profRes) {
        if (!profRes.data) { setUsers([]); setLoading(false); return; }
        return supabase.from('monthly_reports').select('*').eq('year', year).eq('month', month)
          .then(function(repRes) {
            var reports = repRes.data || [];
            var result = profRes.data.map(function(p) {
              var report = reports.find(function(r) { return r.user_id === p.id; });
              return { id: p.id, full_name: p.full_name, email: p.email, role: p.role, report: report || null, status: report ? report.status : '未作成' };
            });
            setUsers(result);
          });
      })
      .catch(function() { setUsers([]); })
      .finally(function() { setLoading(false); });
  }

  useEffect(function() { loadMonthData(); }, [year, month]);

  function viewDetail(u) {
    if (!u.report) return;
    supabase.from('attendance_rows').select('*').eq('report_id', u.report.id).order('day')
      .then(function(res) {
        var rows = res.data || [];
        setDetailView({ user: u, rows: rows, report: u.report });
        setEditRows(rows.map(function(r){return Object.assign({}, r);}));
      });
    // 交通費もロード
    supabase.from('expense_monthly_reports').select('*')
      .eq('user_id', u.id).eq('year', year).eq('month', month).single()
      .then(function(res) {
        if (res.data) {
          supabase.from('expense_entries').select('*').eq('report_id', res.data.id).order('expense_date')
            .then(function(eRes) {
              var all = eRes.data || [];
              var filtered = all.filter(function(e) {
                return e.category === '旅費交通費' && (e.travel_method === '電車' || e.travel_method === 'バス');
              });
              setTransportEntries(filtered);
            });
        } else {
          setTransportEntries([]);
        }
      })
      .catch(function() { setTransportEntries([]); });
  }


  function handleAdminSaveRows() {
    var promises = editRows.map(function(r) {
      if (!r.id) return Promise.resolve();
      return supabase.from('attendance_rows').update({
        start_time: r.start_time, end_time: r.end_time,
        deduction: r.deduction, work_hours: r.work_hours,
        work_content: r.work_content, work_type: r.work_type || '通常',
      }).eq('id', r.id);
    });
    Promise.all(promises).then(function() {
      flash('保存しました'); setEditing(false);
      viewDetail(detailView.user);
    }).catch(function() { flash('保存に失敗しました'); });
  }

  function onAdminCellChange(index, updatedRow) {
    var newRows = editRows.slice();
    newRows[index] = Object.assign({}, newRows[index], updatedRow);
    setEditRows(newRows);
  }

  function prevMonth() { if (month === 1) { setMonth(12); setYear(year - 1); } else { setMonth(month - 1); } }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(year + 1); } else { setMonth(month + 1); } }


  // 詳細ビュー
  if (detailView) {
    var rpt = detailView.report;
    var u = detailView.user;
    var displayRows = editing ? editRows : detailView.rows;

    return (
      <div className="admin-page">
        {toast && <div className="toast">{toast}</div>}
        <div className="month-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="btn-ghost" onClick={function() { setDetailView(null); setEditing(false); setShowReject(false); }}>← 戻る</button>
            <h2 className="month-title">{u.full_name} — {year}年{month}月</h2>
          </div>
          <div className="header-actions">
            {!editing && (
              <button className="btn-outline" onClick={function() { setEditing(true); }}>✏️ 編集</button>
            )}
            {editing && (
              <>
                <button className="btn-submit" onClick={handleAdminSaveRows}>💾 保存</button>
                <button className="btn-outline" onClick={function() { setEditing(false); setEditRows(detailView.rows.map(function(r){return Object.assign({},r);})); }}>キャンセル</button>
              </>
            )}
            <button className="btn-outline" onClick={function() { exportAttendanceExcel(detailView.rows, year, month, u.full_name, transportEntries); }}>📊 Excel</button>
          </div>
        </div>

        <AttendanceTable rows={displayRows} onCellChange={editing ? onAdminCellChange : null} readOnly={!editing} />

        {/* 交通費セクション */}
        {transportEntries.length > 0 && (
          <div className="card" style={{ marginTop: '16px' }}>
            <h3 className="card-title">🚃 交通費（電車・バス）</h3>
            <table className="admin-table" style={{fontSize:'13px'}}>
              <thead><tr>
                <th style={{textAlign:'center',width:'80px'}}>日付</th>
                <th style={{textAlign:'center',width:'60px'}}>手段</th>
                <th style={{textAlign:'left'}}>区間</th>
                <th style={{textAlign:'center',width:'60px'}}>種別</th>
                <th style={{textAlign:'right',width:'100px'}}>金額</th>
              </tr></thead>
              <tbody>
                {transportEntries.map(function(e){
                  var dt = e.expense_date ? new Date(e.expense_date) : null;
                  var dateStr = dt ? dt.getFullYear()+'/'+String(dt.getMonth()+1).padStart(2,'0')+'/'+String(dt.getDate()).padStart(2,'0') : '';
                  return (
                    <tr key={e.id} className="admin-table-row">
                      <td style={{textAlign:'center'}}>{dateStr}</td>
                      <td style={{textAlign:'center'}}>{e.travel_method}</td>
                      <td style={{textAlign:'left'}}>{(e.travel_from||'')+'→'+(e.travel_to||'')}</td>
                      <td style={{textAlign:'center'}}>{e.trip_type}</td>
                      <td style={{textAlign:'right',fontFamily:'var(--mono)',fontWeight:600}}>¥{e.amount.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{background:'var(--bg)'}}>
                  <td colSpan={4} style={{textAlign:'right',fontWeight:700,padding:'10px 8px'}}>交通費合計</td>
                  <td style={{textAlign:'right',fontFamily:'var(--mono)',fontWeight:700,fontSize:'14px',padding:'10px 8px'}}>¥{transportEntries.reduce(function(s,e){return s+e.amount;},0).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    );
  }

  // 月別一覧
  return (
    <div className="admin-page">
      {toast && <div className="toast">{toast}</div>}
      <div className="month-header">
        <div className="month-nav">
          <button className="btn-icon" onClick={prevMonth}>◀</button>
          <h2 className="month-title">{year}年{month}月</h2>
          <button className="btn-icon" onClick={nextMonth}>▶</button>
        </div>
        <div className="header-actions">
          <span className="admin-summary">全{users.length}名</span>
        </div>
      </div>
      {loading ? (
        <div className="page-loading"><div className="spinner"></div><span>読み込み中...</span></div>
      ) : (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <table className="admin-table">
            <thead><tr>
              <th style={{ textAlign: 'left' }}>氏名</th>
              <th style={{ textAlign: 'left' }}>メールアドレス</th>
              <th style={{ textAlign: 'center', width: '100px' }}>登録状況</th>
              <th style={{ textAlign: 'center', width: '100px' }}>操作</th>
            </tr></thead>
            <tbody>
              {users.map(function(u) {
                return (
                  <tr key={u.id} className="admin-table-row">
                    <td className="admin-table-name">{u.full_name}{u.role === 'admin' && <span className="admin-role-badge">管理者</span>}</td>
                    <td className="admin-table-email">{u.email}</td>
                    <td style={{ textAlign: 'center' }}>{u.report ? <span className="status-badge badge-approved">登録済</span> : <span className="status-badge badge-none">未作成</span>}</td>
                    <td style={{ textAlign: 'center' }}>
                      {u.report ? (
                        <button className="btn-small" onClick={function() { viewDetail(u); }}>詳細</button>
                      ) : (<span className="admin-no-data">—</span>)}
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
