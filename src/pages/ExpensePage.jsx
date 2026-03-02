import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { exportExpenseExcel } from '../lib/expenseExcel';
import { openReceiptCompilationPDF } from '../lib/receiptPdf';

var CATEGORIES = ['旅費交通費', '書籍代', 'その他'];
var METHODS = ['タクシー', '飛行機', '新幹線', 'その他'];
var TRANSPORT_METHODS = ['電車', 'バス'];
var DOW = ['日','月','火','水','木','金','土'];

function fmtDate(d) {
  if (!d) return '';
  var dt = new Date(d);
  return dt.getFullYear()+'/'+String(dt.getMonth()+1).padStart(2,'0')+'/'+String(dt.getDate()).padStart(2,'0');
}
function getApiKey() {
  try { return window.__apiKey || ''; } catch(e) { return ''; }
}
function getDetail(e) {
  if (e.category==='旅費交通費') {
    var p = [];
    if (e.travel_from||e.travel_to) p.push((e.travel_from||'')+'→'+(e.travel_to||''));
    if (e.travel_method) p.push(e.travel_method);
    if (e.trip_type) p.push(e.trip_type);
    return p.join(' / ');
  }
  if (e.category==='書籍代'&&e.book_title) return e.book_title;
  return e.description;
}
function isTransportEntry(e) {
  return e.category === '旅費交通費' && (e.travel_method === '電車' || e.travel_method === 'バス');
}
function getMissingFieldWarnings(e) {
  var warnings = [];
  if (e.category==='旅費交通費') {
    if (!e.travel_from) warnings.push('出発地を入力してください！');
    if (!e.travel_to) warnings.push('到着地を入力してください！');
  }
  if (e.category==='書籍代') {
    if (!e.book_title) warnings.push('書籍名を入力してください！');
  }
  return warnings;
}
function extractNoReceiptReason(desc) {
  if (!desc) return '';
  var m = desc.match(/【領収書なし理由: (.+?)】/);
  return m ? m[1] : '';
}
function extractNoInvoiceReason(desc) {
  if (!desc) return '';
  var m = desc.match(/【インボイス番号なし理由: (.+?)】/);
  return m ? m[1] : '';
}
function hasNoInvoiceApproval(desc) {
  if (!desc) return false;
  return desc.indexOf('【インボイス番号なし: 責任者了承済】') >= 0 || desc.indexOf('【インボイス番号なし理由:') >= 0;
}
function fileToBase64(file) {
  return new Promise(function(resolve, reject) {
    var r = new FileReader();
    r.onload = function() { resolve(r.result.split(',')[1]); };
    r.onerror = function() { reject(new Error('読み込みエラー')); };
    r.readAsDataURL(file);
  });
}
function analyzeOneReceipt(base64, mediaType, apiKey) {
  var contentBlock;
  if (mediaType === 'application/pdf') {
    contentBlock = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
  } else {
    contentBlock = { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };
  }
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514', max_tokens: 1000,
      messages: [{ role: 'user', content: [
        contentBlock,
        { type: 'text', text: 'この領収書/レシートを分析してJSON形式で返してください。\n必ず以下のJSON形式のみで返してください（説明文や```は不要）:\n{"category":"旅費交通費 or 書籍代 or その他","amount":数値,"description":"内容の説明","travel_from":"出発地(旅費交通費の場合)","travel_to":"到着地(旅費交通費の場合)","travel_method":"交通手段(旅費交通費の場合)","book_title":"書籍名(書籍代の場合)","date":"YYYY-MM-DD形式の日付(読み取れた場合)","invoice_number":"T+13桁のインボイス登録番号(読み取れた場合、なければ空文字)"}' }
      ]}]
    })
  }).then(function(resp) { return resp.json(); }).then(function(data) {
    var text = '';
    if (data.content) { for (var i=0;i<data.content.length;i++) { if(data.content[i].type==='text') text+=data.content[i].text; } }
    return JSON.parse(text.replace(/```json|```/g,'').trim());
  });
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

export default function ExpensePage() {
  var auth = useAuth();
  var now = new Date();
  var _y = useState(now.getFullYear()), year = _y[0], setYear = _y[1];
  var _m = useState(now.getMonth()+1), month = _m[0], setMonth = _m[1];
  var _rid = useState(null), reportId = _rid[0], setReportId = _rid[1];
  var _st = useState('下書き'), status = _st[0], setStatus = _st[1];
  var _entries = useState([]), entries = _entries[0], setEntries = _entries[1];
  var _ld = useState(true), loading = _ld[0], setLoading = _ld[1];

  // --- 領収書経費フォーム ---
  var _show = useState(false), showForm = _show[0], setShowForm = _show[1];
  var _editId = useState(null), editId = _editId[0], setEditId = _editId[1];
  var _date = useState(''), expDate = _date[0], setExpDate = _date[1];
  var _cat = useState('その他'), cat = _cat[0], setCat = _cat[1];
  var _amt = useState(''), amt = _amt[0], setAmt = _amt[1];
  var _receiptAmt = useState(''), receiptAmt = _receiptAmt[0], setReceiptAmt = _receiptAmt[1];
  var _amtMismatchReason = useState(''), amtMismatchReason = _amtMismatchReason[0], setAmtMismatchReason = _amtMismatchReason[1];
  var _desc = useState(''), desc = _desc[0], setDesc = _desc[1];
  var _from = useState(''), tFrom = _from[0], setTFrom = _from[1];
  var _to = useState(''), tTo = _to[0], setTTo = _to[1];
  var _method = useState(''), tMethod = _method[0], setTMethod = _method[1];
  var _book = useState(''), bookTitle = _book[0], setBookTitle = _book[1];
  var _tripType = useState('片道'), tripType = _tripType[0], setTripType = _tripType[1];
  var _receiptData = useState(''), receiptData = _receiptData[0], setReceiptData = _receiptData[1];
  var _receiptName = useState(''), receiptName = _receiptName[0], setReceiptName = _receiptName[1];
  var _invoiceNum = useState(''), invoiceNum = _invoiceNum[0], setInvoiceNum = _invoiceNum[1];
  var _noReceiptReason = useState(''), noReceiptReason = _noReceiptReason[0], setNoReceiptReason = _noReceiptReason[1];
  var _noReceiptMode = useState(false), noReceiptMode = _noReceiptMode[0], setNoReceiptMode = _noReceiptMode[1];
  var _noInvoiceMode = useState(false), noInvoiceMode = _noInvoiceMode[0], setNoInvoiceMode = _noInvoiceMode[1];
  var _noInvoiceReason = useState(''), noInvoiceReason = _noInvoiceReason[0], setNoInvoiceReason = _noInvoiceReason[1];
  var _purchaseApproved = useState(false), purchaseApproved = _purchaseApproved[0], setPurchaseApproved = _purchaseApproved[1];
  var _saving = useState(false), saving = _saving[0], setSaving = _saving[1];
  var _uploading = useState(false), uploading = _uploading[0], setUploading = _uploading[1];
  var _uploadProgress = useState(''), uploadProgress = _uploadProgress[0], setUploadProgress = _uploadProgress[1];
  var _t = useState(''), toast = _t[0], setToast = _t[1];
  var _detail = useState(null), detailEntry = _detail[0], setDetailEntry = _detail[1];
  var _checked = useState({}), checked = _checked[0], setChecked = _checked[1];
  var fileRef = useRef(null);

  // --- 交通費フォーム ---
  var _showTransport = useState(false), showTransport = _showTransport[0], setShowTransport = _showTransport[1];
  var _tMeth = useState('電車'), tMeth = _tMeth[0], setTMeth = _tMeth[1];
  var _tF = useState(''), tF = _tF[0], setTF = _tF[1];
  var _tT = useState(''), tT = _tT[0], setTT = _tT[1];
  var _tTy = useState('片道'), tTy = _tTy[0], setTTy = _tTy[1];
  var _tAm = useState(''), tAm = _tAm[0], setTAm = _tAm[1];
  var _tEditId = useState(null), tEditId = _tEditId[0], setTEditId = _tEditId[1];
  var _tEditDate = useState(''), tEditDate = _tEditDate[0], setTEditDate = _tEditDate[1];
  var _selDates = useState([]), selDates = _selDates[0], setSelDates = _selDates[1];
  var _favs = useState([]), favs = _favs[0], setFavs = _favs[1];
  var _showFavForm = useState(false), showFavForm = _showFavForm[0], setShowFavForm = _showFavForm[1];
  var _favName = useState(''), favName = _favName[0], setFavName = _favName[1];

  function flash(msg) { setToast(msg); setTimeout(function(){setToast('');}, 3000); }

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

  function loadFavs() {
    if (!auth.user) return;
    supabase.from('favorite_routes').select('*').eq('user_id', auth.user.id).order('route_name')
      .then(function(res) { setFavs(res.data || []); })
      .catch(function() {});
  }

  useEffect(function() { loadData(); loadFavs(); }, [auth.user, year, month]);

  useEffect(function() {
    supabase.from('system_settings').select('value').eq('key', 'anthropic_api_key').single()
      .then(function(res) { if (res.data) window.__apiKey = res.data.value; }).catch(function(){});
  }, []);

  function resetForm() {
    setExpDate(''); setCat('その他'); setAmt(''); setDesc('');
    setReceiptAmt(''); setAmtMismatchReason('');
    setTFrom(''); setTTo(''); setTMethod(''); setBookTitle(''); setTripType('片道');
    setReceiptData(''); setReceiptName(''); setInvoiceNum('');
    setNoReceiptReason(''); setNoReceiptMode(false);
    setNoInvoiceMode(false); setNoInvoiceReason('');
    setPurchaseApproved(false);
    setEditId(null); setShowForm(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function resetTransport() {
    setTMeth('電車'); setTF(''); setTT(''); setTTy('片道'); setTAm('');
    setTEditId(null); setTEditDate(''); setSelDates([]); setShowTransport(false);
    setShowFavForm(false); setFavName('');
  }

  function handleSingleFile(e) {
    var file = e.target.files[0];
    if (!file) return;
    var apiKey = getApiKey();
    fileToBase64(file).then(function(b64) {
      setReceiptData(b64); setReceiptName(file.name);
      if (!apiKey) { flash('領収書を添付しました'); return; }
      setUploading(true); setUploadProgress('読み取り中...');
      analyzeOneReceipt(b64, file.type||'image/png', apiKey)
        .then(function(result) {
          if (result.category && CATEGORIES.indexOf(result.category)>=0) setCat(result.category);
          if (result.amount) { setAmt(String(Math.round(Number(result.amount)))); setReceiptAmt(String(Math.round(Number(result.amount)))); }
          if (result.description) setDesc(result.description);
          if (result.travel_from) setTFrom(result.travel_from);
          if (result.travel_to) setTTo(result.travel_to);
          if (result.travel_method) setTMethod(result.travel_method);
          if (result.book_title) setBookTitle(result.book_title);
          if (result.date) setExpDate(result.date);
          if (result.invoice_number) setInvoiceNum(result.invoice_number);
          flash('読み取り完了');
        })
        .catch(function() { flash('自動読み取りに失敗'); })
        .finally(function() { setUploading(false); setUploadProgress(''); });
    });
  }

  function handleSave() {
    if (!expDate || !amt) { flash('日付と金額は必須です'); return; }
    var amount = Math.round(Number(amt)) || 0;
    if (cat === '旅費交通費' && (!tFrom || !tTo)) { flash('旅費交通費の発着点は必須です'); return; }
    if (!receiptData && !noReceiptMode) { flash('領収書のアップロードは必須です。領収書がない場合は「領収書なしで申告」を選択してください'); return; }
    if (!receiptData && noReceiptMode && !noReceiptReason.trim()) { flash('領収書なしの理由を入力してください'); return; }
    if (receiptData && !invoiceNum && !noInvoiceMode) { flash('インボイス番号を入力してください。番号がない場合は「インボイス番号なしで申告」を選択してください'); return; }
    if (receiptData && !invoiceNum && noInvoiceMode && !noInvoiceReason.trim()) { flash('インボイス番号なしの理由を入力してください'); return; }
    if (amount >= 3000 && !purchaseApproved) { flash('承認を得てから登録してください'); return; }
    if (receiptAmt && Math.round(Number(amt)) !== Math.round(Number(receiptAmt)) && !amtMismatchReason.trim()) {
      flash('領収書の金額（¥' + Number(receiptAmt).toLocaleString() + '）と入力金額（¥' + amount.toLocaleString() + '）が異なります。理由を入力してください');
      return;
    }
    if (cat === '旅費交通費' && tMethod) {
      var expDt = new Date(expDate);
      var expM = expDt.getFullYear() * 12 + expDt.getMonth();
      var repM = year * 12 + (month - 1);
      if (repM < expM) { flash('予約系経費は利用月以降に申請してください（経費日付: ' + expDate + '）'); return; }
    }
    setSaving(true);
    var descWithReason = desc;
    if (!receiptData && noReceiptMode && noReceiptReason.trim()) {
      descWithReason = (desc ? desc + ' ' : '') + '【領収書なし理由: ' + noReceiptReason.trim() + '】';
    }
    if (receiptData && !invoiceNum && noInvoiceMode && noInvoiceReason.trim()) {
      descWithReason = (descWithReason ? descWithReason + ' ' : '') + '【インボイス番号なし理由: ' + noInvoiceReason.trim() + '】';
    }
    var data = {
      report_id: reportId, expense_date: expDate, category: cat,
      amount: amount, description: descWithReason,
      travel_from: tFrom, travel_to: tTo, travel_method: tMethod,
      book_title: bookTitle, trip_type: tripType,
      receipt_data: receiptData, receipt_filename: receiptName,
      invoice_number: invoiceNum,
      receipt_amount: receiptAmt ? Math.round(Number(receiptAmt)) : 0,
      amount_mismatch_reason: amtMismatchReason || '',
    };
    var p = editId ? supabase.from('expense_entries').update(data).eq('id', editId)
      : supabase.from('expense_entries').insert(data);
    p.then(function() { flash(editId?'更新':'登録'); resetForm(); loadData(); })
      .catch(function() { flash('保存失敗'); })
      .finally(function() { setSaving(false); });
  }

  // --- 交通費 ---
  function toggleDate(dateStr) {
    var idx = selDates.indexOf(dateStr);
    if (idx >= 0) { var copy = selDates.slice(); copy.splice(idx, 1); setSelDates(copy); }
    else { setSelDates(selDates.concat([dateStr])); }
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

  // ---- 共通 ----
  function handleEdit(e) {
    if (isTransportEntry(e)) {
      setTMeth(e.travel_method); setTF(e.travel_from||'');
      setTT(e.travel_to||''); setTTy(e.trip_type||'片道'); setTAm(String(e.amount));
      setTEditId(e.id); setTEditDate(e.expense_date); setSelDates([]);
      setShowTransport(true); setShowForm(false);
    } else {
      setExpDate(e.expense_date); setCat(e.category); setAmt(String(e.amount));
      setDesc(e.description); setTFrom(e.travel_from||''); setTTo(e.travel_to||'');
      setTMethod(e.travel_method||''); setBookTitle(e.book_title||'');
      setTripType(e.trip_type||'片道');
      setReceiptData(e.receipt_data||''); setReceiptName(e.receipt_filename||'');
      setInvoiceNum(e.invoice_number||'');
      setReceiptAmt(e.receipt_amount ? String(e.receipt_amount) : '');
      setAmtMismatchReason(e.amount_mismatch_reason || '');
      setEditId(e.id); setShowForm(true); setShowTransport(false);
    }
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
  var isEditable = true;

  var checkedIds = Object.keys(checked).filter(function(k){return checked[k];});
  var allChecked = entries.length > 0 && checkedIds.length === entries.length;

  function toggleCheck(id) { var next = Object.assign({}, checked); next[id] = !next[id]; setChecked(next); }
  function toggleAll() {
    if (allChecked) { setChecked({}); }
    else { var next = {}; entries.forEach(function(e){next[e.id]=true;}); setChecked(next); }
  }
  function handleBatchDelete() {
    if (checkedIds.length === 0) { flash('削除する項目を選択してください'); return; }
    if (!confirm(checkedIds.length+'件を削除しますか？')) return;
    setSaving(true);
    Promise.all(checkedIds.map(function(id){ return supabase.from('expense_entries').delete().eq('id', id); }))
      .then(function(){ flash(checkedIds.length+'件削除しました'); setChecked({}); loadData(); })
      .catch(function(){ flash('削除に失敗しました'); })
      .finally(function(){ setSaving(false); });
  }
  function handleBatchDownloadReceipts() {
    var withReceipts = entries.filter(function(e){return e.receipt_data;});
    if (withReceipts.length === 0) { flash('領収書がありません'); return; }
    withReceipts.forEach(function(e, i) {
      setTimeout(function() {
        var ext = (e.receipt_filename || '').toLowerCase().endsWith('.pdf') ? 'pdf' : 'png';
        var mime = ext === 'pdf' ? 'application/pdf' : 'image/png';
        var binary = atob(e.receipt_data);
        var arr = new Uint8Array(binary.length);
        for (var j = 0; j < binary.length; j++) arr[j] = binary.charCodeAt(j);
        var blob = new Blob([arr], { type: mime });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = (year+'-'+String(month).padStart(2,'0')+'-'+fmtDate(e.expense_date).replace(/\//g,'')+'-'+(e.category||'expense')+'.'+ext);
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      }, i * 300);
    });
    flash(withReceipts.length+'件の領収書をダウンロード中...');
  }

  if (loading) return (<div className="page-loading"><div className="spinner"></div><span>読み込み中...</span></div>);

  // 詳細ビュー
  if (detailEntry) {
    var de = detailEntry;
    var deIsTransport = isTransportEntry(de);
    return (
      <div className="expense-page">
        {toast && <div className="toast">{toast}</div>}
        <div className="month-header">
          <button className="btn-ghost" onClick={function(){setDetailEntry(null);}}>← 戻る</button>
          <h2 className="month-title">{deIsTransport ? '交通費詳細' : '経費詳細'}</h2>
        </div>
        <div className="card">
          <div className="trip-detail-grid">
            <div className="trip-detail-item"><span className="trip-detail-label">日付</span><span className="trip-detail-value">{fmtDate(de.expense_date)}</span></div>
            <div className="trip-detail-item"><span className="trip-detail-label">費目</span><span className="trip-detail-value"><span className={'expense-cat expense-cat-'+de.category}>{de.category}</span></span></div>
            <div className="trip-detail-item"><span className="trip-detail-label">金額</span><span className="trip-detail-value">¥{de.amount.toLocaleString()}</span></div>
            {!deIsTransport && de.receipt_amount > 0 && (<div className="trip-detail-item"><span className="trip-detail-label">領収書金額</span><span className="trip-detail-value">¥{de.receipt_amount.toLocaleString()}</span></div>)}
            {!deIsTransport && de.receipt_amount > 0 && de.amount !== de.receipt_amount && (
              <div className="trip-detail-item" style={{gridColumn:'1/-1'}}>
                <div className="amt-mismatch-box">
                  <div className="amt-mismatch-header">⚠️ 領収書金額（¥{de.receipt_amount.toLocaleString()}）と申請金額（¥{de.amount.toLocaleString()}）が異なります</div>
                  {de.amount_mismatch_reason && <div style={{marginTop:'6px',fontSize:'13px'}}>理由: {de.amount_mismatch_reason}</div>}
                </div>
              </div>
            )}
            {de.category==='旅費交通費'&&de.travel_from&&(<div className="trip-detail-item"><span className="trip-detail-label">区間</span><span className="trip-detail-value">{de.travel_from} → {de.travel_to}</span></div>)}
            {de.category==='旅費交通費'&&de.travel_method&&(<div className="trip-detail-item"><span className="trip-detail-label">交通手段</span><span className="trip-detail-value">{de.travel_method}</span></div>)}
            {de.category==='旅費交通費'&&de.trip_type&&(<div className="trip-detail-item"><span className="trip-detail-label">片道/往復</span><span className="trip-detail-value">{de.trip_type}</span></div>)}
            {de.category==='書籍代'&&de.book_title&&(<div className="trip-detail-item"><span className="trip-detail-label">書籍名</span><span className="trip-detail-value">{de.book_title}</span></div>)}
            {de.category!=='旅費交通費'&&de.description&&(<div className="trip-detail-item"><span className="trip-detail-label">内容</span><span className="trip-detail-value">{de.description.replace(/【領収書なし理由: .+?】/g,'').replace(/【インボイス番号なし理由: .+?】/g,'').replace(/【インボイス番号なし: 責任者了承済】/g,'').trim()}</span></div>)}
            {deIsTransport && (<div className="transport-no-receipt"><span>🚃 電車・バスの交通費のため領収書不要</span></div>)}
            {!deIsTransport && de.receipt_data && (<div className="trip-detail-item"><span className="trip-detail-label">インボイス番号</span><span className="trip-detail-value">{de.invoice_number ? de.invoice_number : (extractNoInvoiceReason(de.description) ? <span className="no-invoice-approved-detail">なし（理由: {extractNoInvoiceReason(de.description)}）</span> : hasNoInvoiceApproval(de.description) ? <span className="no-invoice-approved-detail">なし（責任者了承済）</span> : <span className="invoice-warning-inline">⚠️ 未登録</span>)}</span></div>)}
            {!deIsTransport && !de.receipt_data && (
              <div className="trip-detail-item" style={{gridColumn:'1/-1'}}>
                <div className="no-receipt-detail-box">
                  <div className="no-receipt-detail-header">📎 領収書なし（例外申告）</div>
                  {extractNoReceiptReason(de.description) && <div className="no-receipt-detail-reason">理由: {extractNoReceiptReason(de.description)}</div>}
                </div>
              </div>
            )}
          </div>
          {!deIsTransport && de.receipt_data && (
            <div className="receipt-preview-section">
              <h3 className="trip-breakdown-title">領収書</h3>
              <div className="receipt-preview-box">
                {de.receipt_filename && de.receipt_filename.toLowerCase().endsWith('.pdf') ? (
                  <div className="receipt-pdf-notice"><span>📄 {de.receipt_filename}</span>
                    <button className="btn-small" onClick={function(){var b=atob(de.receipt_data);var a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);window.open(URL.createObjectURL(new Blob([a],{type:'application/pdf'})),'_blank');}}>PDFを開く</button>
                  </div>
                ) : (<img src={'data:image/png;base64,'+de.receipt_data} alt="領収書" className="receipt-image" />)}
              </div>
            </div>
          )}
          {isEditable && (
            <div className="trip-detail-actions">
              <button className="btn-outline" onClick={function(){handleEdit(de);}}>✏️ 編集</button>
              <button className="btn-danger" onClick={function(){handleDeleteEntry(de.id);}}>🗑 削除</button>
            </div>
          )}
        </div>
      </div>
    );
  }

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
          <button className="btn-outline" onClick={function(){exportExpenseExcel(entries,year,month,auth.profile?auth.profile.full_name:'');}}>📊 Excel</button>
          <button className="btn-outline" onClick={function(){openReceiptCompilationPDF(entries,year,month,auth.profile?auth.profile.full_name:'');}}>🧾 領収書PDF</button>
        </div>
      </div>

      {/* 経費タイプ選択ボタン */}
      {isEditable && (
        <div className="expense-actions-row">
          <div className="expense-btn-row">
            <button className={'expense-tab-btn'+(showTransport?' expense-tab-active':'')} onClick={function(){
              if (showTransport) { resetTransport(); } else { resetForm(); setShowTransport(true); setShowForm(false); }
            }}>
              🚃 交通費を追加（電車・バス）※領収書不要
            </button>
            <button className={'expense-tab-btn'+(showForm?' expense-tab-active':'')} onClick={function(){
              if (showForm) { resetForm(); } else { resetTransport(); setShowForm(true); setShowTransport(false); }
            }}>
              ✏️ その他経費を追加 ※領収書必要
            </button>
          </div>
        </div>
      )}

      {/* 交通費入力フォーム */}
      {showTransport && isEditable && (
        <div className="card" style={{marginBottom:'16px'}}>
          <h3 className="card-title">{tEditId ? '交通費を編集' : '🚃 交通費（電車・バス）— 領収書不要'}</h3>
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
                <div><label className="form-label">利用日</label><input className="form-input" type="date" value={tEditDate} onChange={function(e){setTEditDate(e.target.value);}} /></div>
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

      {/* その他経費フォーム */}
      {showForm && isEditable && (
        <div className="card" style={{marginBottom:'16px'}}>
          <h3 className="card-title">{editId ? '経費を編集' : '✏️ その他経費を追加'}</h3>
          <div className="receipt-upload">
            <label className="receipt-label receipt-label-required">
              {uploading ? ('🔄 '+uploadProgress) : '📎 領収書を添付（複数可）※必須'}
              <input ref={fileRef} type="file" accept="image/*,.pdf" multiple onChange={function(e){
                var files = Array.from(e.target.files);
                if (!files.length) return;
                if (files.length === 1) { handleSingleFile(e); return; }
                var apiKey = getApiKey();
                if (!apiKey) { flash('APIキー未設定のため一括登録不可。1枚ずつ添付してください'); return; }
                if (!reportId) return;
                setUploading(true);
                var total = files.length, succeeded = 0;
                setUploadProgress('0 / '+total+' 処理中...');
                function processNext(idx) {
                  if (idx >= files.length) { setUploading(false); setUploadProgress(''); if (fileRef.current) fileRef.current.value = ''; flash(succeeded+'件登録'); loadData(); return; }
                  var file = files[idx];
                  setUploadProgress((idx+1)+' / '+total+' ('+file.name+')');
                  fileToBase64(file).then(function(b64) {
                    return analyzeOneReceipt(b64, file.type||'image/png', apiKey).then(function(result) {
                      return supabase.from('expense_entries').insert({
                        report_id: reportId, expense_date: result.date || (year+'-'+String(month).padStart(2,'0')+'-01'),
                        category: (result.category && CATEGORIES.indexOf(result.category)>=0) ? result.category : 'その他',
                        amount: Math.round(Number(result.amount)) || 0,
                        description: result.description || '', travel_from: result.travel_from || '',
                        travel_to: result.travel_to || '', travel_method: result.travel_method || '',
                        book_title: result.book_title || '', receipt_data: b64, receipt_filename: file.name,
                        invoice_number: result.invoice_number || '',
                      });
                    }).then(function() { succeeded++; });
                  }).catch(function() {
                    return fileToBase64(file).then(function(b64) {
                      return supabase.from('expense_entries').insert({
                        report_id: reportId, expense_date: year+'-'+String(month).padStart(2,'0')+'-01',
                        category: 'その他', amount: 0, description: file.name, receipt_data: b64, receipt_filename: file.name,
                      });
                    }).then(function() { succeeded++; });
                  }).finally(function() { processNext(idx + 1); });
                }
                processNext(0);
              }} disabled={uploading||noReceiptMode} style={{display:'none'}} />
            </label>
            {receiptName && <span className="receipt-attached">✅ {receiptName}</span>}
            {!receiptName && !noReceiptMode && <span className="receipt-required-hint">⚠️ 領収書のアップロードが必要です</span>}
            {!receiptName && !noReceiptMode && getApiKey() && <span className="receipt-hint-sub">複数選択で自動読取＆一括登録されます</span>}
          </div>
          {!receiptData && (
            <div className="no-receipt-section">
              {!noReceiptMode ? (
                <button className="btn-ghost" style={{fontSize:'11px',color:'#94a3b8'}} onClick={function(){setNoReceiptMode(true);}}>領収書がない場合はこちら（例外申告）</button>
              ) : (
                <div className="no-receipt-form">
                  <div className="no-receipt-header">
                    <span className="no-receipt-badge">⚠️ 領収書なしで申告</span>
                    <button className="btn-ghost" style={{fontSize:'11px'}} onClick={function(){setNoReceiptMode(false);setNoReceiptReason('');}}>取り消し</button>
                  </div>
                  <div className="form-group" style={{marginTop:'8px'}}>
                    <label className="form-label">領収書がない理由（必須）</label>
                    <input className="form-input" value={noReceiptReason} onChange={function(e){setNoReceiptReason(e.target.value);}} placeholder="例: 自販機での購入のため領収書なし" />
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="expense-form-grid">
            <div className="form-group"><label className="form-label">日付</label><input className="form-input" type="date" value={expDate} onChange={function(e){setExpDate(e.target.value);}} /></div>
            <div className="form-group"><label className="form-label">費目</label>
              <select className="form-select" value={cat} onChange={function(e){setCat(e.target.value);}}>
                {CATEGORIES.map(function(c){return <option key={c} value={c}>{c}</option>;})}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">金額（円）</label>
              <input className="form-input" type="number" value={amt} onChange={function(e){setAmt(e.target.value);}} placeholder="0" />
              {receiptAmt && <div className="receipt-amt-ref">📎 領収書読取金額: ¥{Number(receiptAmt).toLocaleString()}</div>}
            </div>
          </div>
          {receiptAmt && amt && Math.round(Number(amt)) !== Math.round(Number(receiptAmt)) && (
            <div className="amt-mismatch-box">
              <div className="amt-mismatch-header">⚠️ 領収書の読取金額（¥{Number(receiptAmt).toLocaleString()}）と入力金額（¥{Number(amt).toLocaleString()}）が異なります</div>
              <div className="form-group" style={{marginTop:'8px'}}>
                <label className="form-label">金額が異なる理由（必須）</label>
                <input className="form-input" value={amtMismatchReason} onChange={function(e){setAmtMismatchReason(e.target.value);}} placeholder="例: 割り勘のため半額を申請" />
              </div>
            </div>
          )}
          {cat==='旅費交通費'&&(<div className="expense-form-grid" style={{marginTop:'8px'}}>
            <div className="form-group"><label className="form-label">出発地</label><input className="form-input" value={tFrom} onChange={function(e){setTFrom(e.target.value);}} /></div>
            <div className="form-group"><label className="form-label">到着地</label><input className="form-input" value={tTo} onChange={function(e){setTTo(e.target.value);}} /></div>
            <div className="form-group"><label className="form-label">交通手段</label>
              <select className="form-select" value={tMethod} onChange={function(e){setTMethod(e.target.value);}}>
                <option value="">選択</option>{METHODS.map(function(m){return <option key={m} value={m}>{m}</option>;})}
              </select>
            </div>
          </div>)}
          {cat==='書籍代'&&(<div style={{marginTop:'8px'}}><div className="form-group"><label className="form-label">書籍名</label><input className="form-input" value={bookTitle} onChange={function(e){setBookTitle(e.target.value);}} /></div></div>)}
          {cat==='その他'&&(<div style={{marginTop:'8px'}}><div className="form-group"><label className="form-label">内容</label><input className="form-input" value={desc} onChange={function(e){setDesc(e.target.value);}} /></div></div>)}
          {receiptData && (
            <div style={{marginTop:'8px'}}>
              <div className="form-group">
                <label className="form-label">インボイス番号（T+13桁）</label>
                <input className="form-input" value={invoiceNum} onChange={function(e){setInvoiceNum(e.target.value);}} placeholder="T1234567890123" />
                {receiptData && !invoiceNum && !noInvoiceMode && <div className="invoice-warning">⚠️ インボイス番号が未入力です</div>}
              </div>
              {!invoiceNum && (
                <div className="no-receipt-section">
                  {!noInvoiceMode ? (
                    <button className="btn-ghost" style={{fontSize:'11px',color:'#94a3b8'}} onClick={function(){setNoInvoiceMode(true);}}>インボイス番号がない場合はこちら（例外申告）</button>
                  ) : (
                    <div className="no-receipt-form">
                      <div className="no-receipt-header">
                        <span className="no-receipt-badge">⚠️ インボイス番号なしで申告</span>
                        <button className="btn-ghost" style={{fontSize:'11px'}} onClick={function(){setNoInvoiceMode(false);setNoInvoiceReason('');}}>取り消し</button>
                      </div>
                      <div className="form-group" style={{marginTop:'8px'}}>
                        <label className="form-label">インボイス番号がない理由（必須）</label>
                        <input className="form-input" value={noInvoiceReason} onChange={function(e){setNoInvoiceReason(e.target.value);}} placeholder="例: 個人事業主のため未登録" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {amt && Number(amt) >= 3000 && (
            <div className="approval-check" style={{marginTop:'12px'}}>
              <label className="approval-label">購買申請承認済みですか？</label>
              <div className="approval-btns">
                <button className={'approval-btn'+(purchaseApproved?' approval-yes':'')} onClick={function(){setPurchaseApproved(true);}}>はい</button>
                <button className={'approval-btn'+(!purchaseApproved?' approval-no':'')} onClick={function(){setPurchaseApproved(false);}}>いいえ</button>
              </div>
              {!purchaseApproved && <span className="approval-warn">承認を得てから登録してください</span>}
            </div>
          )}
          <div style={{display:'flex',gap:'8px',marginTop:'16px'}}>
            <button className="btn-primary" style={{width:'auto',padding:'10px 24px'}} onClick={handleSave} disabled={saving}>{saving?'保存中...':editId?'更新':'登録'}</button>
            <button className="btn-outline" onClick={resetForm}>キャンセル</button>
          </div>
        </div>
      )}

      {/* 一覧 */}
      {entries.length === 0 ? (
        <div className="card"><p className="empty-state">この月の経費記録はありません。</p></div>
      ) : (
        <>
          <div className="batch-action-bar">
            <div className="batch-action-left">
              {checkedIds.length > 0 && isEditable && (
                <button className="btn-danger" style={{fontSize:'12px',padding:'6px 14px'}} onClick={handleBatchDelete}>🗑 選択した{checkedIds.length}件を削除</button>
              )}
            </div>
            <button className="btn-outline" style={{fontSize:'12px',padding:'6px 14px'}} onClick={handleBatchDownloadReceipts}>📥 領収書を一括DL</button>
          </div>
          <div className="card" style={{padding:'0',overflow:'hidden'}}>
            <table className="admin-table">
              <thead><tr>
                {isEditable && <th style={{textAlign:'center',width:'36px'}}><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>}
                <th style={{textAlign:'center',width:'80px'}}>日付</th>
                <th style={{textAlign:'center',width:'90px'}}>費目</th>
                <th style={{textAlign:'left'}}>内容</th>
                <th style={{textAlign:'center',width:'30px'}}>📎</th>
                <th style={{textAlign:'center',width:'130px'}}>インボイス</th>
                <th style={{textAlign:'right',width:'100px'}}>金額</th>
                {isEditable && <th style={{textAlign:'center',width:'100px'}}>操作</th>}
              </tr></thead>
              <tbody>
                {entries.map(function(e){
                  var rowWarnings = isTransportEntry(e) ? [] : getMissingFieldWarnings(e);
                  var noRcptReason = extractNoReceiptReason(e.description);
                  var noInvReason = extractNoInvoiceReason(e.description);
                  var noInvApproved = hasNoInvoiceApproval(e.description);
                  var eIsTransport = isTransportEntry(e);
                  return (
                    <tr key={e.id} className={'admin-table-row'+(checked[e.id]?' row-checked':'')} style={{cursor:'pointer'}} onClick={function(){setDetailEntry(e);}}>
                      {isEditable && (
                        <td style={{textAlign:'center'}} onClick={function(ev){ev.stopPropagation();}}>
                          <input type="checkbox" checked={!!checked[e.id]} onChange={function(){toggleCheck(e.id);}} />
                        </td>
                      )}
                      <td style={{textAlign:'center'}}>{fmtDate(e.expense_date)}</td>
                      <td style={{textAlign:'center'}}><span className={'expense-cat expense-cat-'+e.category}>{eIsTransport ? '🚃 '+e.travel_method : e.category}</span></td>
                      <td style={{textAlign:'left'}}>{getDetail(e)}{rowWarnings.length > 0 && <div className="missing-field-warning">{rowWarnings.join(' / ')}</div>}</td>
                      <td style={{textAlign:'center'}}>
                        {eIsTransport ? <span style={{fontSize:'10px',color:'#94a3b8'}}>不要</span>
                          : e.receipt_data ? (e.invoice_number ? '📎' : '⚠️')
                          : (noRcptReason ? <span className="no-receipt-badge-inline" title={noRcptReason}>なし</span> : '')}
                      </td>
                      <td style={{textAlign:'center',fontSize:'11px',fontFamily:'var(--mono)'}}>
                        {eIsTransport ? <span style={{fontSize:'10px',color:'#94a3b8'}}>—</span>
                          : e.invoice_number ? e.invoice_number
                          : e.receipt_data
                            ? (noInvReason ? <span className="no-invoice-approved-inline" title={'理由: '+noInvReason}>なし(理由有)</span>
                              : noInvApproved ? <span className="no-invoice-approved-inline">なし(了承済)</span>
                              : <span className="invoice-warning-inline">未登録</span>)
                            : (noRcptReason ? <span className="no-receipt-reason-inline" title={noRcptReason}>領収書なし</span> : '')}
                      </td>
                      <td style={{textAlign:'right',fontFamily:'var(--mono)',fontWeight:600}}>¥{e.amount.toLocaleString()}</td>
                      {isEditable && (
                        <td style={{textAlign:'center'}} onClick={function(ev){ev.stopPropagation();}}>
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
                  <td colSpan={isEditable?5:4} style={{textAlign:'right',fontWeight:700,padding:'10px 8px'}}>月合計</td>
                  <td></td>
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
