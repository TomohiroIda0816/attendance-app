import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';

var TRANSPORT_METHODS = ['電車', 'バス'];
var DOW = ['日','月','火','水','木','金','土'];

function fmtDate(d) {
  if (!d) return '';
  var dt = new Date(d);
  return dt.getFullYear()+'/'+String(dt.getMonth()+1).padStart(2,'0')+'/'+String(dt.getDate()).padStart(2,'0');
}

function getDetail(e) {
  var p = [];
  if (e.travel_from||e.travel_to) p.push((e.travel_from||'')+'→'+(e.travel_to||''));
  if (e.travel_method) p.push(e.travel_method);
  if (e.trip_type) p.push(e.trip_type);
  return p.join(' / ');
}

// カレンダーコンポーネント
function DateCalendar(props) {
  var yr = props.year, mo = props.month, selected = props.selected, onToggle = props.onToggle;
  var firstDay = new Date(yr, mo - 1, 1).getDay();
  var daysInMonth = new Date(yr, mo, 0).getDate();
  var cells = [];
  for (var i = 0; i < firstDay; i++) cells.push(null);
  for (var d = 1; d <= daysInMonth; d++) cells.push(d);

  var selSet = {};
  selected.forEach(function(s) { selSet[s] = true; });

  return (
    <div className="date-calendar">
      <div className="cal-header-row">
        {DOW.map(function(d, i) { return <div key={i} className={'cal-dow' + (i===0?' cal-sun':'') + (i===6?' cal-sat':'')}>{d}</div>; })}
      </div>
      <div className="cal-grid">
        {cells.map(function(day, i) {
          if (day === null) return <div key={'e'+i} className="cal-cell cal-empty"></div>;
          var dateStr = yr + '-' + String(mo).padStart(2,'0') + '-' + String(day).padStart(2,'0');
          var isSelected = !!selSet[dateStr];
          var dow = new Date(yr, mo-1, day).getDay();
          var cls = 'cal-cell cal-day' + (isSelected ? ' cal-selected' : '') + (dow===0?' cal-sun':'') + (dow===6?' cal-sat':'');
          return <div key={day} className={cls} onClick={function(){onToggle(dateStr);}}>{day}</div>;
        })}
      </div>
    </div>
  );
}

export default function TransportExpensePage(props) {
  var hideHeader = props && props.hideHeader;
  var propYear = props && props.propYear;
  var propMonth = props && props.propMonth;
  var onEntriesLoaded = props && props.onEntriesLoaded;

  var auth = useAuth();
  var now = new Date();
  var _y = useState(propYear || now.getFullYear()), year = _y[0], setYear = _y[1];
  var _m = useState(propMonth || now.getMonth()+1), month = _m[0], setMonth = _m[1];
  var _rid = useState(null), reportId = _rid[0], setReportId = _rid[1];
  var _entries = useState([]), entries = _entries[0], setEntries = _entries[1];
  var _ld = useState(true), loading = _ld[0], setLoading = _ld[1];
  // 交通費フォーム
  var _showTransport = useState(false), showTransport = _showTransport[0], setShowTransport = _showTransport[1];
  var _tMeth = useState('電車'), tMeth = _tMeth[0], setTMeth = _tMeth[1];
  var _tF = useState(''), tF = _tF[0], setTF = _tF[1];
  var _tT = useState(''), tT = _tT[0], setTT = _tT[1];
  var _tTy = useState('片道'), tTy = _tTy[0], setTTy = _tTy[1];
  var _tAm = useState(''), tAm = _tAm[0], setTAm = _tAm[1];
  var _tEditId = useState(null), tEditId = _tEditId[0], setTEditId = _tEditId[1];
  var _tEditDate = useState(''), tEditDate = _tEditDate[0], setTEditDate = _tEditDate[1];
  var _selDates = useState([]), selDates = _selDates[0], setSelDates = _selDates[1];
  // お気に入り
  var _favs = useState([]), favs = _favs[0], setFavs = _favs[1];
  var _showFavForm = useState(false), showFavForm = _showFavForm[0], setShowFavForm = _showFavForm[1];
  var _favName = useState(''), favName = _favName[0], setFavName = _favName[1];

  var _saving = useState(false), saving = _saving[0], setSaving = _saving[1];
  var _t = useState(''), toast = _t[0], setToast = _t[1];
  var _detail = useState(null), detailEntry = _detail[0], setDetailEntry = _detail[1];
  var _checked = useState({}), checked = _checked[0], setChecked = _checked[1];

  function flash(msg) { setToast(msg); setTimeout(function(){setToast('');}, 3000); }

  function loadData() {
    if (!auth.user) return;
    setLoading(true);
    supabase.from('expense_monthly_reports').select('*')
      .eq('user_id', auth.user.id).eq('year', year).eq('month', month).single()
      .then(function(res) {
        if (res.data) {
          setReportId(res.data.id);
          return supabase.from('expense_entries').select('*').eq('report_id', res.data.id).order('expense_date')
            .then(function(eRes) {
              var all = eRes.data || [];
              var filtered = all.filter(function(e) {
                return e.category === '旅費交通費' && (e.travel_method === '電車' || e.travel_method === 'バス');
              });
              setEntries(filtered);
              if (onEntriesLoaded) onEntriesLoaded(filtered);
            });
        } else {
          return supabase.from('expense_monthly_reports')
            .insert({ user_id: auth.user.id, year: year, month: month, status: '下書き' })
            .select().single()
            .then(function(newRes) {
              if (newRes.data) { setReportId(newRes.data.id); }
              setEntries([]);
              if (onEntriesLoaded) onEntriesLoaded([]);
            });
        }
      })
      .catch(function() { setEntries([]); if (onEntriesLoaded) onEntriesLoaded([]); })
      .finally(function() { setLoading(false); });
  }

  function loadFavs() {
    if (!auth.user) return;
    supabase.from('favorite_routes').select('*').eq('user_id', auth.user.id).order('route_name')
      .then(function(res) { setFavs(res.data || []); })
      .catch(function() {});
  }

  // props年月が変わったら内部stateを同期
  useEffect(function() {
    if (propYear !== undefined && propYear !== year) setYear(propYear);
    if (propMonth !== undefined && propMonth !== month) setMonth(propMonth);
  }, [propYear, propMonth]);

  useEffect(function() { loadData(); loadFavs(); }, [auth.user, year, month]);

  function toggleDate(dateStr) {
    var idx = selDates.indexOf(dateStr);
    if (idx >= 0) {
      var copy = selDates.slice(); copy.splice(idx, 1); setSelDates(copy);
    } else {
      setSelDates(selDates.concat([dateStr]));
    }
  }

  function resetTransport() {
    setTMeth('電車'); setTF(''); setTT(''); setTTy('片道'); setTAm('');
    setTEditId(null); setTEditDate(''); setSelDates([]); setShowTransport(false);
    setShowFavForm(false); setFavName('');
  }

  function handleSaveTransport() {
    if (!tF || !tT || !tAm) { flash('区間・金額は必須です'); return; }
    if (tEditId) {
      if (!tEditDate) { flash('日付が必要です'); return; }
      setSaving(true);
      supabase.from('expense_entries').update({
        expense_date: tEditDate, category: '旅費交通費',
        amount: Math.round(Number(tAm)) || 0,
        travel_from: tF, travel_to: tT, travel_method: tMeth,
        trip_type: tTy, receipt_data: '', receipt_filename: '',
      }).eq('id', tEditId)
        .then(function() { flash('更新しました'); resetTransport(); loadData(); })
        .catch(function() { flash('更新失敗'); })
        .finally(function() { setSaving(false); });
      return;
    }
    if (selDates.length === 0) { flash('カレンダーから日付を選択してください'); return; }
    setSaving(true);
    var sorted = selDates.slice().sort();
    var inserts = sorted.map(function(d) {
      return {
        report_id: reportId, expense_date: d, category: '旅費交通費',
        amount: Math.round(Number(tAm)) || 0, description: '',
        travel_from: tF, travel_to: tT, travel_method: tMeth,
        trip_type: tTy, receipt_data: '', receipt_filename: '',
      };
    });
    supabase.from('expense_entries').insert(inserts)
      .then(function() { flash(sorted.length+'件の交通費を登録しました'); resetTransport(); loadData(); })
      .catch(function() { flash('登録失敗'); })
      .finally(function() { setSaving(false); });
  }

  function applyFav(fav) {
    setTF(fav.travel_from); setTT(fav.travel_to);
    setTMeth(fav.travel_method); setTAm(String(fav.amount));
    setTTy(fav.trip_type);
    flash('「'+fav.route_name+'」を適用');
  }

  function handleSaveFav() {
    if (!favName.trim() || !tF || !tT || !tAm) { flash('ルート名・区間・金額を入力'); return; }
    supabase.from('favorite_routes').insert({
      user_id: auth.user.id, route_name: favName.trim(),
      travel_from: tF, travel_to: tT, travel_method: tMeth,
      amount: Math.round(Number(tAm)) || 0, trip_type: tTy,
    }).then(function() { flash('お気に入りに登録'); setShowFavForm(false); setFavName(''); loadFavs(); })
      .catch(function() { flash('登録失敗'); });
  }

  function deleteFav(id) {
    if (!confirm('このルートを削除しますか？')) return;
    supabase.from('favorite_routes').delete().eq('id', id)
      .then(function() { flash('削除'); loadFavs(); });
  }

  function handleEdit(e) {
    setTMeth(e.travel_method); setTF(e.travel_from||'');
    setTT(e.travel_to||''); setTTy(e.trip_type||'片道'); setTAm(String(e.amount));
    setTEditId(e.id); setTEditDate(e.expense_date); setSelDates([]);
    setShowTransport(true);
    setDetailEntry(null);
  }

  function handleDeleteEntry(id) {
    if (!confirm('削除しますか？')) return;
    supabase.from('expense_entries').delete().eq('id', id)
      .then(function() { flash('削除'); setDetailEntry(null); loadData(); });
  }

  function prevMonth(){if(month===1){setMonth(12);setYear(year-1);}else{setMonth(month-1);}}
  function nextMonth(){if(month===12){setMonth(1);setYear(year+1);}else{setMonth(month+1);}}

  var grandTotal = 0;
  entries.forEach(function(e){grandTotal += e.amount;});

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
      return supabase.from('expense_entries').delete().eq('id', id);
    })).then(function(){
      flash(checkedIds.length+'件削除しました');
      setChecked({}); loadData();
    }).catch(function(){ flash('削除に失敗しました'); })
    .finally(function(){ setSaving(false); });
  }

  if (loading) return (<div className="page-loading"><div className="spinner"></div><span>読み込み中...</span></div>);

  // 詳細ビュー
  if (detailEntry) {
    var de = detailEntry;
    return (
      <div className="expense-page">
        {toast && <div className="toast">{toast}</div>}
        <div className="month-header">
          <button className="btn-ghost" onClick={function(){setDetailEntry(null);}}>← 戻る</button>
          <h2 className="month-title">交通費詳細</h2>
        </div>
        <div className="card">
          <div className="trip-detail-grid">
            <div className="trip-detail-item"><span className="trip-detail-label">日付</span><span className="trip-detail-value">{fmtDate(de.expense_date)}</span></div>
            <div className="trip-detail-item"><span className="trip-detail-label">金額</span><span className="trip-detail-value">¥{de.amount.toLocaleString()}</span></div>
            {de.travel_from&&(<div className="trip-detail-item"><span className="trip-detail-label">区間</span><span className="trip-detail-value">{de.travel_from} → {de.travel_to}</span></div>)}
            {de.travel_method&&(<div className="trip-detail-item"><span className="trip-detail-label">交通手段</span><span className="trip-detail-value">{de.travel_method}</span></div>)}
            {de.trip_type&&(<div className="trip-detail-item"><span className="trip-detail-label">片道/往復</span><span className="trip-detail-value">{de.trip_type}</span></div>)}
          </div>
          <div className="transport-no-receipt"><span>🚃 電車・バスの交通費のため領収書不要</span></div>
          <div className="trip-detail-actions">
            <button className="btn-outline" onClick={function(){handleEdit(de);}}>✏️ 編集</button>
            <button className="btn-danger" onClick={function(){handleDeleteEntry(de.id);}}>🗑 削除</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="expense-page">
      {toast && <div className="toast">{toast}</div>}

      {!hideHeader && (
        <div className="month-header">
          <div className="month-nav">
            <button className="btn-icon" onClick={prevMonth}>◀</button>
            <h2 className="month-title">{year}年{month}月</h2>
            <button className="btn-icon" onClick={nextMonth}>▶</button>
          </div>
        </div>
      )}

      <div className="expense-actions-row">
        <div className="expense-btn-row">
          <button className={'expense-tab-btn'+(showTransport?' expense-tab-active':'')} onClick={function(){if(!showTransport){setSelDates([]);}setShowTransport(!showTransport);}}>
            🚃 交通費を追加（電車・バス）
          </button>
        </div>
      </div>

      {/* 交通費入力フォーム */}
      {showTransport && (
        <div className="card" style={{marginBottom:'16px'}}>
          <h3 className="card-title">{tEditId ? '交通費を編集' : '🚃 交通費（電車・バス）— 領収書不要'}</h3>

          {/* お気に入りルート */}
          {favs.length > 0 && (
            <div className="fav-routes">
              <span className="fav-routes-label">⭐ お気に入りルート：</span>
              <div className="fav-routes-list">
                {favs.map(function(f) {
                  return (
                    <div key={f.id} className="fav-route-chip">
                      <button className="fav-route-btn" onClick={function(){applyFav(f);}}>
                        {f.route_name}<span className="fav-route-info"> ({f.travel_from}→{f.travel_to} ¥{f.amount.toLocaleString()})</span>
                      </button>
                      <button className="fav-route-del" onClick={function(){deleteFav(f.id);}}>×</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="transport-form-layout">
            <div className="transport-form-left">
              <div className="expense-form-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
                <div className="form-group"><label className="form-label">交通手段</label>
                  <select className="form-select" value={tMeth} onChange={function(e){setTMeth(e.target.value);}}>
                    {TRANSPORT_METHODS.map(function(m){return <option key={m} value={m}>{m}</option>;})}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">片道/往復</label>
                  <select className="form-select" value={tTy} onChange={function(e){setTTy(e.target.value);}}>
                    <option value="片道">片道</option><option value="往復">往復</option>
                  </select>
                </div>
              </div>
              <div className="expense-form-grid" style={{marginTop:'8px',gridTemplateColumns:'1fr 1fr 1fr'}}>
                <div className="form-group"><label className="form-label">出発地</label><input className="form-input" value={tF} onChange={function(e){setTF(e.target.value);}} placeholder="例: 宇都宮駅" /></div>
                <div className="form-group"><label className="form-label">到着地</label><input className="form-input" value={tT} onChange={function(e){setTT(e.target.value);}} placeholder="例: 東京駅" /></div>
                <div className="form-group"><label className="form-label">金額（円）</label><input className="form-input" type="number" value={tAm} onChange={function(e){setTAm(e.target.value);}} placeholder="0" /></div>
              </div>
              {!tEditId && tF && tT && tAm && (
                <div style={{marginTop:'12px'}}>
                  {!showFavForm ? (
                    <button className="btn-outline" style={{fontSize:'12px'}} onClick={function(){setShowFavForm(true);}}>⭐ このルートをお気に入りに登録</button>
                  ) : (
                    <div className="fav-save-form">
                      <input className="form-input" value={favName} onChange={function(e){setFavName(e.target.value);}} placeholder="ルート名（例: 自宅→本社）" style={{maxWidth:'250px'}} />
                      <button className="btn-primary" style={{width:'auto',padding:'8px 16px'}} onClick={handleSaveFav}>保存</button>
                      <button className="btn-outline" onClick={function(){setShowFavForm(false);}}>✕</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="transport-form-right">
              {tEditId ? (
                <div>
                  <label className="form-label">利用日</label>
                  <input className="form-input" type="date" value={tEditDate} onChange={function(e){setTEditDate(e.target.value);}} />
                </div>
              ) : (
                <div>
                  <label className="form-label">利用日を選択（複数可）</label>
                  <DateCalendar year={year} month={month} selected={selDates} onToggle={toggleDate} />
                  {selDates.length > 0 && (
                    <div className="cal-selected-info">
                      {selDates.length}日選択中
                      {tAm && <span> — 合計 ¥{(selDates.length * (Math.round(Number(tAm))||0)).toLocaleString()}</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{display:'flex',gap:'8px',marginTop:'16px'}}>
            <button className="btn-primary" style={{width:'auto',padding:'10px 24px'}} onClick={handleSaveTransport} disabled={saving}>
              {saving ? '保存中...' : tEditId ? '更新' : selDates.length+'日分を登録'}
            </button>
            <button className="btn-outline" onClick={resetTransport}>キャンセル</button>
          </div>
        </div>
      )}

      {/* 一覧 */}
      {entries.length === 0 ? (
        <div className="card"><p className="empty-state">この月の交通費記録はありません。</p></div>
      ) : (
        <>
          <div className="batch-action-bar">
            <div className="batch-action-left">
              {checkedIds.length > 0 && (
                <button className="btn-danger" style={{fontSize:'12px',padding:'6px 14px'}} onClick={handleBatchDelete}>🗑 選択した{checkedIds.length}件を削除</button>
              )}
            </div>
            <span style={{fontSize:'14px',fontWeight:700,fontFamily:'var(--mono)'}}>月合計: ¥{grandTotal.toLocaleString()}</span>
          </div>
          <div className="card" style={{padding:'0',overflow:'hidden'}}>
            <table className="admin-table">
              <thead><tr>
                <th style={{textAlign:'center',width:'36px'}}><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
                <th style={{textAlign:'center',width:'80px'}}>日付</th>
                <th style={{textAlign:'center',width:'60px'}}>手段</th>
                <th style={{textAlign:'left'}}>区間</th>
                <th style={{textAlign:'center',width:'60px'}}>種別</th>
                <th style={{textAlign:'right',width:'100px'}}>金額</th>
                <th style={{textAlign:'center',width:'100px'}}>操作</th>
              </tr></thead>
              <tbody>
                {entries.map(function(e){
                  return (
                    <tr key={e.id} className={'admin-table-row'+(checked[e.id]?' row-checked':'')} style={{cursor:'pointer'}} onClick={function(){setDetailEntry(e);}}>
                      <td style={{textAlign:'center'}} onClick={function(ev){ev.stopPropagation();}}>
                        <input type="checkbox" checked={!!checked[e.id]} onChange={function(){toggleCheck(e.id);}} />
                      </td>
                      <td style={{textAlign:'center'}}>{fmtDate(e.expense_date)}</td>
                      <td style={{textAlign:'center'}}>🚃 {e.travel_method}</td>
                      <td style={{textAlign:'left'}}>{(e.travel_from||'')+'→'+(e.travel_to||'')}</td>
                      <td style={{textAlign:'center'}}>{e.trip_type}</td>
                      <td style={{textAlign:'right',fontFamily:'var(--mono)',fontWeight:600}}>¥{e.amount.toLocaleString()}</td>
                      <td style={{textAlign:'center'}} onClick={function(ev){ev.stopPropagation();}}>
                        <div className="admin-actions">
                          <button className="btn-small" onClick={function(){handleEdit(e);}}>編集</button>
                          <button className="btn-small btn-small-reject" onClick={function(){handleDeleteEntry(e.id);}}>削除</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{background:'var(--bg)'}}>
                  <td colSpan={5} style={{textAlign:'right',fontWeight:700,padding:'10px 8px'}}>月合計</td>
                  <td style={{textAlign:'right',fontFamily:'var(--mono)',fontWeight:700,fontSize:'14px',padding:'10px 8px'}}>¥{grandTotal.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
