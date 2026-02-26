import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { exportTripExcel } from '../lib/tripExcel';

var LUNCH = 1500;
var DINNER = 2000;

function fmtDate(d) {
  if (!d) return '';
  var dt = new Date(d);
  return dt.getFullYear()+'/'+String(dt.getMonth()+1).padStart(2,'0')+'/'+String(dt.getDate()).padStart(2,'0');
}

function statusClass(s) {
  return {'未作成':'badge-none','下書き':'badge-draft','申請済':'badge-submitted','承認済':'badge-approved','差戻し':'badge-rejected'}[s]||'badge-draft';
}

export default function TripAdminPage() {
  var auth = useAuth();
  var now = new Date();
  var _y = useState(now.getFullYear()), year = _y[0], setYear = _y[1];
  var _m = useState(now.getMonth()+1), month = _m[0], setMonth = _m[1];
  var _users = useState([]), users = _users[0], setUsers = _users[1];
  var _ld = useState(true), loading = _ld[0], setLoading = _ld[1];
  var _detail = useState(null), detail = _detail[0], setDetail = _detail[1];
  var _t = useState(''), toast = _t[0], setToast = _t[1];

  function flash(msg) { setToast(msg); setTimeout(function(){setToast('');}, 2500); }

  function loadData() {
    setLoading(true); setDetail(null);
    supabase.from('profiles').select('*').order('full_name')
      .then(function(profRes) {
        if (!profRes.data) { setUsers([]); setLoading(false); return; }
        return supabase.from('trip_monthly_reports').select('*').eq('year',year).eq('month',month)
          .then(function(repRes) {
            var reports = repRes.data || [];
            var result = profRes.data.map(function(p) {
              var report = reports.find(function(r){return r.user_id===p.id;});
              return { id:p.id, full_name:p.full_name, email:p.email, role:p.role, report:report||null, status:report?report.status:'未作成' };
            });
            setUsers(result);
          });
      })
      .catch(function(){setUsers([]);})
      .finally(function(){setLoading(false);});
  }

  useEffect(function(){loadData();}, [year, month]);

  function viewDetail(u) {
    if (!u.report) return;
    supabase.from('trip_entries').select('*').eq('report_id',u.report.id).order('departure_date')
      .then(function(res){ setDetail({user:u, entries:res.data||[], report:u.report}); })
      .catch(function(){});
  }

  function updateStatus(reportId, newStatus) {
    supabase.from('trip_monthly_reports').update({status:newStatus}).eq('id',reportId)
      .then(function(){ flash('ステータスを「'+newStatus+'」に更新しました'); setDetail(null); loadData(); })
      .catch(function(){ flash('更新に失敗しました'); });
  }

  function prevMonth(){if(month===1){setMonth(12);setYear(year-1);}else{setMonth(month-1);}}
  function nextMonth(){if(month===12){setMonth(1);setYear(year+1);}else{setMonth(month+1);}}

  // 詳細ビュー
  if (detail) {
    var u = detail.user;
    var rpt = detail.report;
    var ent = detail.entries;
    var grandTotal = 0;
    ent.forEach(function(e){grandTotal += e.total_allowance;});

    return (
      <div className="trip-page">
        {toast && <div className="toast">{toast}</div>}
        <div className="month-header">
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            <button className="btn-ghost" onClick={function(){setDetail(null);}}>← 戻る</button>
            <h2 className="month-title">{u.full_name} — {year}年{month}月</h2>
          </div>
          <div className="header-actions">
            <span className={'status-badge '+statusClass(rpt.status)}>{rpt.status}</span>
            {rpt.status==='申請済' && (
              <>
                <button className="btn-submit" onClick={function(){updateStatus(rpt.id,'承認済');}}>✓ 承認</button>
                <button className="btn-danger" onClick={function(){updateStatus(rpt.id,'差戻し');}}>✗ 差戻し</button>
              </>
            )}
            {rpt.status==='差戻し' && (
              <button className="btn-submit" onClick={function(){updateStatus(rpt.id,'承認済');}}>✓ 承認</button>
            )}
            <button className="btn-outline" onClick={function(){exportTripExcel(ent,year,month,u.full_name,rpt.status);}}>📊 Excel</button>
          </div>
        </div>

        {ent.length===0 ? (
          <div className="card"><p className="empty-state">この月の出張記録はありません。</p></div>
        ) : (
          <div className="card" style={{padding:'0',overflow:'hidden'}}>
            <table className="admin-table">
              <thead><tr>
                <th style={{textAlign:'left'}}>出張先</th>
                <th style={{textAlign:'center'}}>出発日</th>
                <th style={{textAlign:'center'}}>帰着日</th>
                <th style={{textAlign:'center'}}>到着</th>
                <th style={{textAlign:'center'}}>泊数</th>
                <th style={{textAlign:'right'}}>昼食代</th>
                <th style={{textAlign:'right'}}>夕食代</th>
                <th style={{textAlign:'right'}}>手当合計</th>
              </tr></thead>
              <tbody>
                {ent.map(function(e){
                  return (
                    <tr key={e.id} className="admin-table-row">
                      <td style={{fontWeight:600}}>{e.destination}</td>
                      <td style={{textAlign:'center'}}>{fmtDate(e.departure_date)}</td>
                      <td style={{textAlign:'center'}}>{fmtDate(e.return_date)}</td>
                      <td style={{textAlign:'center'}}>{e.arrival_time || '午前'}着</td>
                      <td style={{textAlign:'center'}}>{e.nights}泊</td>
                      <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>¥{e.lunch_allowance.toLocaleString()}</td>
                      <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>¥{e.dinner_allowance.toLocaleString()}</td>
                      <td style={{textAlign:'right',fontFamily:'var(--mono)',fontWeight:600}}>¥{e.total_allowance.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{background:'var(--bg)'}}>
                  <td colSpan={7} style={{textAlign:'right',fontWeight:700,padding:'10px 8px'}}>月合計</td>
                  <td style={{textAlign:'right',fontFamily:'var(--mono)',fontWeight:700,fontSize:'14px',padding:'10px 8px'}}>¥{grandTotal.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    );
  }

  // 月別ユーザー一覧
  return (
    <div className="trip-page">
      {toast && <div className="toast">{toast}</div>}
      <div className="month-header">
        <div className="month-nav">
          <button className="btn-icon" onClick={prevMonth}>◀</button>
          <h2 className="month-title">{year}年{month}月</h2>
          <button className="btn-icon" onClick={nextMonth}>▶</button>
        </div>
        <div className="header-actions">
          <span className="admin-summary">
            全{users.length}名
            {users.filter(function(u){return u.status==='申請済';}).length>0 &&
              <span className="admin-pending"> / 未承認: {users.filter(function(u){return u.status==='申請済';}).length}名</span>
            }
          </span>
        </div>
      </div>

      {loading ? (
        <div className="page-loading"><div className="spinner"></div><span>読み込み中...</span></div>
      ) : (
        <div className="card" style={{padding:'0',overflow:'hidden'}}>
          <table className="admin-table">
            <thead><tr>
              <th style={{textAlign:'left'}}>氏名</th>
              <th style={{textAlign:'left'}}>メールアドレス</th>
              <th style={{textAlign:'center',width:'100px'}}>ステータス</th>
              <th style={{textAlign:'center',width:'160px'}}>操作</th>
            </tr></thead>
            <tbody>
              {users.map(function(u){
                return (
                  <tr key={u.id} className="admin-table-row">
                    <td className="admin-table-name">{u.full_name}{u.role==='admin' && <span className="admin-role-badge">管理者</span>}</td>
                    <td className="admin-table-email">{u.email}</td>
                    <td style={{textAlign:'center'}}><span className={'status-badge '+statusClass(u.status)}>{u.status}</span></td>
                    <td style={{textAlign:'center'}}>
                      {u.report ? (
                        <div className="admin-actions">
                          <button className="btn-small" onClick={function(){viewDetail(u);}}>詳細</button>
                          {u.status==='申請済' && (
                            <>
                              <button className="btn-small btn-small-approve" onClick={function(){updateStatus(u.report.id,'承認済');}}>承認</button>
                              <button className="btn-small btn-small-reject" onClick={function(){updateStatus(u.report.id,'差戻し');}}>差戻</button>
                            </>
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
