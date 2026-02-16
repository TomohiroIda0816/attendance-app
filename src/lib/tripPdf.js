var LUNCH = 1500;
var DINNER = 2000;

export function openTripPDF(entries, year, month, userName, status) {
  var totalLunch = 0, totalDinner = 0, totalAll = 0;
  entries.forEach(function(e) {
    totalLunch += e.lunch_allowance;
    totalDinner += e.dinner_allowance;
    totalAll += e.total_allowance;
  });

  function fmtDate(d) {
    if (!d) return '';
    var dt = new Date(d);
    return (dt.getMonth()+1) + '/' + dt.getDate();
  }

  var html = '<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">'
    + '<title>出張報告書 ' + year + '年' + month + '月 - ' + userName + '</title>'
    + '<style>'
    + '@page{size:A4 portrait;margin:15mm;}'
    + '*{margin:0;padding:0;box-sizing:border-box;}'
    + 'body{font-family:"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif;font-size:11px;color:#1a1a2e;padding:10mm;}'
    + 'h1{font-size:20px;text-align:center;margin-bottom:10px;letter-spacing:4px;font-weight:800;}'
    + '.meta{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;font-size:12px;padding:0 4px;}'
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
    + '.empty-msg{text-align:center;padding:20px;color:#6b7280;font-size:13px;}'
    + '@media print{body{padding:0;}}'
    + '</style></head><body>';

  html += '<h1>出 張 報 告 書</h1>';
  html += '<div class="meta">';
  html += '<span>氏名: <strong>' + userName + '</strong></span>';
  html += '<span>' + year + '年 ' + month + '月</span>';

  var badgeCls = status === '申請済' ? 'submitted' : status === '承認済' ? 'approved' : status === '差戻し' ? 'rejected' : 'draft';
  html += '<span class="badge badge-' + badgeCls + '">' + (status || '下書き') + '</span>';
  html += '</div>';

  if (entries.length === 0) {
    html += '<div class="empty-msg">この月の出張記録はありません。</div>';
  } else {
    // 出張一覧テーブル
    html += '<table><thead><tr>';
    html += '<th style="width:30px">No.</th>';
    html += '<th>出張先</th>';
    html += '<th style="width:80px">出発日</th>';
    html += '<th style="width:80px">帰着日</th>';
    html += '<th style="width:40px">泊数</th>';
    html += '<th style="width:70px">昼食代</th>';
    html += '<th style="width:70px">夕食代</th>';
    html += '<th style="width:80px">手当合計</th>';
    html += '</tr></thead><tbody>';

    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      html += '<tr>';
      html += '<td>' + (i + 1) + '</td>';
      html += '<td class="left">' + e.destination + '</td>';
      html += '<td>' + fmtDate(e.departure_date) + '</td>';
      html += '<td>' + fmtDate(e.return_date) + '</td>';
      html += '<td>' + e.nights + '泊</td>';
      html += '<td class="right">&yen;' + e.lunch_allowance.toLocaleString() + '</td>';
      html += '<td class="right">&yen;' + e.dinner_allowance.toLocaleString() + '</td>';
      html += '<td class="right">&yen;' + e.total_allowance.toLocaleString() + '</td>';
      html += '</tr>';
    }

    html += '</tbody></table>';

    // サマリーテーブル
    html += '<div class="summary"><table>';
    html += '<thead><tr><th>項目</th><th>金額</th></tr></thead><tbody>';
    html += '<tr><td>昼食代合計</td><td class="right">&yen;' + totalLunch.toLocaleString() + '</td></tr>';
    html += '<tr><td>夕食代合計</td><td class="right">&yen;' + totalDinner.toLocaleString() + '</td></tr>';
    html += '<tr class="total-row"><td>出張手当合計</td><td class="right">&yen;' + totalAll.toLocaleString() + '</td></tr>';
    html += '</tbody></table></div>';
  }

  html += '<div class="signature-area">';
  html += '<div><div class="signature-box">承認者</div></div>';
  html += '<div><div class="signature-box">申請者</div></div>';
  html += '</div>';
  html += '<script>window.onload=function(){window.print();};<\/script>';
  html += '</body></html>';

  var w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}
