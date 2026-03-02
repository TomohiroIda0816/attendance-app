import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { exportExpenseExcel } from '../lib/expenseExcel';
import { openReceiptCompilationPDF } from '../lib/receiptPdf';

function fmtDate(d) {
  if (!d) return '';
  var dt = new Date(d);
  return dt.getFullYear()+'/'+String(dt.getMonth()+1).padStart(2,'0')+'/'+String(dt.getDate()).padStart(2,'0');
}
function getDetail(e) {
  if (e.category==='旅費交通費') {
    var p = [];
    if (e.travel_from||e.travel_to) p.push((e.travel_from||'')+'→'+(e.travel_to||''));
    if (e.travel_method) p.push(e.travel_method);
    return p.join(' / ');
  }
  if (e.category==='書籍代'&&e.book_title) return e.book_title;
  return e.description;
}

export default function ExpenseAdminPage() {
  var auth = useAuth();
  var now = new Date();
  var _y = useState(now.getFullYear()), year = _y[0], setYear = _y[1];
  var _m = useState(now.getMonth()+1), month = _m[0], setMonth = _m[1];
  var _users = useState([]), users = _users[0], setUsers = _users[1];
  var _ld = useState(true), loading = _ld[0], setLoading = _ld[1];
  var _detail = useState(null), detail = _detail[0], setDetail = _detail[1];
  var _receipt = useState(null), receiptView = _receipt[0], setReceiptView = _receipt[1];
  var _t = useState(''), toast = _t[0], setToast = _t[1];
  var _showKey = useState(false), showKeyInput = _showKey[0], setShowKeyInput = _showKey[1];
  var _apiKey = useState('');
  var apiKey = _apiKey[0], setApiKey = _apiKey[1];

  // APIキーをDBから読み込み
  useEffect(function() {
    supabase.from('system_settings').select('value').eq('key', 'anthropic_api_key').single()
      .then(function(res) {
        if (res.data) { setApiKey(res.data.value); window.__apiKey = res.data.value; }
      }).catch(function(){});
  }, []);

  function flash(msg) { setToast(msg); setTimeout(function(){setToast('');}, 2500); }

  function loadData() {
    setLoading(true); setDetail(null); setReceiptView(null);
    supabase.from('profiles').select('*').order('full_name')
      .then(function(profRes) {
        if (!profRes.data) { setUsers([]); setLoading(false); return; }
        return supabase.from('expense_monthly_reports').select('*').eq('year',year).eq('month',month)
          .then(function(repRes) {
            var reports = repRes.data || [];
            var result = profRes.data.map(function(p) {
              var report = reports.find(function(r){return r.user_id===p.id;});
              return {id:p.id, full_name:p.full_name, email:p.email, role:p.role, report:report||null, status:report?report.status:'未作成'};
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
    supabase.from('expense_entries').select('*').eq('report_id',u.report.id).order('expense_date')
      .then(function(res){
        var all = res.data || [];
        setDetail({user:u, entries:all, report:u.report});
      })
      .catch(function(){});
  }


  function saveApiKey() {
    supabase.from('system_settings').upsert({ key: 'anthropic_api_key', value: apiKey, updated_at: new Date().toISOString() })
      .then(function(res) {
        if (res.error) { flash('保存に失敗しました: ' + res.error.message); return; }
        window.__apiKey = apiKey;
        setShowKeyInput(false); flash('APIキーを保存しました');
      })
      .catch(function() { flash('保存に失敗しました'); });
  }

  function prevMonth(){if(month===1){setMonth(12);setYear(year-1);}else{setMonth(month-1);}}
  function nextMonth(){if(month===12){setMonth(1);setYear(year+1);}else{setMonth(month+1);}}

  // 領収書プレビュー
  if (receiptView) {
    return (
      <div className="expense-page">
        <div className="month-header">
          <button className="btn-ghost" onClick={function(){setReceiptView(null);}}>← 戻る</button>
          <h2 className="month-title">経費詳細・領収書</h2>
        </div>
        <div className="card">
          <div className="trip-detail-grid">
            <div className="trip-detail-item"><span className="trip-detail-label">日付</span><span className="trip-detail-value">{fmtDate(receiptView.expense_date)}</span></div>
            <div className="trip-detail-item"><span className="trip-detail-label">費目</span><span className="trip-detail-value"><span className={'expense-cat expense-cat-'+receiptView.category}>{receiptView.category}</span></span></div>
            <div className="trip-detail-item"><span className="trip-detail-label">金額</span><span className="trip-detail-value">¥{receiptView.amount.toLocaleString()}</span></div>
            {receiptView.receipt_amount > 0 && (<div className="trip-detail-item"><span className="trip-detail-label">領収書金額</span><span className="trip-detail-value">¥{receiptView.receipt_amount.toLocaleString()}</span></div>)}
            {receiptView.receipt_amount > 0 && receiptView.amount !== receiptView.receipt_amount && (
              <div className="trip-detail-item" style={{gridColumn:'1/-1'}}>
                <div className="amt-mismatch-box">
                  <div className="amt-mismatch-header">⚠️ 領収書金額（¥{receiptView.receipt_amount.toLocaleString()}）と申請金額（¥{receiptView.amount.toLocaleString()}）が異なります</div>
                  {receiptView.amount_mismatch_reason && <div style={{marginTop:'6px',fontSize:'13px'}}>理由: {receiptView.amount_mismatch_reason}</div>}
                </div>
              </div>
            )}
            <div className="trip-detail-item"><span className="trip-detail-label">内容</span><span className="trip-detail-value">{getDetail(receiptView)}</span></div>
            {receiptView.category==='旅費交通費'&&receiptView.travel_from&&(<div className="trip-detail-item"><span className="trip-detail-label">区間</span><span className="trip-detail-value">{receiptView.travel_from} → {receiptView.travel_to}</span></div>)}
            {receiptView.category==='旅費交通費'&&receiptView.travel_method&&(<div className="trip-detail-item"><span className="trip-detail-label">交通手段</span><span className="trip-detail-value">{receiptView.travel_method}</span></div>)}
            {receiptView.category==='書籍代'&&receiptView.book_title&&(<div className="trip-detail-item"><span className="trip-detail-label">書籍名</span><span className="trip-detail-value">{receiptView.book_title}</span></div>)}
          </div>
          {receiptView.receipt_data && (
            <div className="receipt-preview-section">
              <h3 className="trip-breakdown-title">領収書画像</h3>
              <div className="receipt-preview-box">
                {receiptView.receipt_filename && receiptView.receipt_filename.toLowerCase().endsWith('.pdf') ? (
                  <div className="receipt-pdf-notice"><span>📄 {receiptView.receipt_filename}</span>
                    <button className="btn-small" onClick={function(){var b=atob(receiptView.receipt_data);var a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);window.open(URL.createObjectURL(new Blob([a],{type:'application/pdf'})),'_blank');}}>PDFを開く</button>
                  </div>
                ) : (<img src={'data:image/png;base64,'+receiptView.receipt_data} alt="領収書" className="receipt-image" />)}
              </div>
            </div>
          )}
          {!receiptView.receipt_data && (<div className="card" style={{marginTop:'16px'}}><p className="empty-state">領収書は添付されていません。</p></div>)}
        </div>
      </div>
    );
  }

  // ユーザー詳細
  if (detail) {
    var u = detail.user, rpt = detail.report, ent = detail.entries;
    var grandTotal = 0;
    ent.forEach(function(e){grandTotal += e.amount;});

    return (
      <div className="expense-page">
        {toast && <div className="toast">{toast}</div>}
        <div className="month-header">
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            <button className="btn-ghost" onClick={function(){setDetail(null);}}>← 戻る</button>
            <h2 className="month-title">{u.full_name} — {year}年{month}月</h2>
          </div>
          <div className="header-actions">
            <button className="btn-outline" onClick={function(){exportExpenseExcel(ent,year,month,u.full_name);}}>📊 Excel</button>
            <button className="btn-outline" onClick={function(){openReceiptCompilationPDF(ent,year,month,u.full_name);}}>🧾 領収書PDF</button>
          </div>
        </div>
        {ent.length===0 ? (
          <div className="card"><p className="empty-state">この月の経費記録はありません。</p></div>
        ) : (
          <div className="card" style={{padding:'0',overflow:'hidden'}}>
            <table className="admin-table">
              <thead><tr>
                <th style={{textAlign:'center',width:'80px'}}>日付</th>
                <th style={{textAlign:'center',width:'90px'}}>費目</th>
                <th style={{textAlign:'left'}}>内容</th>
                <th style={{textAlign:'center',width:'30px'}}>📎</th>
                <th style={{textAlign:'center',width:'130px'}}>インボイス</th>
                <th style={{textAlign:'right',width:'100px'}}>金額</th>
                <th style={{textAlign:'center',width:'60px'}}>操作</th>
              </tr></thead>
              <tbody>
                {ent.map(function(e){
                  return (
                    <tr key={e.id} className="admin-table-row" style={{cursor:'pointer'}} onClick={function(){setReceiptView(e);}}>
                      <td style={{textAlign:'center'}}>{fmtDate(e.expense_date)}</td>
                      <td style={{textAlign:'center'}}><span className={'expense-cat expense-cat-'+e.category}>{e.category}</span></td>
                      <td style={{textAlign:'left'}}>{getDetail(e)}</td>
                      <td style={{textAlign:'center'}}>{e.receipt_data ? (e.invoice_number ? '📎' : '⚠️') : ''}</td>
                      <td style={{textAlign:'center',fontSize:'11px',fontFamily:'var(--mono)'}}>{e.invoice_number || (e.receipt_data ? <span className="invoice-warning-inline">未登録</span> : '')}</td>
                      <td style={{textAlign:'right',fontFamily:'var(--mono)',fontWeight:600}}>¥{e.amount.toLocaleString()}</td>
                      <td style={{textAlign:'center'}} onClick={function(ev){ev.stopPropagation();}}>
                        <button className="btn-small btn-small-reject" onClick={function(){
                          if(!confirm('この経費を削除しますか？'))return;
                          supabase.from('expense_entries').delete().eq('id',e.id).then(function(){flash('削除しました');viewDetail(u);});
                        }}>削除</button>
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
        )}
      </div>
    );
  }

  // 月別ユーザー一覧
  return (
    <div className="expense-page">
      {toast && <div className="toast">{toast}</div>}
      <div className="month-header">
        <div className="month-nav">
          <button className="btn-icon" onClick={prevMonth}>◀</button>
          <h2 className="month-title">{year}年{month}月</h2>
          <button className="btn-icon" onClick={nextMonth}>▶</button>
        </div>
        <div className="header-actions">
          <button className="btn-outline" style={{fontSize:'11px'}} onClick={function(){setShowKeyInput(!showKeyInput);}}>🔑 API設定</button>
          <span className="admin-summary">全{users.length}名</span>
        </div>
      </div>
      {showKeyInput && (
        <div className="card" style={{marginBottom:'12px'}}>
          <h3 className="card-title">Anthropic APIキー設定</h3>
          <p className="card-desc">領収書の自動読み取りに使用するAPIキーです。データベースに保存され、全ユーザーの読み取りに使用されます。</p>
          <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
            <input className="form-input" type="password" value={apiKey} onChange={function(e){setApiKey(e.target.value);}} placeholder="sk-ant-..." style={{maxWidth:'400px'}} />
            <button className="btn-primary" style={{width:'auto',padding:'8px 16px'}} onClick={saveApiKey}>保存</button>
          </div>
        </div>
      )}
      {loading ? (<div className="page-loading"><div className="spinner"></div><span>読み込み中...</span></div>) : (
        <div className="card" style={{padding:'0',overflow:'hidden'}}>
          <table className="admin-table">
            <thead><tr>
              <th style={{textAlign:'left'}}>氏名</th>
              <th style={{textAlign:'left'}}>メールアドレス</th>
              <th style={{textAlign:'center',width:'100px'}}>登録状況</th>
              <th style={{textAlign:'center',width:'100px'}}>操作</th>
            </tr></thead>
            <tbody>
              {users.map(function(u){
                return (
                  <tr key={u.id} className="admin-table-row">
                    <td className="admin-table-name">{u.full_name}{u.role==='admin'&&<span className="admin-role-badge">管理者</span>}</td>
                    <td className="admin-table-email">{u.email}</td>
                    <td style={{textAlign:'center'}}>{u.report ? <span className="status-badge badge-approved">登録済</span> : <span className="status-badge badge-none">未作成</span>}</td>
                    <td style={{textAlign:'center'}}>
                      {u.report ? (
                        <button className="btn-small" onClick={function(){viewDetail(u);}}>詳細</button>
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
