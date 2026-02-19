import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { openPrintPDF } from '../lib/pdf';
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
  var _showReject = useState(false), showReject = _showReject[0], setShowReject = _showReject[1];
  var _comments = useState({}), comments = _comments[0], setComments = _comments[1];

  function flash(msg) { setToast(msg); setTimeout(function() { setToast(''); }, 2500); }

  function loadMonthData() {
    setLoading(true); setDetailView(null); setEditing(false); setShowReject(false);
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
        var c = {};
        rows.forEach(function(r) { c[r.day] = r.admin_comment || ''; });
        setComments(c);
      });
  }

  function updateStatus(reportId, newStatus) {
    supabase.from('monthly_reports').update({ status: newStatus }).eq('id', reportId)
      .then(function() {
        flash('ステータスを「' + newStatus + '」に更新しました');
        loadMonthData();
      })
      .catch(function() { flash('更新に失敗しました'); });
  }

  function handleRejectWithComments() {
    if (!detailView) return;
    var hasComment = false;
    Object.keys(comments).forEach(function(k) { if (comments[k].trim()) hasComment = true; });
    // コメントをDBに保存
    var promises = editRows.map(function(r) {
      if (r.id && comments[r.day] !== undefined) {
        return supabase.from('attendance_rows').update({ admin_comment: comments[r.day] || '' }).eq('id', r.id);
      }
      return Promise.resolve();
    });
    Promise.all(promises).then(function() {
      return supabase.from('monthly_reports').update({ status: '差戻し' }).eq('id', detailView.report.id);
    }).then(function() {
      flash('コメント付きで差戻しました');
      loadMonthData();
    }).catch(function() { flash('差戻しに失敗しました'); });
  }

  function handleAdminSaveRows() {
    var promises = editRows.map(function(r) {
      if (!r.id) return Promise.resolve();
      return supabase.from('attendance_rows').update({
        start_time: r.start_time, end_time: r.end_time,
        deduction: r.deduction, work_hours: r.work_hours,
        work_content: r.work_content, work_type: r.work_type || '通常',
        admin_comment: comments[r.day] || '',
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

  function statusClass(s) {
    return { '未作成': 'badge-none', '下書き': 'badge-draft', '申請済': 'badge-submitted', '承認済': 'badge-approved', '差戻し': 'badge-rejected' }[s] || 'badge-draft';
  }

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
            <span className={'status-badge ' + statusClass(rpt.status)}>{rpt.status}</span>
            {!editing && (
              <button className="btn-outline" onClick={function() { setEditing(true); setShowReject(false); }}>✏️ 編集</button>
            )}
            {editing && (
              <>
                <button className="btn-submit" onClick={handleAdminSaveRows}>💾 保存</button>
                <button className="btn-outline" onClick={function() { setEditing(false); setEditRows(detailView.rows.map(function(r){return Object.assign({},r);})); }}>キャンセル</button>
              </>
            )}
            {(rpt.status === '申請済' || rpt.status === '差戻し') && (
              <button className="btn-submit" onClick={function() { updateStatus(rpt.id, '承認済'); }}>✓ 承認</button>
            )}
            {rpt.status === '承認済' && (
              <button className="btn-danger" onClick={function() { if(confirm('承認を取り消しますか？')){updateStatus(rpt.id, '申請済');} }}>↩ 承認取消</button>
            )}
            {(rpt.status === '申請済' || rpt.status === '承認済') && (
              <button className="btn-danger" onClick={function() { setShowReject(!showReject); setEditing(false); }}>✗ 差戻し</button>
            )}
            <button className="btn-outline" onClick={function() { openPrintPDF(detailView.rows, year, month, u.full_name, rpt.status); }}>📄 PDF</button>
          </div>
        </div>

        {/* 差戻しコメント入力 */}
        {showReject && (
          <div className="card" style={{ marginBottom: '16px' }}>
            <h3 className="card-title">📝 日別コメントを付けて差戻し</h3>
            <p className="card-desc">問題のある日にコメントを入力してください。コメントなしの日はスキップされます。</p>
            <div className="admin-comment-list">
              {editRows.map(function(r) {
                if (!r.start_time && r.work_type !== '有給' && r.work_type !== '欠勤' && !(r.work_type && r.work_type.includes('半休'))) return null;
                return (
                  <div key={r.day} className="admin-comment-row">
                    <span className="admin-comment-day">{r.day}日 ({r.dow})</span>
                    <span className="admin-comment-info">{r.start_time||''}{r.end_time ? '〜'+r.end_time : ''} {r.work_type && r.work_type !== '通常' ? r.work_type : ''}</span>
                    <input className="form-input admin-comment-input" value={comments[r.day]||''} onChange={function(e) {
                      var c = Object.assign({}, comments);
                      c[r.day] = e.target.value;
                      setComments(c);
                    }} placeholder="コメント（任意）" />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button className="btn-danger" onClick={handleRejectWithComments}>📨 コメント付きで差戻し</button>
              <button className="btn-outline" onClick={function() { setShowReject(false); }}>キャンセル</button>
            </div>
          </div>
        )}

        <AttendanceTable rows={displayRows} onCellChange={editing ? onAdminCellChange : null} readOnly={!editing} />
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
          <span className="admin-summary">全{users.length}名
            {users.filter(function(u) { return u.status === '申請済'; }).length > 0 &&
              <span className="admin-pending"> / 未承認: {users.filter(function(u) { return u.status === '申請済'; }).length}名</span>}
          </span>
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
              <th style={{ textAlign: 'center', width: '100px' }}>ステータス</th>
              <th style={{ textAlign: 'center', width: '160px' }}>操作</th>
            </tr></thead>
            <tbody>
              {users.map(function(u) {
                return (
                  <tr key={u.id} className="admin-table-row">
                    <td className="admin-table-name">{u.full_name}{u.role === 'admin' && <span className="admin-role-badge">管理者</span>}</td>
                    <td className="admin-table-email">{u.email}</td>
                    <td style={{ textAlign: 'center' }}><span className={'status-badge ' + statusClass(u.status)}>{u.status}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      {u.report ? (
                        <div className="admin-actions">
                          <button className="btn-small" onClick={function() { viewDetail(u); }}>詳細</button>
                          {u.status === '申請済' && (<>
                            <button className="btn-small btn-small-approve" onClick={function() { updateStatus(u.report.id, '承認済'); }}>承認</button>
                            <button className="btn-small btn-small-reject" onClick={function() { updateStatus(u.report.id, '差戻し'); }}>差戻</button>
                          </>)}
                          {u.status === '承認済' && (
                            <button className="btn-small btn-small-reject" onClick={function() { if(confirm('承認を取り消しますか？')){updateStatus(u.report.id, '申請済');} }}>承認取消</button>
                          )}
                        </div>
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
