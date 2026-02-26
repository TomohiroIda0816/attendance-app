import XLSX from 'xlsx-js-style';

var DOW = ['日', '月', '火', '水', '木', '金', '土'];

var HEADER_FILL = { fgColor: { rgb: '1E293B' } };
var HEADER_FONT = { color: { rgb: 'F1F5F9' }, bold: true, sz: 10 };
var WEEKEND_FILL = { fgColor: { rgb: 'EFF6FF' } };
var BORDER_THIN = {
  top: { style: 'thin', color: { rgb: '94A3B8' } },
  bottom: { style: 'thin', color: { rgb: '94A3B8' } },
  left: { style: 'thin', color: { rgb: '94A3B8' } },
  right: { style: 'thin', color: { rgb: '94A3B8' } },
};

function cell(v, style) {
  return { v: v === undefined || v === null ? '' : v, s: Object.assign({}, { border: BORDER_THIN }, style || {}) };
}

function headerCell(v) {
  return cell(v, { fill: HEADER_FILL, font: HEADER_FONT, alignment: { horizontal: 'center', vertical: 'center' } });
}

export function exportInternAttendanceExcel(reports, year, month, userName) {
  var daysInMonth = new Date(year, month, 0).getDate();
  var reportMap = {};
  reports.forEach(function(r) {
    var d = new Date(r.report_date).getDate();
    reportMap[d] = r;
  });
  var totalMin = 0;
  reports.forEach(function(r) {
    if (r.work_hours) { var p = r.work_hours.split(':'); totalMin += parseInt(p[0]) * 60 + parseInt(p[1] || 0); }
  });
  var totalH = Math.floor(totalMin / 60) + ':' + String(totalMin % 60).padStart(2, '0');

  var wb = XLSX.utils.book_new();
  var wsData = [];

  // Title
  wsData.push([cell('インターン勤怠報告書', { font: { bold: true, sz: 16 }, alignment: { horizontal: 'center' } })]);
  // Meta
  wsData.push([
    cell('氏名: ' + userName, { font: { bold: true, sz: 11 } }),
    cell(''),
    cell(year + '年 ' + month + '月', { alignment: { horizontal: 'center' }, font: { sz: 11 } }),
    cell(''),
    cell(''),
    cell('出勤日数: ' + reports.length + '日 / 合計稼働: ' + totalH, { font: { sz: 11 }, alignment: { horizontal: 'right' } }),
  ]);
  wsData.push([]);

  // Header
  var headers = ['日', '曜', '開始', '終了', '中抜け', '稼働', 'やったこと'];
  wsData.push(headers.map(function(h) { return headerCell(h); }));

  // Data rows
  for (var d = 1; d <= daysInMonth; d++) {
    var dt = new Date(year, month - 1, d);
    var dow = dt.getDay();
    var isWeekend = dow === 0 || dow === 6;
    var rowFill = isWeekend ? WEEKEND_FILL : null;
    var baseStyle = rowFill ? { fill: rowFill } : {};
    var dowFont = dow === 0 ? { color: { rgb: 'DC2626' } } : dow === 6 ? { color: { rgb: '2563EB' } } : {};
    var r = reportMap[d];

    wsData.push([
      cell(d, Object.assign({}, baseStyle, { alignment: { horizontal: 'center' } })),
      cell(DOW[dow], Object.assign({}, baseStyle, { font: dowFont, alignment: { horizontal: 'center' } })),
      cell(r ? r.start_time : '', Object.assign({}, baseStyle, { alignment: { horizontal: 'center' } })),
      cell(r ? r.end_time : '', Object.assign({}, baseStyle, { alignment: { horizontal: 'center' } })),
      cell(r ? r.break_minutes + '分' : '', Object.assign({}, baseStyle, { alignment: { horizontal: 'center' } })),
      cell(r ? r.work_hours : '', Object.assign({}, baseStyle, { font: { bold: true }, alignment: { horizontal: 'center' } })),
      cell(r ? r.task_done : '', Object.assign({}, baseStyle, { alignment: { horizontal: 'left' } })),
    ]);
  }

  // Footer
  wsData.push([
    cell(''), cell(''), cell(''), cell(''),
    cell('月合計', { font: { bold: true, sz: 11 }, alignment: { horizontal: 'right' } }),
    cell(totalH, { font: { bold: true, sz: 11 }, alignment: { horizontal: 'center' } }),
    cell(''),
  ]);

  var ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
  ws['!cols'] = [
    { wch: 4 }, { wch: 4 }, { wch: 7 }, { wch: 7 },
    { wch: 7 }, { wch: 7 }, { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, '勤怠報告書');

  var fileName = 'インターン勤怠報告書_' + year + '年' + month + '月_' + userName + '.xlsx';
  XLSX.writeFile(wb, fileName);
}

export function exportInternDailyExcel(reports, year, month, userName) {
  var wb = XLSX.utils.book_new();
  var wsData = [];

  // Title
  wsData.push([cell('インターン日報', { font: { bold: true, sz: 16 }, alignment: { horizontal: 'center' } })]);
  wsData.push([cell(userName + ' — ' + year + '年' + month + '月 (' + reports.length + '日分)', { font: { sz: 11 }, alignment: { horizontal: 'center' } })]);
  wsData.push([]);

  // Each report as a block
  reports.forEach(function(r) {
    wsData.push([cell(r.report_date, { font: { bold: true, sz: 12, color: { rgb: '1E40AF' } }, fill: { fgColor: { rgb: 'F1F5F9' } } })]);
    wsData.push([cell('勤務時間: ' + r.start_time + ' 〜 ' + r.end_time + '  (中抜け' + r.break_minutes + '分 / 稼働' + r.work_hours + ')', { font: { sz: 10 } })]);
    wsData.push([cell('やったこと', { font: { bold: true, sz: 10 } })]);
    wsData.push([cell(r.task_done || '—', { font: { sz: 10 }, alignment: { wrapText: true } })]);
    wsData.push([cell('わかったこと', { font: { bold: true, sz: 10 } })]);
    wsData.push([cell(r.task_learned || '—', { font: { sz: 10 }, alignment: { wrapText: true } })]);
    wsData.push([cell('次に活かすこと', { font: { bold: true, sz: 10 } })]);
    wsData.push([cell(r.task_next || '—', { font: { sz: 10 }, alignment: { wrapText: true } })]);
    wsData.push([]); // separator
  });

  var ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws, '日報');

  var fileName = 'インターン日報_' + year + '年' + month + '月_' + userName + '.xlsx';
  XLSX.writeFile(wb, fileName);
}
