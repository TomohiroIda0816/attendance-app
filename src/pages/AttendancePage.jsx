import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { generateMonthRows, calcWorkHours, TIME_OPTIONS, DEDUCTION_OPTIONS } from '../lib/utils';
import { exportAttendanceExcel } from '../lib/attendanceExcel';
import AttendanceTable from '../components/AttendanceTable';

export default function AttendancePage() {
  var auth = useAuth();
  var _y = useState(new Date().getFullYear()), year = _y[0], setYear = _y[1];
  var _m = useState(new Date().getMonth() + 1), month = _m[0], setMonth = _m[1];
  var _r = useState([]), rows = _r[0], setRows = _r[1];
  var _rid = useState(null), reportId = _rid[0], setReportId = _rid[1];
  var _st = useState(null), status = _st[0], setStatus = _st[1];
  var _def = useState(null), defaults = _def[0], setDefaults = _def[1];
  var _ld = useState(true), loading = _ld[0], setLoading = _ld[1];
  var _sv = useState(false), saving = _sv[0], setSaving = _sv[1];
  var _t = useState(''), toast = _t[0], setToast = _t[1];
  var _defSettings = useState({ start_time: '09:00', end_time: '18:00', deduction: '01:00', work_content: '通常勤務', transport: 0 });
  var defSettings = _defSettings[0], setDefSettings = _defSettings[1];
  var _savingDef = useState(false), savingDef = _savingDef[0], setSavingDef = _savingDef[1];
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
        if (res.data) {
          setDefaults(res.data);
          setDefSettings({
            start_time: res.data.start_time || '09:00',
            end_time: res.data.end_time || '18:00',
            deduction: res.data.deduction || '01:00',
            work_content: res.data.work_content || '通常勤務',
            transport: res.data.transport || 0,
          });
          return res.data;
        }
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
          work_content: row.work_content,
          work_type: row.work_type || '通常',
        }).eq('id', row.id).then(function() {}).catch(function() {});
      }
    }, 800);
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
        return Promise.resolve();
      })
      .then(function() { flash('デフォルト設定で再生成しました'); })
      .catch(function() { flash('再生成に失敗しました'); })
      .finally(function() { setSaving(false); });
  }

  function handleSaveDefSettings() {
    setSavingDef(true);
    supabase.from('default_settings').update(defSettings).eq('user_id', auth.user.id)
      .then(function() {
        setDefaults(Object.assign({}, defaults, defSettings));
        flash('デフォルト設定を保存しました');
      })
      .catch(function() { flash('設定の保存に失敗しました'); })
      .finally(function() { setSavingDef(false); });
  }

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(year - 1); } else { setMonth(month - 1); }
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(year + 1); } else { setMonth(month + 1); }
  }

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
          <button className="btn-outline" onClick={handleRegenerate} disabled={saving}>🔄 再生成</button>
          <button className="btn-outline" onClick={function() { exportAttendanceExcel(rows, year, month, auth.profile ? auth.profile.full_name : ''); }}>📊 Excel</button>
        </div>
      </div>
      <div className="card" style={{marginBottom:'16px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
            <h3 className="card-title" style={{margin:0}}>⚙️ デフォルト勤務設定</h3>
            <button className="btn-primary" onClick={handleSaveDefSettings} disabled={savingDef} style={{padding:'6px 16px',fontSize:'12px'}}>{savingDef ? '保存中...' : '設定を保存'}</button>
          </div>
          <p className="card-desc" style={{marginBottom:'10px'}}>平日に自動入力される値を設定します。変更後「🔄 再生成」で現在の月に反映できます。</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))',gap:'10px'}}>
            <div className="form-group" style={{marginBottom:0}}>
              <label className="form-label" style={{fontSize:'11px'}}>開始時間</label>
              <select className="form-select" value={defSettings.start_time} onChange={function(e){setDefSettings(Object.assign({},defSettings,{start_time:e.target.value}));}}>
                {TIME_OPTIONS.map(function(t){return <option key={t} value={t}>{t||'---'}</option>;})}
              </select>
            </div>
            <div className="form-group" style={{marginBottom:0}}>
              <label className="form-label" style={{fontSize:'11px'}}>終了時間</label>
              <select className="form-select" value={defSettings.end_time} onChange={function(e){setDefSettings(Object.assign({},defSettings,{end_time:e.target.value}));}}>
                {TIME_OPTIONS.map(function(t){return <option key={t} value={t}>{t||'---'}</option>;})}
              </select>
            </div>
            <div className="form-group" style={{marginBottom:0}}>
              <label className="form-label" style={{fontSize:'11px'}}>控除時間</label>
              <select className="form-select" value={defSettings.deduction} onChange={function(e){setDefSettings(Object.assign({},defSettings,{deduction:e.target.value}));}}>
                {DEDUCTION_OPTIONS.map(function(t){return <option key={t} value={t}>{t||'---'}</option>;})}
              </select>
            </div>
            <div className="form-group" style={{marginBottom:0}}>
              <label className="form-label" style={{fontSize:'11px'}}>稼動内容</label>
              <input className="form-input" value={defSettings.work_content} onChange={function(e){setDefSettings(Object.assign({},defSettings,{work_content:e.target.value}));}} />
            </div>
            <div className="form-group" style={{marginBottom:0}}>
              <label className="form-label" style={{fontSize:'11px'}}>通勤交通費（円/日）</label>
              <input className="form-input" type="number" value={defSettings.transport} onChange={function(e){setDefSettings(Object.assign({},defSettings,{transport:Number(e.target.value)||0}));}} placeholder="0" />
            </div>
          </div>
        </div>
      <AttendanceTable rows={rows} onCellChange={onCellChange} readOnly={false} defaults={defaults} />

    </div>
  );
}
