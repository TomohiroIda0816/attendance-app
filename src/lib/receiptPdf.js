function fmtDate(d) {
  if (!d) return '';
  var dt = new Date(d);
  return dt.getFullYear() + '/' + String(dt.getMonth() + 1).padStart(2, '0') + '/' + String(dt.getDate()).padStart(2, '0');
}

export function openReceiptCompilationPDF(entries, year, month, userName) {
  var withReceipts = entries.filter(function(e) { return e.receipt_data; });
  if (withReceipts.length === 0) { alert('領収書が添付された経費がありません。'); return; }

  var html = '<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">'
    + '<title>領収書一覧 ' + year + '年' + month + '月 - ' + userName + '</title>'
    + '<style>'
    + '@page{size:A4 portrait;margin:10mm;}'
    + '*{margin:0;padding:0;box-sizing:border-box;}'
    + 'html,body{width:190mm;max-width:190mm;overflow:hidden;}'
    + 'body{font-family:"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif;font-size:11px;color:#1a1a2e;padding:8mm;width:190mm;max-width:190mm;}'
    + 'h1{font-size:18px;text-align:center;margin-bottom:8px;letter-spacing:4px;font-weight:800;}'
    + '.meta{text-align:center;margin-bottom:12px;font-size:11px;color:#64748b;}'
    + 'table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:12px;table-layout:fixed;}'
    + 'th,td{border:1px solid #94a3b8;padding:4px 6px;text-align:center;overflow:hidden;text-overflow:ellipsis;}'
    + 'th{background:#1e293b;color:#f1f5f9;font-weight:600;-webkit-print-color-adjust:exact;print-color-adjust:exact;}'
    + 'td.left{text-align:left;}'
    + 'td.right{text-align:right;font-weight:600;}'
    + '.receipt-page{page-break-before:always;page-break-inside:avoid;overflow:hidden;}'
    + '.receipt-header{background:#1e293b;color:#f1f5f9;padding:8px 12px;font-size:12px;font-weight:600;margin-bottom:12px;border-radius:4px;-webkit-print-color-adjust:exact;print-color-adjust:exact;overflow:hidden;}'
    + '.receipt-header .no{font-size:14px;font-weight:800;float:left;}'
    + '.receipt-header .info{float:right;font-size:11px;}'
    + '.receipt-header::after{content:"";display:table;clear:both;}'
    + '.receipt-content{text-align:center;overflow:hidden;}'
    + '.receipt-content img{display:block;margin:0 auto;max-width:170mm;width:auto;height:auto;max-height:240mm;object-fit:contain;border:1px solid #e2e8f0;border-radius:4px;}'
    + '.receipt-content embed{display:block;width:170mm;height:250mm;border:1px solid #e2e8f0;margin:0 auto;}'
    + '.pdf-notice{text-align:center;color:#64748b;padding:20px;}'
    + '@media print{'
    + '  html,body{width:100%!important;max-width:100%!important;}'
    + '  body{padding:0;}'
    + '  .receipt-page{page-break-before:always;page-break-inside:avoid;}'
    + '  .receipt-content img{max-width:100%;max-height:250mm;object-fit:contain;}'
    + '  .receipt-content embed{width:100%;height:260mm;}'
    + '}'
    + '</style></head><body>';

  // Page 1: Index table
  html += '<h1>領 収 書 一 覧</h1>';
  html += '<div class="meta">' + userName + ' — ' + year + '年' + month + '月 (' + withReceipts.length + '件)</div>';

  html += '<table><thead><tr>';
  html += '<th style="width:8%">No.</th>';
  html += '<th style="width:16%">日付</th>';
  html += '<th style="width:18%">費目</th>';
  html += '<th style="width:40%">内容</th>';
  html += '<th style="width:18%">金額</th>';
  html += '</tr></thead><tbody>';

  // Use entries (not withReceipts) for numbering consistency
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    if (!e.receipt_data) continue;
    var detail = '';
    if (e.category === '旅費交通費') {
      var parts = [];
      if (e.travel_from || e.travel_to) parts.push((e.travel_from || '') + '→' + (e.travel_to || ''));
      if (e.travel_method) parts.push(e.travel_method);
      detail = parts.join(' / ');
    } else if (e.category === '書籍代' && e.book_title) {
      detail = e.book_title;
    } else {
      detail = e.description || '';
    }
    html += '<tr>';
    html += '<td>' + (i + 1) + '</td>';
    html += '<td>' + fmtDate(e.expense_date) + '</td>';
    html += '<td>' + e.category + '</td>';
    html += '<td class="left">' + detail + '</td>';
    html += '<td class="right">&yen;' + e.amount.toLocaleString() + '</td>';
    html += '</tr>';
  }
  html += '</tbody></table>';

  // Pages 2+: Each receipt
  for (var j = 0; j < entries.length; j++) {
    var entry = entries[j];
    if (!entry.receipt_data) continue;
    var isPdf = entry.receipt_filename && entry.receipt_filename.toLowerCase().endsWith('.pdf');

    html += '<div class="receipt-page">';
    html += '<div class="receipt-header">';
    html += '<span class="no">No.' + (j + 1) + '</span>';
    html += '<span class="info">' + fmtDate(entry.expense_date) + ' — ' + entry.category + ' — &yen;' + entry.amount.toLocaleString() + '</span>';
    html += '</div>';
    html += '<div class="receipt-content">';

    if (isPdf) {
      html += '<div id="pdf-container-' + j + '" class="pdf-notice">PDF領収書（印刷プレビューでは表示されない場合があります）<br>' + (entry.receipt_filename || 'receipt.pdf') + '</div>';
    } else {
      html += '<img src="data:image/png;base64,' + entry.receipt_data + '" alt="領収書 No.' + (j + 1) + '" />';
    }
    html += '</div></div>';
  }

  // Script to handle PDF embeds and auto-print
  html += '<script>';
  html += 'window.onload = function() {';
  var hasPdf = false;
  for (var k = 0; k < entries.length; k++) {
    if (!entries[k].receipt_data) continue;
    if (entries[k].receipt_filename && entries[k].receipt_filename.toLowerCase().endsWith('.pdf')) {
      hasPdf = true;
      break;
    }
  }
  if (hasPdf) {
    html += 'var entries = ' + JSON.stringify(entries.map(function(e, idx) {
      return { idx: idx, isPdf: !!(e.receipt_filename && e.receipt_filename.toLowerCase().endsWith('.pdf')), data: e.receipt_filename && e.receipt_filename.toLowerCase().endsWith('.pdf') ? e.receipt_data : null };
    })) + ';';
    html += 'entries.forEach(function(e) {';
    html += '  if (!e.isPdf || !e.data) return;';
    html += '  var container = document.getElementById("pdf-container-" + e.idx);';
    html += '  if (!container) return;';
    html += '  try {';
    html += '    var binary = atob(e.data);';
    html += '    var arr = new Uint8Array(binary.length);';
    html += '    for (var i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);';
    html += '    var blob = new Blob([arr], { type: "application/pdf" });';
    html += '    var url = URL.createObjectURL(blob);';
    html += '    container.innerHTML = \'<embed src="\' + url + \'" type="application/pdf" style="display:block;width:100%;height:260mm;border:1px solid #e2e8f0;margin:0 auto;" />\';';
    html += '  } catch(err) { console.error(err); }';
    html += '});';
  }
  html += 'setTimeout(function(){ window.print(); }, 500);';
  html += '};';
  html += '<\/script>';
  html += '</body></html>';

  var w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}
