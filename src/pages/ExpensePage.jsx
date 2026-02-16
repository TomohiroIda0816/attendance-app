import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { openExpensePDF } from '../lib/expensePdf';

var CATEGORIES = ['旅費交通費', '書籍代', 'その他'];
var METHODS = ['電車', 'バス', 'タクシー', '飛行機', '新幹線', 'その他'];

function fmtDate(d) {
  if (!d) return '';
  var dt = new Date(d);
  return dt.getFullYear()+'/'+String(dt.getMonth()+1).padStart(2,'0')+'/'+String(dt.getDate()).padStart(2,'0');
}

function statusClass(s) {
  return {'下書き':'badge-draft','申請済':'badge-submitted','承認済':'badge-approved','差戻し':'badge-rejected'}[s]||'badge-draft';
}

async function analyzeReceipt(file, apiKey) {
  var reader = new FileReader();
  var base64 = await new Promise(function(resolve, reject) {
    reader.onload = function() { resolve(reader.result.split(',')[1]); };
    reader.onerror = function() { reject(new Error('ファイル読み込みエラー')); };
    reader.readAsDataURL(file);
  });

  var mediaType = file.type || 'image/png';
  var contentBlock;
  if (file.type === 'application/pdf') {
    contentBlock = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
  } else {
    contentBlock = { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };
  }

  var response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          contentBlock,
          { type: 'text', text: 'この領収書/レシートを分析してJSON形式で返してください。\n必ず以下のJSON形式のみで返してください（説明文や```は不要）:\n{"category":"旅費交通費 or 書籍代 or その他","amount":数値,"description":"内容の説明","travel_from":"出発地(旅費交通費の場合)","travel_to":"到着地(旅費交通費の場合)","travel_method":"交通手段(旅費交通費の場合)","book_title":"書籍名(書籍代の場合)","date":"YYYY-MM-DD形式の日付(読み取れた場合)"}' }
        ]
      }]
    })
  });

  var data = await response.json();
  var text = '';
  if (data.content) {
    for (var i = 0; i < data.content.length; i++) {
      if (data.content[i].type === 'text') text += data.content[i].text;
    }
  }
  var clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

export default function ExpensePage() {
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
  var _date = useState(''), expDate = _date[0], setExpDate = _date[1];
  var _cat = useState('その他'), cat = _cat[0], setCat = _cat[1];
  var _amt = useState(''), amt = _amt[0], setAmt = _amt[1];
  var _desc = useState(''), desc = _desc[0], setDesc = _desc[1];
  var _from = useState(''), tFrom = _from[0], setTFrom = _from[1];
  var _to = useState(''), tTo = _to[0], setTTo = _to[1];
  var _method = useState(''), tMethod = _method[0], setTMethod = _method[1];
  var _book = useState(''), bookTitle = _book[0], setBookTitle = _book[1];
  var _saving = useState(false), saving = _saving[0], setSaving = _saving[1];
  var _analyzing = useState(false), analyzing = _analyzing[0], setAnalyzing = _analyzing[1];
  var _t = useState(''), toast = _t[0], setToast = _t[1];
  var _apiKey = useState(function() { try { return localStorage.getItem('anthropic_api_key') || ''; } catch(e) { return ''; } });
  var apiKey = _apiKey[0], setApiKey = _apiKey[1];
  var _showKey = useState(false), showKeyInput = _showKey[0], setShowKeyInput = _showKey[1];
  var fileRef = useRef(null);

  function flash(msg) { setToast(msg); setTimeout(function(){setToast('');}, 2500); }

  function loadData() {
    if (!auth.user) return;
    setLoading(true);
    supabase.from('expense_monthly_reports').select('*')
      .eq('user_id', auth.user.id).eq('year', year).eq('month', month).single()
      .then(function(res) {
        if (res.data) {
          setReportId(res.data.id); setStatus(res.data.status);
          return supabase.from('expense_entries').select('*').eq('report_id', res.data.id).order('expense_date')
            .then(function(eRes) { setEntries(eRes.data || []); });
        } else {
          return supabase.from('expense_monthly_reports')
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

  function resetForm() {
    setExpDate(''); setCat('その他'); setAmt(''); setDesc('');
    setTFrom(''); setTTo(''); setTMethod(''); setBookTitle('');
    setEditId(null); setShowForm(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleFileUpload(e) {
    var file = e.target.files[0];
    if (!file) return;
    if (!apiKey) { flash('APIキーを設定してください'); setShowKeyInput(true); return; }
    setAnalyzing(true);
    analyzeReceipt(file, apiKey)
      .then(function(result) {
        if (result.category && CATEGORIES.indexOf(result.category) >= 0) setCat(result.category);
        if (result.amount) setAmt(String(Math.round(Number(result.amount))));
        if (result.description) setDesc(result.description);
        if (result.travel_from) setTFrom(result.travel_from);
        if (result.travel_to) setTTo(result.travel_to);
        if (result.travel_method) setTMethod(result.travel_method);
        if (result.book_title) setBookTitle(result.book_title);
        if (result.date) setExpDate(result.date);
        flash('領収書を読み取りました');
      })
      .catch(function(err) {
        console.error('Receipt analysis error:', err);
        flash('読み取りに失敗しました。手動で入力してください。');
      })
      .finally(function() { setAnalyzing(false); });
  }

  function handleSave() {
    if (!expDate || !amt) { flash('日付と金額は必須です'); return; }
    setSaving(true);
    var data = {
      report_id: reportId, expense_date: expDate, category: cat,
      amount: Math.round(Number(amt)) || 0, description: desc,
      travel_from: tFrom, travel_to: tTo, travel_method: tMethod, book_title: bookTitle,
    };
    var p = editId
      ? supabase.from('expense_entries').update(data).eq('id', editId)
      : supabase.from('expense_entries').insert(data);
    p.then(function() { flash(editId ? '更新しました' : '登録しました'); resetForm(); loadData(); })
      .catch(function() { flash('保存に失敗しました'); })
      .finally(function() { setSaving(false); });
  }

  function handleEdit(e) {
    setExpDate(e.expense_date); setCat(e.category); setAmt(String(e.amount));
    setDesc(e.description); setTFrom(e.travel_from||''); setTTo(e.travel_to||'');
    setTMethod(e.travel_method||''); setBookTitle(e.book_title||'');
    setEditId(e.id); setShowForm(true);
  }

  function handleDeleteEntry(id) {
    if (!confirm('この経費を削除しますか？')) return;
    supabase.from('expense_entries').delete().eq('id', id)
      .then(function() { flash('削除しました'); loadData(); })
      .catch(function() { flash('削除に失敗しました'); });
  }

  function handleSubmit() {
    if (!reportId) return; setSaving(true);
    supabase.from('expense_monthly_reports')
      .update({ status: '申請済', submitted_at: new Date().toISOString() }).eq('id', reportId)
      .then(function() { setStatus('申請済'); flash(year+'年'+month+'月 申請しました'); })
      .catch(function() { flash('申請に失敗しました'); })
      .finally(function() { setSaving(false); });
  }

  function handleUnsubmit() {
    if (!reportId) return; setSaving(true);
    supabase.from('expense_monthly_reports')
      .update({ status: '下書き', submitted_at: null }).eq('id', reportId)
      .then(function() { setStatus('下書き'); flash('申請を取り消しました'); })
      .catch(function() { flash('取り消しに失敗しました'); })
      .finally(function() { setSaving(false); });
  }

  function saveApiKey() {
    try { localStorage.setItem('anthropic_api_key', apiKey); } catch(e) {}
    setShowKeyInput(false); flash('APIキーを保存しました');
  }

  function prevMonth(){if(month===1){setMonth(12);setYear(year-1);}else{setMonth(month-1);}}
  function nextMonth(){if(month===12){setMonth(1);setYear(year+1);}else{setMonth(month+1);}}

  var grandTotal = 0;
  entries.forEach(function(e){grandTotal += e.amount;});
  var isEditable = status === '下書き' || status === '差戻し';

  if (loading) return (<div className="page-loading"><div className="spinner"></div><span>読み込み中...</span></div>);

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
          <span className={'status-badge '+statusClass(status)}>{status}</span>
          <button className="btn-outline" style={{fontSize:'11px'}} onClick={function(){setShowKeyInput(!showKeyInput);}}>🔑 API設定</button>
          <button className="btn-outline" onClick={function(){openExpensePDF(entries,year,month,auth.profile?auth.profile.full_name:'',status);}}>📄 PDF</button>
          {status==='申請済'||status==='承認済' ? (
            <button className="btn-danger" onClick={handleUnsubmit} disabled={saving||status==='承認済'}>{status==='承認済'?'承認済':'申請取消'}</button>
          ) : (
            <button className="btn-submit" onClick={handleSubmit} disabled={saving}>✓ 申請</button>
          )}
        </div>
      </div>

      {/* APIキー設定 */}
      {showKeyInput && (
        <div className="card" style={{marginBottom:'12px'}}>
          <h3 className="card-title">Anthropic APIキー設定</h3>
          <p className="card-desc">領収書の自動読み取りにClaude APIを使用します。キーはブラウザのローカルに保存されます。</p>
          <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
            <input className="form-input" type="password" value={apiKey} onChange={function(e){setApiKey(e.target.value);}} placeholder="sk-ant-..." style={{maxWidth:'400px'}} />
            <button className="btn-primary" style={{width:'auto',padding:'8px 16px'}} onClick={saveApiKey}>保存</button>
          </div>
        </div>
      )}

      {/* 新規登録ボタン */}
      {isEditable && (
        <div style={{marginBottom:'12px'}}>
          <button className="btn-primary" style={{width:'auto',padding:'8px 20px'}} onClick={function(){resetForm();setShowForm(!showForm);}}>
            {showForm ? '✕ 閉じる' : '＋ 経費を追加'}
          </button>
        </div>
      )}

      {/* 入力フォーム */}
      {showForm && isEditable && (
        <div className="card" style={{marginBottom:'16px'}}>
          <h3 className="card-title">{editId ? '経費を編集' : '新規経費'}</h3>

          {/* 領収書アップロード */}
          <div className="receipt-upload">
            <label className="receipt-label">
              {analyzing ? '🔄 読み取り中...' : '📎 領収書を読み込む（PDF/画像）'}
              <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFileUpload} disabled={analyzing} style={{display:'none'}} />
            </label>
            <span className="receipt-hint">領収書をアップロードすると自動で費目と金額を入力します</span>
          </div>

          <div className="expense-form-grid">
            <div className="form-group">
              <label className="form-label">日付</label>
              <input className="form-input" type="date" value={expDate} onChange={function(e){setExpDate(e.target.value);}} />
            </div>
            <div className="form-group">
              <label className="form-label">費目</label>
              <select className="form-select" value={cat} onChange={function(e){setCat(e.target.value);}}>
                {CATEGORIES.map(function(c){return <option key={c} value={c}>{c}</option>;})}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">金額（円）</label>
              <input className="form-input" type="number" value={amt} onChange={function(e){setAmt(e.target.value);}} placeholder="0" />
            </div>
          </div>

          {/* 旅費交通費の追加フィールド */}
          {cat === '旅費交通費' && (
            <div className="expense-form-grid" style={{marginTop:'8px'}}>
              <div className="form-group">
                <label className="form-label">出発地</label>
                <input className="form-input" value={tFrom} onChange={function(e){setTFrom(e.target.value);}} placeholder="例: 東京駅" />
              </div>
              <div className="form-group">
                <label className="form-label">到着地</label>
                <input className="form-input" value={tTo} onChange={function(e){setTTo(e.target.value);}} placeholder="例: 大阪駅" />
              </div>
              <div className="form-group">
                <label className="form-label">交通手段</label>
                <select className="form-select" value={tMethod} onChange={function(e){setTMethod(e.target.value);}}>
                  <option value="">選択</option>
                  {METHODS.map(function(m){return <option key={m} value={m}>{m}</option>;})}
                </select>
              </div>
            </div>
          )}

          {/* 書籍代の追加フィールド */}
          {cat === '書籍代' && (
            <div style={{marginTop:'8px'}}>
              <div className="form-group">
                <label className="form-label">書籍名</label>
                <input className="form-input" value={bookTitle} onChange={function(e){setBookTitle(e.target.value);}} placeholder="例: プログラミング入門" />
              </div>
            </div>
          )}

          {/* 備考（その他の場合） */}
          {cat === 'その他' && (
            <div style={{marginTop:'8px'}}>
              <div className="form-group">
                <label className="form-label">内容</label>
                <input className="form-input" value={desc} onChange={function(e){setDesc(e.target.value);}} placeholder="経費の内容" />
              </div>
            </div>
          )}

          <div style={{display:'flex',gap:'8px',marginTop:'16px'}}>
            <button className="btn-primary" style={{width:'auto',padding:'10px 24px'}} onClick={handleSave} disabled={saving}>{saving?'保存中...':editId?'更新':'登録'}</button>
            <button className="btn-outline" onClick={resetForm}>キャンセル</button>
          </div>
        </div>
      )}

      {/* 経費一覧テーブル */}
      {entries.length === 0 ? (
        <div className="card"><p className="empty-state">この月の経費記録はありません。{isEditable ? '「経費を追加」から登録してください。' : ''}</p></div>
      ) : (
        <div className="card" style={{padding:'0',overflow:'hidden'}}>
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{textAlign:'center',width:'80px'}}>日付</th>
                <th style={{textAlign:'center',width:'90px'}}>費目</th>
                <th style={{textAlign:'left'}}>内容</th>
                <th style={{textAlign:'right',width:'100px'}}>金額</th>
                {isEditable && <th style={{textAlign:'center',width:'100px'}}>操作</th>}
              </tr>
            </thead>
            <tbody>
              {entries.map(function(e){
                var detail = '';
                if (e.category==='旅費交通費') {
                  var parts = [];
                  if (e.travel_from||e.travel_to) parts.push((e.travel_from||'')+'→'+(e.travel_to||''));
                  if (e.travel_method) parts.push(e.travel_method);
                  detail = parts.join(' / ');
                } else if (e.category==='書籍代' && e.book_title) {
                  detail = e.book_title;
                } else {
                  detail = e.description;
                }
                return (
                  <tr key={e.id} className="admin-table-row">
                    <td style={{textAlign:'center'}}>{fmtDate(e.expense_date)}</td>
                    <td style={{textAlign:'center'}}><span className={'expense-cat expense-cat-'+e.category}>{e.category}</span></td>
                    <td style={{textAlign:'left'}}>{detail}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)',fontWeight:600}}>¥{e.amount.toLocaleString()}</td>
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
                <td colSpan={isEditable?3:3} style={{textAlign:'right',fontWeight:700,padding:'10px 8px'}}>月合計</td>
                <td style={{textAlign:'right',fontFamily:'var(--mono)',fontWeight:700,fontSize:'14px',padding:'10px 8px'}}>¥{grandTotal.toLocaleString()}</td>
                {isEditable && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
