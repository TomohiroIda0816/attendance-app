var DOW = ['日','月','火','水','木','金','土'];

export function openInternAttendancePDF(reports, year, month, userName) {
  var daysInMonth = new Date(year, month, 0).getDate();
  var reportMap = {};
  reports.forEach(function(r) {
    var d = new Date(r.report_date).getDate();
    reportMap[d] = r;
  });
  var totalMin = 0;
  reports.forEach(function(r){
    if(r.work_hours){var p=r.work_hours.split(':');totalMin+=parseInt(p[0])*60+parseInt(p[1]||0);}
  });
  var totalH = Math.floor(totalMin/60)+':'+String(totalMin%60).padStart(2,'0');

  var rows = '';
  for (var d=1; d<=daysInMonth; d++) {
    var dt = new Date(year, month-1, d);
    var dow = dt.getDay();
    var cls = dow===0?'weekend':dow===6?'weekend':'';
    var dowCls = dow===0?' class="sun"':dow===6?' class="sat"':'';
    var r = reportMap[d];
    rows += '<tr class="'+cls+'">';
    rows += '<td>'+d+'</td>';
    rows += '<td'+dowCls+'>'+DOW[dow]+'</td>';
    rows += '<td>'+(r?r.start_time:'')+'</td>';
    rows += '<td>'+(r?r.end_time:'')+'</td>';
    rows += '<td>'+(r?r.break_minutes+'分':'')+'</td>';
    rows += '<td style="font-weight:600">'+(r?r.work_hours:'')+'</td>';
    rows += '<td class="left">'+(r?r.task_done:'')+'</td>';
    rows += '</tr>';
  }

  var html = '<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">'
    + '<title>インターン勤怠報告書 '+year+'年'+month+'月 - '+userName+'</title>'
    + '<style>'
    + '@page{size:A4 landscape;margin:12mm;}'
    + '*{margin:0;padding:0;box-sizing:border-box;}'
    + 'body{font-family:"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif;font-size:10px;color:#1a1a2e;padding:10mm;}'
    + 'h1{font-size:20px;text-align:center;margin-bottom:8px;letter-spacing:4px;font-weight:800;}'
    + '.meta{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:12px;}'
    + 'table{width:100%;border-collapse:collapse;font-size:9px;margin-bottom:12px;}'
    + 'th,td{border:1px solid #94a3b8;padding:4px 6px;text-align:center;white-space:nowrap;}'
    + 'th{background:#1e293b;color:#f1f5f9;font-weight:600;}'
    + 'tr.weekend{background:#eff6ff;}'
    + '.sun{color:#dc2626;}.sat{color:#2563eb;}'
    + 'td.left{text-align:left;max-width:300px;overflow:hidden;text-overflow:ellipsis;}'
    + '.footer-row td{background:#f8fafc;font-weight:700;font-size:10px;}'
    + '</style></head><body>'
    + '<h1>インターン勤怠報告書</h1>'
    + '<div class="meta"><span>氏名: '+userName+'</span><span>'+year+'年'+month+'月</span><span>出勤日数: '+reports.length+'日 / 合計稼働: '+totalH+'</span></div>'
    + '<table><thead><tr><th style="width:30px">日</th><th style="width:30px">曜</th><th style="width:50px">開始</th><th style="width:50px">終了</th><th style="width:50px">中抜け</th><th style="width:50px">稼働</th><th>やったこと</th></tr></thead><tbody>'
    + rows
    + '<tr class="footer-row"><td colspan="5" style="text-align:right">月合計</td><td style="font-family:monospace">'+totalH+'</td><td></td></tr>'
    + '</tbody></table></body></html>';

  var w = window.open('','_blank');
  w.document.write(html);
  w.document.close();
}

export function openInternDailyPDF(reports, year, month, userName) {
  var rows = '';
  reports.forEach(function(r) {
    rows += '<div class="report-card">'
      + '<div class="report-header"><span class="report-date">'+r.report_date+'</span><span>'+r.start_time+' 〜 '+r.end_time+' (中抜け'+r.break_minutes+'分 / 稼働'+r.work_hours+')</span></div>'
      + '<div class="report-section"><span class="section-label">📝 やったこと</span><p>'+(r.task_done||'—')+'</p></div>'
      + '<div class="report-section"><span class="section-label">💡 わかったこと</span><p>'+(r.task_learned||'—')+'</p></div>'
      + '<div class="report-section"><span class="section-label">🚀 次に活かすこと</span><p>'+(r.task_next||'—')+'</p></div>'
      + '</div>';
  });

  var html = '<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">'
    + '<title>インターン日報 '+year+'年'+month+'月 - '+userName+'</title>'
    + '<style>'
    + '@page{size:A4 portrait;margin:15mm;}'
    + '*{margin:0;padding:0;box-sizing:border-box;}'
    + 'body{font-family:"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif;font-size:11px;color:#1a1a2e;padding:10mm;}'
    + 'h1{font-size:20px;text-align:center;margin-bottom:8px;letter-spacing:4px;font-weight:800;}'
    + '.meta{text-align:center;margin-bottom:16px;font-size:12px;color:#64748b;}'
    + '.report-card{border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:14px;page-break-inside:avoid;}'
    + '.report-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:600;}'
    + '.report-date{font-size:14px;color:#1e40af;}'
    + '.report-section{margin-bottom:8px;}'
    + '.section-label{font-size:11px;font-weight:700;display:block;margin-bottom:4px;}'
    + '.report-section p{font-size:11px;line-height:1.6;white-space:pre-wrap;padding-left:8px;}'
    + '</style></head><body>'
    + '<h1>インターン日報</h1>'
    + '<div class="meta">'+userName+' — '+year+'年'+month+'月 ('+reports.length+'日分)</div>'
    + rows
    + '</body></html>';

  var w = window.open('','_blank');
  w.document.write(html);
  w.document.close();
}
