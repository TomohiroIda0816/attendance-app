export function openExpensePDF(entries, year, month, userName, status) {
  var totalAmount = 0;
  var catTotals = {};
  entries.forEach(function(e) {
    totalAmount += e.amount;
    catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
  });

  function fmtDate(d) {
    if (!d) return '';
    var dt = new Date(d);
    return (dt.getMonth()+1) + '/' + dt.getDate();
  }

  function catDetail(e) {
    if (e.category === '旅費交通費') {
      var parts = [];
      if (e.travel_from || e.travel_to) parts.push((e.travel_from||'') + ' → ' + (e.travel_to||''));
      if (e.travel_method) parts.push(e.travel_method);
      return parts.join(' / ');
    }
    if (e.category === '書籍代' && e.book_title) return '書籍: ' + e.book_title;
    return e.description;
  }

  var badgeCls = status==='申請済'?'submitted':status==='承認済'?'approved':status==='差戻し'?'rejected':'draft';

  var html = '<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">'
    + '<title>経費精算書 ' + year + '年' + month + '月 - ' + userName + '</title>'
    + '<style>'
    + '@page{size:A4 portrait;margin:15mm;}'
    + '*{margin:0;padding:0;box-sizing:border-box;}'
    + 'body{font-family:"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif;font-size:11px;color:#1a1a2e;padding:10mm;}'
    + 'h1{font-size:20px;text-align:center;margin-bottom:10px;letter-spacing:4px;font-weight:800;}'
    + '.meta{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;font-size:12px;}'
    + '.badge{display:inline-block;padding:2px 12px;border-radius:4px;font-size:11px;font-weight:600;}'
    + '.badge-submitted{background:#dcfce7;color:#166534;}'
    + '.badge-draft{background:#fef3c7;color:#92400e;}'
    + '.badge-approved{background:#dbeafe;color:#1e40af;}'
    + '.badge-rejected{background:#fee2e2;color:#991b1b;}'
    + 'table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:16px;}'
    + 'th,td{border:1px solid #94a3b8;padding:6px 8px;text-align:center;}'
    + 'th{background:#1e293b;color:#f1f5f9;font-weight:600;}'
    + 'td.left{text-align:left;}'
    + 'td.right{text-align:right;font-weight:600;}'
    + '.summary{margin-bottom:20px;}'
    + '.summary table{max-width:400px;}'
    + '.summary th{background:#374151;}'
    + '.total-row td{font-weight:700;font-size:12px;border-top:2px solid #1e293b;}'
    + '.signature-area{display:flex;justify-content:flex-end;gap:40px;margin-top:30px;font-size:11px;}'
    + '.signature-box{width:120px;text-align:center;border-bottom:1px solid #1e293b;padding-bottom:30px;}'
    + '.empty-msg{text-align:center;padding:20px;color:#6b7280;}'
    + '@media print{body{padding:0;}}'
    + '</style></head><body>';

  html += '<h1>経 費 精 算 書</h1>';
  html += '<div class="meta"><span>氏名: <strong>' + userName + '</strong></span>';
  html += '<span>' + year + '年 ' + month + '月</span>';
  html += '<span class="badge badge-' + badgeCls + '">' + (status||'下書き') + '</span></div>';

  if (entries.length === 0) {
    html += '<div class="empty-msg">この月の経費記録はありません。</div>';
  } else {
    html += '<table><thead><tr>';
    html += '<th style="width:30px">No.</th><th style="width:60px">日付</th>';
    html += '<th style="width:80px">費目</th><th>内容</th>';
    html += '<th style="width:90px">金額</th>';
    html += '</tr></thead><tbody>';

    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      html += '<tr>';
      html += '<td>' + (i+1) + '</td>';
      html += '<td>' + fmtDate(e.expense_date) + '</td>';
      html += '<td>' + e.category + '</td>';
      html += '<td class="left">' + catDetail(e) + '</td>';
      html += '<td class="right">&yen;' + e.amount.toLocaleString() + '</td>';
      html += '</tr>';
    }
    html += '</tbody></table>';

    // カテゴリ別サマリー
    html += '<div class="summary"><table>';
    html += '<thead><tr><th>費目</th><th>合計金額</th></tr></thead><tbody>';
    var cats = Object.keys(catTotals);
    for (var j = 0; j < cats.length; j++) {
      html += '<tr><td>' + cats[j] + '</td><td class="right">&yen;' + catTotals[cats[j]].toLocaleString() + '</td></tr>';
    }
    html += '<tr class="total-row"><td>経費合計</td><td class="right">&yen;' + totalAmount.toLocaleString() + '</td></tr>';
    html += '</tbody></table></div>';
  }

  html += '<div class="signature-area"><div><div class="signature-box">承認者</div></div><div><div class="signature-box">申請者</div></div></div>';
  html += '<script>window.onload=function(){window.print();};<\/script></body></html>';

  var w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}
