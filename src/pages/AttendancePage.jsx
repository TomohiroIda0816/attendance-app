import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { generateMonthRows, calcWorkHours } from '../lib/utils';
import { openPrintPDF } from '../lib/pdf';
import AttendanceTable from '../components/AttendanceTable';

export default function AttendancePage() {
  var auth = useAuth();
  var _y = useState(new Date().getFullYear()), year = _y[0], setYear = _y[1];
  var _m = useState(new Date().getMonth() + 1), month = _m[0], setMonth = _m[1];
  var _r = useState([]), rows = _r[0], setRows = _r[1];
  var _rid = useState(null), reportId = _rid[0], setReportId = _rid[1];
  var _st = useState('下書き'), status = _st[0], setStatus = _st[1];
  var _def = useState(null), defaults = _def[0], setDefaults = _def[1];
  var _ld = useState(true), loading = _ld[0], setLoading = _ld[1];
  var _sv = useState(false), saving = _sv[0], setSaving = _sv[1];
  var _t = useState(''), toast = _t[0], setToast = _t[1];
  var saveTimer = useRef(null);

  function flash(msg) { setToast(msg); setTimeout(function() { setToast(''); }, 2500); }

  function insertRows(repId, rowsData) {
    var inserts = rowsData.map(function(r) {
      return {
        report_id: repId, day: r.day, dow: r.dow,
        holiday: r.holiday || '', start_time: r.start_time || '',
        end_time: r.end_time || '', deduction: r.deduction || '',
        work_hours: r.work_hours || '', work_content: r.work_content || '',
        transport: Number(r.transport) || 0,
      };
    });
    return supabase.from('attendance_rows').insert(inserts);
  }

  function loadData() {
    if (!auth.user) { setLoading(false); return; }
    setLoading(true);

    var userId = auth.user.id;
    var defs = defaults;

    // デフォルト設定取得
    var p = defs ? Promise.resolve(defs) : supabase
      .from('default_settings').select('*').eq('user_id', userId).single()
      .then(function(res) {
        if (res.data) { setDefaults(res.data); return res.data; }
        return {};
      }).catch(function() { return {}; });

    p.then(function(d) {
      defs = d || {};
      // レポート取得
      return supabase.from('monthly_reports').select('*')
        .eq('user_id', userId).eq('year', year).eq('month', month).single();
    }).then(function(res) {
      if (res.data) {
        setReportId(res.data.id);
        setStatus(res.data.status);
        return supabase.from('attendance_rows').select('*')
          .eq('report_id', res.data.id).order('day')
          .then(function(rowRes) {
            if (rowRes.data && rowRes.data.length > 0) {
              setRows(rowRes.data);
            } else {
              var generated = generateMonthRows(year, month, defs);
              setRows(generated);
              insertRows(res.data.id, generated);
            }
          });
      } else {
        // 新規
        var generated = generateMonthRows(year, month, defs);
        setRows(generated);
        return supabase.from('monthly_reports')
          .insert({ user_id: userId, year: year, month: month, status: '下書き' })
          .select().single()
          .then(function(newRes) {
            if (newRes.data) {
              setReportId(newRes.data.id);
              setStatus('下書き');
              return insertRows(newRes.data.id, generated);
            }
          });
      }
    }).catch(function(err) {
      console.error('Load error:', err);
      var generated = generateMonthRows(year, month, defs || {});
      setRows(generated);
    }).finally(function() {
      setLoading(false);
    });
  }

  useEffect(function() { loadData(); }, [auth.user, year, month]);

  function onCellChange(index, updatedRow) {
    var newRows = rows.slice();
    newRows[index] = Object.assign({}, newRows[index], updatedRow);
    setRows(newRows);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(function() {
      var row = newRows[index];
      if (row.id) {
        supabase.from('attendance_rows').update({
          start_time: row.start_time, end_time: row.end_time,
          deduction: row.deduction, work_hours: row.work_hours,
          work_content: row.work_content, transport: Number(row.transport) || 0,
          work_type: row.work_type || '通常',
        }).eq('id', row.id).then(function() {}).catch(function() {});
      }
    }, 800);
  }

  function handleSubmit() {
    if (!reportId) return;
    setSaving(true);
    supabase.from('monthly_reports')
      .update({ status: '申請済', submitted_at: new Date().toISOString() })
      .eq('id', reportId)
      .then(function() {
        setStatus('申請済');
        flash(year + '年' + month + '月 申請しました');
      })
      .catch(function() { flash('申請に失敗しました'); })
      .finally(function() { setSaving(false); });
  }

  function handleUnsubmit() {
    if (!reportId) return;
    setSaving(true);
    supabase.from('monthly_reports')
      .update({ status: '下書き', submitted_at: null })
      .eq('id', reportId)
      .then(function() {
        setStatus('下書き');
        flash('申請を取り消しました');
      })
      .catch(function() { flash('取り消しに失敗しました'); })
      .finally(function() { setSaving(false); });
  }

  function handleRegenerate() {
    if (!reportId) return;
    setSaving(true);
    supabase.from('attendance_rows').delete().eq('report_id', reportId)
      .then(function() {
        var generated = generateMonthRows(year, month, defaults || {});
        return insertRows(reportId, generated).then(function() {
          return supabase.from('attendance_rows').select('*')
            .eq('report_id', reportId).order('day');
        });
      })
      .then(function(res) {
        if (res.data) setRows(res.data);
        setStatus('下書き');
        return supabase.from('monthly_reports').update({ status: '下書き' }).eq('id', reportId);
      })
      .then(function() { flash('デフォルト設定で再生成しました'); })
      .catch(function() { flash('再生成に失敗しました'); })
      .finally(function() { setSaving(false); });
  }

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(year - 1); } else { setMonth(month - 1); }
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(year + 1); } else { setMonth(month + 1); }
  }

  var statusClass = { '下書き': 'badge-draft', '申請済': 'badge-submitted', '承認済': 'badge-approved', '差戻し': 'badge-rejected' }[status] || 'badge-draft';

  if (loading) {
    return (<div className="page-loading"><div className="spinner"></div><span>読み込み中...</span></div>);
  }

  return (
    <div className="attendance-page">
      {toast && <div className="toast">{toast}</div>}
      <div className="month-header">
        <div className="month-nav">
          <button className="btn-icon" onClick={prevMonth}>◀</button>
          <h2 className="month-title">{year}年{month}月</h2>
          <button className="btn-icon" onClick={nextMonth}>▶</button>
        </div>
        <div className="header-actions">
          <span className={'status-badge ' + statusClass}>{status}</span>
          <button className="btn-outline" onClick={handleRegenerate} disabled={saving}>🔄 再生成</button>
          <button className="btn-outline" onClick={function() { openPrintPDF(rows, year, month, auth.profile ? auth.profile.full_name : '', status); }}>📄 PDF</button>
          {status === '申請済' || status === '承認済' ? (
            <button className="btn-danger" onClick={handleUnsubmit} disabled={saving || status === '承認済'}>{status === '承認済' ? '承認済' : '申請取消'}</button>
          ) : (
            <button className="btn-submit" onClick={handleSubmit} disabled={saving}>✓ 申請</button>
          )}
        </div>
      </div>
      <AttendanceTable rows={rows} onCellChange={onCellChange} readOnly={status === '承認済'} />
    </div>
  );
}
