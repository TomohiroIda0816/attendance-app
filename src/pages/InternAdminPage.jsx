import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { openInternAttendancePDF, openInternDailyPDF } from '../lib/internPdf';

var DOW = ['日','月','火','水','木','金','土'];

function fmtDate(d) {
  if (!d) return '';
  var dt = new Date(d);
  return dt.getFullYear()+'/'+String(dt.getMonth()+1).padStart(2,'0')+'/'+String(dt.getDate()).padStart(2,'0');
}

export default function InternAdminPage() {
  var now = new Date();
  var _y = useState(now.getFullYear()), year = _y[0], setYear = _y[1];
  var _m = useState(now.getMonth()+1), month = _m[0], setMonth = _m[1];
  var _interns = useState([]), interns = _interns[0], setInterns = _interns[1];
  var _ld = useState(true), loading = _ld[0], setLoading = _ld[1];
  var _detail = useState(null), detail = _detail[0], setDetail = _detail[1];
  var _tab = useState('attendance'), tab = _tab[0], setTab = _tab[1];
  var _reportDetail = useState(null), reportDetail = _reportDetail[0], setReportDetail = _reportDetail[1];

  function loadData() {
    setLoading(true); setDetail(null); setReportDetail(null);
    var startDate = year+'-'+String(month).padStart(2,'0')+'-01';
    var lastDay = new Date(year, month, 0).getDate();
    var endDate = year+'-'+String(month).padStart(2,'0')+'-'+String(lastDay).padStart(2,'0');
    supabase.from('profiles').select('*').eq('account_type','インターン').order('full_name')
      .then(function(profRes) {
        if (!profRes.data || profRes.data.length === 0) { setInterns([]); setLoading(false); return; }
        return supabase.from('intern_daily_reports').select('*')
          .gte('report_date', startDate)
          .lte('report_date', endDate)
          .order('report_date', { ascending: false })
          .then(function(repRes) {
            var allReports = repRes.data || [];
            var result = profRes.data.map(function(p) {
              var userReports = allReports.filter(function(r){return r.user_id===p.id;});
              var totalMin = 0;
              userReports.forEach(function(r) {
                if (r.work_hours) { var sp=r.work_hours.split(':'); totalMin+=parseInt(sp[0])*60+parseInt(sp[1]||0); }
              });
              return { id: p.id, full_name: p.full_name, email: p.email, reports: userReports, days: userReports.length, totalHours: Math.floor(totalMin/60)+':'+String(totalMin%60).padStart(2,'0') };
            });
            setInterns(result);
          });
      })
      .catch(function(){setInterns([]);})
      .finally(function(){setLoading(false);});
  }

  useEffect(function(){loadData();}, [year, month]);

  function prevMonth(){if(month===1){setMonth(12);setYear(year-1);}else{setMonth(month-1);}}
  function nextMonth(){if(month===12){setMonth(1);setYear(year+1);}else{setMonth(month+1);}}

  // 個別日報詳細
  if (reportDetail) {
    var d = reportDetail;
    return (
      <div className="intern-page">
        <div className="month-header">
          <button className="btn-ghost" onClick={function(){setReportDetail(null);}}>← 戻る</button>
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
        </div>
      </div>
    );
  }

  // ユーザー別詳細（タブ付き）
  if (detail) {
    var u = detail;
    var reportMap = {};
    u.reports.forEach(function(r){ reportMap[new Date(r.report_date).getDate()] = r; });
    var daysInMonth = new Date(year, month, 0).getDate();

    return (
      <div className="intern-page">
        <div className="month-header">
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            <button className="btn-ghost" onClick={function(){setDetail(null);setTab('attendance');}}>← 戻る</button>
            <h2 className="month-title">{u.full_name} — {year}年{month}月</h2>
          </div>
          <div className="header-actions">
            <span className="intern-summary">{u.days}日出勤 / 合計 {u.totalHours}</span>
            <button className="btn-outline" onClick={function(){
              if (tab==='attendance') openInternAttendancePDF(u.reports, year, month, u.full_name);
              else openInternDailyPDF(u.reports, year, month, u.full_name);
            }}>📄 PDF</button>
          </div>
        </div>

        <div className="intern-tabs">
          <button className={'intern-tab'+(tab==='attendance'?' intern-tab-active':'')} onClick={function(){setTab('attendance');}}>📊 勤怠一覧</button>
          <button className={'intern-tab'+(tab==='daily'?' intern-tab-active':'')} onClick={function(){setTab('daily');}}>📝 日報一覧</button>
        </div>

        {/* 勤怠一覧 */}
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
                    <tr key={day} className={rowCls} style={{cursor:r?'pointer':'default'}} onClick={function(){if(r)setReportDetail(r);}}>
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
                  <td style={{textAlign:'center',fontFamily:'var(--mono)',fontWeight:700}}>{u.totalHours}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* 日報一覧 */}
        {tab === 'daily' && (
          u.reports.length === 0 ? (
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
                  {u.reports.map(function(r){
                    return (
                      <tr key={r.id} className="admin-table-row" style={{cursor:'pointer'}} onClick={function(){setReportDetail(r);}}>
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

  // メイン：インターン生一覧
  return (
    <div className="intern-page">
      <div className="month-header">
        <div className="month-nav">
          <button className="btn-icon" onClick={prevMonth}>◀</button>
          <h2 className="month-title">{year}年{month}月</h2>
          <button className="btn-icon" onClick={nextMonth}>▶</button>
        </div>
      </div>
      {loading ? (<div className="page-loading"><div className="spinner"></div></div>) : interns.length===0 ? (
        <div className="card"><p className="empty-state">インターン生のアカウントはまだありません。</p></div>
      ) : (
        <div className="card" style={{padding:'0',overflow:'hidden'}}>
          <table className="admin-table">
            <thead><tr>
              <th style={{textAlign:'left'}}>氏名</th>
              <th style={{textAlign:'center',width:'100px'}}>出勤日数</th>
              <th style={{textAlign:'center',width:'100px'}}>合計稼働</th>
              <th style={{textAlign:'center',width:'80px'}}>操作</th>
            </tr></thead>
            <tbody>
              {interns.map(function(u){
                return (
                  <tr key={u.id} className="admin-table-row">
                    <td className="admin-table-name">{u.full_name}</td>
                    <td style={{textAlign:'center'}}>{u.days}日</td>
                    <td style={{textAlign:'center',fontFamily:'var(--mono)',fontWeight:600}}>{u.totalHours}</td>
                    <td style={{textAlign:'center'}}>
                      <button className="btn-small" onClick={function(){setDetail(u);setTab('attendance');}}>詳細</button>
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
