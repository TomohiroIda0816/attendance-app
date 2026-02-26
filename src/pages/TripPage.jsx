import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { exportTripExcel } from '../lib/tripExcel';

var LUNCH = 1500;
var DINNER = 2000;

function calcAllowance(dep, ret, arrivalTime) {
  if (!dep || !ret) return { nights: 0, lunchDays: 0, lunch: 0, dinner: 0, total: 0 };
  var d1 = new Date(dep), d2 = new Date(ret);
  var diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  if (diff < 0) diff = 0;
  var nights = diff, days = nights + 1;
  var lunchDays = arrivalTime === '午後' ? days - 1 : days;
  if (lunchDays < 0) lunchDays = 0;
  return { nights: nights, lunchDays: lunchDays, lunch: lunchDays * LUNCH, dinner: nights * DINNER, total: lunchDays * LUNCH + nights * DINNER };
}

function fmtDate(d) {
  if (!d) return '';
  var dt = new Date(d);
  return dt.getFullYear() + '/' + String(dt.getMonth()+1).padStart(2,'0') + '/' + String(dt.getDate()).padStart(2,'0');
}


export default function TripPage() {
  var auth = useAuth();
  var now = new Date();
  var _y = useState(now.getFullYear()), year = _y[0], setYear = _y[1];
  var _m = useState(now.getMonth()+1), month = _m[0], setMonth = _m[1];
  var _rid = useState(null), reportId = _rid[0], setReportId = _rid[1];
  var _st = useState('下書き'), status = _st[0], setStatus = _st[1];
  var _entries = useState([]), entries = _entries[0], setEntries = _entries[1];
  var _ld = useState(true), loading = _ld[0], setLoading = _ld[1];
  var _show = useState(false), showForm = _show[0], setShowForm = _show[1];
  var _editId = useState(null), editId = _editId[0], setEditId = _editId[1];
  var _dep = useState(''), dep = _dep[0], setDep = _dep[1];
  var _ret = useState(''), ret = _ret[0], setRet = _ret[1];
  var _dest = useState(''), dest = _dest[0], setDest = _dest[1];
  var _arrTime = useState('午前'), arrTime = _arrTime[0], setArrTime = _arrTime[1];
  var _saving = useState(false), saving = _saving[0], setSaving = _saving[1];
  var _t = useState(''), toast = _t[0], setToast = _t[1];
  var _checked = useState({}), checked = _checked[0], setChecked = _checked[1];

  function flash(msg) { setToast(msg); setTimeout(function(){setToast('');}, 2500); }

  function loadData() {
    if (!auth.user) return;
    setLoading(true);
    supabase.from('trip_monthly_reports').select('*')
      .eq('user_id', auth.user.id).eq('year', year).eq('month', month).single()
      .then(function(res) {
        if (res.data) {
          setReportId(res.data.id); setStatus(res.data.status);
          return supabase.from('trip_entries').select('*').eq('report_id', res.data.id).order('departure_date')
            .then(function(eRes) { setEntries(eRes.data || []); });
        } else {
          return supabase.from('trip_monthly_reports')
            .insert({ user_id: auth.user.id, year: year, month: month, status: '下書き' })
            .select().single()
            .then(function(newRes) {
              if (newRes.data) { setReportId(newRes.data.id); setStatus('下書き'); }
              setEntries([]);
            });
        }
      })
      .catch(function() { setEntries([]); })
      .finally(function() { setLoading(false); });
  }

  useEffect(function() { loadData(); }, [auth.user, year, month]);

  function resetForm() { setDep(''); setRet(''); setDest(''); setArrTime('午前'); setEditId(null); setShowForm(false); }

  function handleSave() {
    if (!dep || !ret || !dest.trim()) { flash('すべての項目を入力してください'); return; }
    var a = calcAllowance(dep, ret, arrTime);
    if (new Date(ret) < new Date(dep)) { flash('帰着日は出発日以降にしてください'); return; }
    setSaving(true);
    var data = {
      report_id: reportId, departure_date: dep, return_date: ret,
      destination: dest.trim(), nights: a.nights, arrival_time: arrTime,
      lunch_allowance: a.lunch, dinner_allowance: a.dinner, total_allowance: a.total,
    };
    var p = editId
      ? supabase.from('trip_entries').update(data).eq('id', editId)
      : supabase.from('trip_entries').insert(data);
    p.then(function() { flash(editId ? '更新しました' : '登録しました'); resetForm(); loadData(); })
      .catch(function() { flash('保存に失敗しました'); })
      .finally(function() { setSaving(false); });
  }

  function handleEdit(e) {
    setDep(e.departure_date); setRet(e.return_date); setDest(e.destination);
    setArrTime(e.arrival_time || '午前'); setEditId(e.id); setShowForm(true);
  }

  function handleDeleteEntry(id) {
    if (!confirm('この出張記録を削除しますか？')) return;
    supabase.from('trip_entries').delete().eq('id', id)
      .then(function() { flash('削除しました'); loadData(); })
      .catch(function() { flash('削除に失敗しました'); });
  }


  function prevMonth() { if (month===1){setMonth(12);setYear(year-1);}else{setMonth(month-1);} }
  function nextMonth() { if (month===12){setMonth(1);setYear(year+1);}else{setMonth(month+1);} }

  var allow = calcAllowance(dep, ret, arrTime);
  var grandTotal = 0;
  entries.forEach(function(e) { grandTotal += e.total_allowance; });
  var isEditable = true;

  var checkedIds = Object.keys(checked).filter(function(k){return checked[k];});
  var allChecked = entries.length > 0 && checkedIds.length === entries.length;

  function toggleCheck(id) {
    var next = Object.assign({}, checked);
    next[id] = !next[id];
    setChecked(next);
  }
  function toggleAll() {
    if (allChecked) { setChecked({}); }
    else {
      var next = {};
      entries.forEach(function(e){next[e.id]=true;});
      setChecked(next);
    }
  }
  function handleBatchDelete() {
    if (checkedIds.length === 0) { flash('削除する項目を選択してください'); return; }
    if (!confirm(checkedIds.length+'件を削除しますか？')) return;
    setSaving(true);
    Promise.all(checkedIds.map(function(id){
      return supabase.from('trip_entries').delete().eq('id', id);
    })).then(function(){
      flash(checkedIds.length+'件削除しました');
      setChecked({}); loadData();
    }).catch(function(){ flash('削除に失敗しました'); })
    .finally(function(){ setSaving(false); });
  }

  if (loading) return (<div className="page-loading"><div className="spinner"></div><span>読み込み中...</span></div>);

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
          <button className="btn-outline" onClick={function(){exportTripExcel(entries,year,month,auth.profile?auth.profile.full_name:'');}}>📊 Excel</button>
        </div>
      </div>

      {/* 新規登録ボタン */}
      {isEditable && (
        <div style={{marginBottom:'12px'}}>
          <button className="btn-primary" style={{width:'auto',padding:'8px 20px'}} onClick={function(){resetForm();setShowForm(!showForm);}}>
            {showForm ? '✕ 閉じる' : '＋ 出張を追加'}
          </button>
        </div>
      )}

      {/* 入力フォーム */}
      {showForm && isEditable && (
        <div className="card" style={{marginBottom:'16px'}}>
          <h3 className="card-title">{editId ? '出張を編集' : '新規出張'}</h3>
          <div className="trip-form-grid">
            <div className="form-group">
              <label className="form-label">出張先</label>
              <input className="form-input" value={dest} onChange={function(e){setDest(e.target.value);}} placeholder="例: 大阪本社" />
            </div>
            <div className="form-group">
              <label className="form-label">出発日</label>
              <input className="form-input" type="date" value={dep} onChange={function(e){setDep(e.target.value);}} />
            </div>
            <div className="form-group">
              <label className="form-label">帰着日</label>
              <input className="form-input" type="date" value={ret} onChange={function(e){setRet(e.target.value);}} />
            </div>
            <div className="form-group">
              <label className="form-label">目的地への到着</label>
              <select className="form-input" value={arrTime} onChange={function(e){setArrTime(e.target.value);}}>
                <option value="午前">午前着</option>
                <option value="午後">午後着</option>
              </select>
            </div>
          </div>
          {dep && ret && (
            <div className="trip-preview">
              <div className="trip-preview-row">
                <span>{allow.nights}泊{allow.nights+1}日（{arrTime}着）</span>
                <span>昼食代: &yen;{allow.lunch.toLocaleString()}{arrTime==='午後' ? '（1日目昼食なし）' : ''}</span>
                <span>夕食代: &yen;{allow.dinner.toLocaleString()}</span>
                <span className="trip-preview-total">合計: &yen;{allow.total.toLocaleString()}</span>
              </div>
            </div>
          )}
          <div style={{display:'flex',gap:'8px',marginTop:'16px'}}>
            <button className="btn-primary" style={{width:'auto',padding:'10px 24px'}} onClick={handleSave} disabled={saving}>{saving?'保存中...':editId?'更新':'登録'}</button>
            <button className="btn-outline" onClick={resetForm}>キャンセル</button>
          </div>
        </div>
      )}

      {/* 出張一覧テーブル */}
      {entries.length === 0 ? (
        <div className="card"><p className="empty-state">この月の出張記録はありません。{isEditable ? '「出張を追加」から登録してください。' : ''}</p></div>
      ) : (
        <>
          {/* 一括操作バー */}
          {checkedIds.length > 0 && isEditable && (
            <div className="batch-action-bar">
              <div className="batch-action-left">
                <button className="btn-danger" style={{fontSize:'12px',padding:'6px 14px'}} onClick={handleBatchDelete}>🗑 選択した{checkedIds.length}件を削除</button>
              </div>
            </div>
          )}
        <div className="card" style={{padding:'0',overflow:'hidden'}}>
          <table className="admin-table">
            <thead>
              <tr>
                {isEditable && <th style={{textAlign:'center',width:'36px'}}><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>}
                <th style={{textAlign:'left'}}>出張先</th>
                <th style={{textAlign:'center'}}>出発日</th>
                <th style={{textAlign:'center'}}>帰着日</th>
                <th style={{textAlign:'center'}}>到着</th>
                <th style={{textAlign:'center'}}>泊数</th>
                <th style={{textAlign:'right'}}>昼食代</th>
                <th style={{textAlign:'right'}}>夕食代</th>
                <th style={{textAlign:'right'}}>手当合計</th>
                {isEditable && <th style={{textAlign:'center',width:'100px'}}>操作</th>}
              </tr>
            </thead>
            <tbody>
              {entries.map(function(e){
                return (
                  <tr key={e.id} className={'admin-table-row'+(checked[e.id]?' row-checked':'')}>
                    {isEditable && (
                      <td style={{textAlign:'center'}}>
                        <input type="checkbox" checked={!!checked[e.id]} onChange={function(){toggleCheck(e.id);}} />
                      </td>
                    )}
                    <td style={{fontWeight:600}}>{e.destination}</td>
                    <td style={{textAlign:'center'}}>{fmtDate(e.departure_date)}</td>
                    <td style={{textAlign:'center'}}>{fmtDate(e.return_date)}</td>
                    <td style={{textAlign:'center'}}>{e.arrival_time || '午前'}着</td>
                    <td style={{textAlign:'center'}}>{e.nights}泊</td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>¥{e.lunch_allowance.toLocaleString()}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>¥{e.dinner_allowance.toLocaleString()}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)',fontWeight:600}}>¥{e.total_allowance.toLocaleString()}</td>
                    {isEditable && (
                      <td style={{textAlign:'center'}}>
                        <div className="admin-actions">
                          <button className="btn-small" onClick={function(){handleEdit(e);}}>編集</button>
                          <button className="btn-small btn-small-reject" onClick={function(){handleDeleteEntry(e.id);}}>削除</button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{background:'var(--bg)'}}>
                <td colSpan={isEditable?8:7} style={{textAlign:'right',fontWeight:700,padding:'10px 8px'}}>月合計</td>
                <td style={{textAlign:'right',fontFamily:'var(--mono)',fontWeight:700,fontSize:'14px',padding:'10px 8px'}}>¥{grandTotal.toLocaleString()}</td>
                {isEditable && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
