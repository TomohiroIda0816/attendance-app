import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { openInternAttendancePDF, openInternDailyPDF } from '../lib/internPdf';

var DOW = ['日','月','火','水','木','金','土'];

function fmtDate(d) {
  if (!d) return '';
  var dt = new Date(d);
  return dt.getFullYear()+'/'+String(dt.getMonth()+1).padStart(2,'0')+'/'+String(dt.getDate()).padStart(2,'0');
}
function calcHours(start, end, breakMin) {
  if (!start || !end) return '';
  var sp = start.split(':'), ep = end.split(':');
  var sm = parseInt(sp[0])*60+parseInt(sp[1]), em = parseInt(ep[0])*60+parseInt(ep[1]);
  var diff = em - sm - (breakMin || 0);
  if (diff <= 0) return '0:00';
  return Math.floor(diff/60)+':'+String(diff%60).padStart(2,'0');
}

export default function InternPage() {
  var auth = useAuth();
  var now = new Date();
  var _y = useState(now.getFullYear()), year = _y[0], setYear = _y[1];
  var _m = useState(now.getMonth()+1), month = _m[0], setMonth = _m[1];
  var _tab = useState('attendance'), tab = _tab[0], setTab = _tab[1];
  var _reports = useState([]), reports = _reports[0], setReports = _reports[1];
  var _ld = useState(true), loading = _ld[0], setLoading = _ld[1];
  var _show = useState(false), showForm = _show[0], setShowForm = _show[1];
  var _editId = useState(null), editId = _editId[0], setEditId = _editId[1];
  var _date = useState(now.toISOString().split('T')[0]), rDate = _date[0], setRDate = _date[1];
  var _st = useState(''), startT = _st[0], setStartT = _st[1];
  var _et = useState(''), endT = _et[0], setEndT = _et[1];
  var _brk = useState(''), brk = _brk[0], setBrk = _brk[1];
  var _done = useState(''), taskDone = _done[0], setTaskDone = _done[1];
  var _learn = useState(''), taskLearn = _learn[0], setTaskLearn = _learn[1];
  var _next = useState(''), taskNext = _next[0], setTaskNext = _next[1];
  var _saving = useState(false), saving = _saving[0], setSaving = _saving[1];
  var _t = useState(''), toast = _t[0], setToast = _t[1];
  var _detail = useState(null), detail = _detail[0], setDetail = _detail[1];

  function flash(msg) { setToast(msg); setTimeout(function(){setToast('');}, 2500); }

  function loadData() {
    if (!auth.user) return;
    setLoading(true);
    var startDate = year+'-'+String(month).padStart(2,'0')+'-01';
    var lastDay = new Date(year, month, 0).getDate();
    var endDate = year+'-'+String(month).padStart(2,'0')+'-'+String(lastDay).padStart(2,'0');
    supabase.from('intern_daily_reports').select('*')
      .eq('user_id', auth.user.id)
      .gte('report_date', startDate)
      .lte('report_date', endDate)
      .order('report_date', { ascending: false })
      .then(function(res) {
        if (res.error) { console.error(res.error); setReports([]); }
        else { setReports(res.data || []); }
      })
      .catch(function() { setReports([]); })
      .finally(function() { setLoading(false); });
  }

  useEffect(function() { loadData(); }, [auth.user, year, month]);

  function resetForm() {
    setRDate(now.toISOString().split('T')[0]);
    setStartT(''); setEndT(''); setBrk('');
    setTaskDone(''); setTaskLearn(''); setTaskNext('');
    setEditId(null); setShowForm(false);
  }

  function handleSave() {
    if (!rDate || !startT || !endT) { flash('日付・開始・終了は必須です'); return; }
    var brkMin = parseInt(brk) || 0;
    var wh = calcHours(startT, endT, brkMin);
    setSaving(true);
    var data = {
      user_id: auth.user.id, report_date: rDate,
      start_time: startT, end_time: endT, break_minutes: brkMin,
      work_hours: wh, task_done: taskDone, task_learned: taskLearn, task_next: taskNext,
    };
    var p = editId
      ? supabase.from('intern_daily_reports').update(data).eq('id', editId)
      : supabase.from('intern_daily_reports').insert(data);
    p.then(function(res) {
      if (res.error) throw res.error;
      flash(editId ? '更新しました' : '日報を登録しました');
      resetForm(); loadData();
    })
    .catch(function(err) {
      if (err.message && err.message.includes('duplicate')) flash('この日の日報は既に存在します');
      else flash('保存に失敗しました');
    })
    .finally(function() { setSaving(false); });
  }

  function handleEdit(r) {
    setRDate(r.report_date); setStartT(r.start_time); setEndT(r.end_time);
    setBrk(String(r.break_minutes||'')); setTaskDone(r.task_done);
    setTaskLearn(r.task_learned); setTaskNext(r.task_next);
    setEditId(r.id); setShowForm(true); setDetail(null); setTab('daily');
  }

  function handleDelete(id) {
    if (!confirm('この日報を削除しますか？')) return;
    supabase.from('intern_daily_reports').delete().eq('id', id)
      .then(function() { flash('削除しました'); setDetail(null); loadData(); });
  }

  function prevMonth(){if(month===1){setMonth(12);setYear(year-1);}else{setMonth(month-1);}}
  function nextMonth(){if(month===12){setMonth(1);setYear(year+1);}else{setMonth(month+1);}}

  var totalMinutes = 0;
  reports.forEach(function(r) {
    if (r.work_hours) { var p=r.work_hours.split(':'); totalMinutes+=parseInt(p[0])*60+parseInt(p[1]||0); }
  });
  var totalH = Math.floor(totalMinutes/60)+':'+String(totalMinutes%60).padStart(2,'0');
  var userName = auth.profile ? auth.profile.full_name : '';

  if (loading) return (<div className="page-loading"><div className="spinner"></div><span>読み込み中...</span></div>);

  // 日報詳細
  if (detail) {
    var d = detail;
    return (
      <div className="intern-page">
        {toast && <div className="toast">{toast}</div>}
        <div className="month-header">
          <button className="btn-ghost" onClick={function(){setDetail(null);}}>← 戻る</button>
          <h2 className="month-title">{fmtDate(d.report_date)} の日報</h2>
        </div>
        <div className="card">
          <div className="intern-detail">
            <div className="intern-detail-row">
              <div className="intern-detail-item"><span className="intern-detail-label">勤務時間</span><span className="intern-detail-value">{d.start_time} 〜 {d.end_time}</span></div>
              <div className="intern-detail-item"><span className="intern-detail-label">中抜け</span><span className="intern-detail-value">{d.break_minutes}分</span></div>
              <div className="intern-detail-item"><span className="intern-detail-label">稼働時間</span><span className="intern-detail-value intern-hours">{d.work_hours}</span></div>
            </div>
            <div className="intern-report-section"><h4 className="intern-section-title">📝 やったこと</h4><p className="intern-section-text">{d.task_done || '—'}</p></div>
            <div className="intern-report-section"><h4 className="intern-section-title">💡 わかったこと</h4><p className="intern-section-text">{d.task_learned || '—'}</p></div>
            <div className="intern-report-section"><h4 className="intern-section-title">🚀 次に活かすこと</h4><p className="intern-section-text">{d.task_next || '—'}</p></div>
          </div>
          <div className="trip-detail-actions">
            <button className="btn-outline" onClick={function(){handleEdit(d);}}>✏️ 編集</button>
            <button className="btn-danger" onClick={function(){handleDelete(d.id);}}>🗑 削除</button>
          </div>
        </div>
      </div>
    );
  }

  // 勤怠一覧（カレンダー形式）
  var reportMap = {};
  reports.forEach(function(r){ reportMap[new Date(r.report_date).getDate()] = r; });
  var daysInMonth = new Date(year, month, 0).getDate();

  return (
    <div className="intern-page">
      {toast && <div className="toast">{toast}</div>}

      <div className="month-header">
        <div className="month-nav">
          <button className="btn-icon" onClick={prevMonth}>◀</button>
          <h2 className="month-title">{year}年{month}月</h2>
          <button className="btn-icon" onClick={nextMonth}>▶</button>
        </div>
        <div className="header-actions">
          <span className="intern-summary">{reports.length}日出勤 / 合計 {totalH}</span>
          <button className="btn-outline" onClick={function(){
            if (tab==='attendance') openInternAttendancePDF(reports, year, month, userName);
            else openInternDailyPDF(reports, year, month, userName);
          }}>📄 PDF</button>
        </div>
      </div>

      {/* タブ */}
      <div className="intern-tabs">
        <button className={'intern-tab'+(tab==='attendance'?' intern-tab-active':'')} onClick={function(){setTab('attendance');}}>📊 勤怠一覧</button>
        <button className={'intern-tab'+(tab==='daily'?' intern-tab-active':'')} onClick={function(){setTab('daily');}}>📝 日報一覧</button>
      </div>

      <div style={{marginBottom:'12px'}}>
        <button className="btn-primary" style={{width:'auto',padding:'8px 20px'}} onClick={function(){resetForm();setShowForm(!showForm);setTab('daily');}}>
          {showForm ? '✕ 閉じる' : '📝 日報を書く'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{marginBottom:'16px'}}>
          <h3 className="card-title">{editId ? '日報を編集' : '📝 本日の日報'}</h3>
          <div className="expense-form-grid">
            <div className="form-group"><label className="form-label">日付</label><input className="form-input" type="date" value={rDate} onChange={function(e){setRDate(e.target.value);}} /></div>
            <div className="form-group"><label className="form-label">勤務開始時刻</label><input className="form-input" type="time" step="600" value={startT} onChange={function(e){setStartT(e.target.value);}} /></div>
            <div className="form-group"><label className="form-label">勤務終了時刻</label><input className="form-input" type="time" step="600" value={endT} onChange={function(e){setEndT(e.target.value);}} /></div>
          </div>
          <div className="expense-form-grid" style={{marginTop:'8px',gridTemplateColumns:'1fr 1fr'}}>
            <div className="form-group"><label className="form-label">中抜け時間（分）</label><input className="form-input" type="number" value={brk} onChange={function(e){setBrk(e.target.value);}} placeholder="0" /></div>
            <div className="form-group"><label className="form-label">稼働時間（自動計算）</label><div className="intern-calc-preview">{calcHours(startT, endT, parseInt(brk)||0) || '—'}</div></div>
          </div>
          <div className="form-group" style={{marginTop:'12px'}}><label className="form-label">📝 やったこと</label><textarea className="form-textarea" rows={3} value={taskDone} onChange={function(e){setTaskDone(e.target.value);}} placeholder="今日やったこと..." /></div>
          <div className="form-group"><label className="form-label">💡 わかったこと</label><textarea className="form-textarea" rows={3} value={taskLearn} onChange={function(e){setTaskLearn(e.target.value);}} placeholder="今日わかったこと..." /></div>
          <div className="form-group"><label className="form-label">🚀 次に活かすこと</label><textarea className="form-textarea" rows={3} value={taskNext} onChange={function(e){setTaskNext(e.target.value);}} placeholder="次に活かすこと..." /></div>
          <div style={{display:'flex',gap:'8px',marginTop:'12px'}}>
            <button className="btn-primary" style={{width:'auto',padding:'10px 24px'}} onClick={handleSave} disabled={saving}>{saving?'保存中...':editId?'更新':'登録'}</button>
            <button className="btn-outline" onClick={resetForm}>キャンセル</button>
          </div>
        </div>
      )}

      {/* 勤怠一覧タブ */}
      {tab === 'attendance' && (
        <div className="card" style={{padding:'0',overflow:'hidden'}}>
          <table className="admin-table intern-attendance-table">
            <thead><tr>
              <th style={{width:'35px'}}>日</th>
              <th style={{width:'30px'}}>曜</th>
              <th style={{width:'55px'}}>開始</th>
              <th style={{width:'55px'}}>終了</th>
              <th style={{width:'50px'}}>中抜け</th>
              <th style={{width:'55px'}}>稼働</th>
              <th>やったこと</th>
            </tr></thead>
            <tbody>
              {Array.from({length:daysInMonth}, function(_,i){return i+1;}).map(function(day){
                var dt = new Date(year, month-1, day);
                var dow = dt.getDay();
                var r = reportMap[day];
                var rowCls = dow===0||dow===6 ? 'intern-weekend-row' : '';
                var dowCls = dow===0?'sun':dow===6?'sat':'';
                return (
                  <tr key={day} className={rowCls} style={{cursor:r?'pointer':'default'}} onClick={function(){if(r)setDetail(r);}}>
                    <td style={{textAlign:'center'}}>{day}</td>
                    <td style={{textAlign:'center'}} className={dowCls}>{DOW[dow]}</td>
                    <td style={{textAlign:'center'}}>{r?r.start_time:''}</td>
                    <td style={{textAlign:'center'}}>{r?r.end_time:''}</td>
                    <td style={{textAlign:'center'}}>{r?r.break_minutes+'分':''}</td>
                    <td style={{textAlign:'center',fontFamily:'var(--mono)',fontWeight:r?700:400}}>{r?r.work_hours:''}</td>
                    <td style={{textAlign:'left',maxWidth:'250px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:'11px'}}>{r?r.task_done:''}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{background:'var(--bg)'}}>
                <td colSpan={5} style={{textAlign:'right',fontWeight:700}}>月合計</td>
                <td style={{textAlign:'center',fontFamily:'var(--mono)',fontWeight:700}}>{totalH}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* 日報一覧タブ */}
      {tab === 'daily' && !showForm && (
        reports.length === 0 ? (
          <div className="card"><p className="empty-state">この月の日報はありません。</p></div>
        ) : (
          <div className="card" style={{padding:'0',overflow:'hidden'}}>
            <table className="admin-table">
              <thead><tr>
                <th style={{textAlign:'center',width:'100px'}}>日付</th>
                <th style={{textAlign:'center',width:'120px'}}>勤務時間</th>
                <th style={{textAlign:'center',width:'60px'}}>中抜け</th>
                <th style={{textAlign:'center',width:'70px'}}>稼働</th>
                <th style={{textAlign:'left'}}>やったこと</th>
              </tr></thead>
              <tbody>
                {reports.map(function(r){
                  return (
                    <tr key={r.id} className="admin-table-row" style={{cursor:'pointer'}} onClick={function(){setDetail(r);}}>
                      <td style={{textAlign:'center'}}>{fmtDate(r.report_date)}</td>
                      <td style={{textAlign:'center'}}>{r.start_time}〜{r.end_time}</td>
                      <td style={{textAlign:'center'}}>{r.break_minutes}分</td>
                      <td style={{textAlign:'center',fontFamily:'var(--mono)',fontWeight:600}}>{r.work_hours}</td>
                      <td style={{textAlign:'left',maxWidth:'200px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.task_done}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
