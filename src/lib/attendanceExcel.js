import XLSX from 'xlsx-js-style';
import { totalHours, workDayCount } from './utils';

var HEADER_FILL = { fgColor: { rgb: '1E293B' } };
var HEADER_FONT = { color: { rgb: 'F1F5F9' }, bold: true, sz: 10 };
var BORDER_THIN = {
  top: { style: 'thin', color: { rgb: '94A3B8' } },
  bottom: { style: 'thin', color: { rgb: '94A3B8' } },
  left: { style: 'thin', color: { rgb: '94A3B8' } },
  right: { style: 'thin', color: { rgb: '94A3B8' } },
};
var WEEKEND_FILL = { fgColor: { rgb: 'EFF6FF' } };
var HOLIDAY_FILL = { fgColor: { rgb: 'FFF1F2' } };

function calcOvertimeForExcel(r) {
  if (!r.work_hours) return '';
  if (r.work_type === '有給' || r.work_type === '欠勤') return '';
  var p = r.work_hours.split(':');
  var m = parseInt(p[0]) * 60 + parseInt(p[1] || 0);
  if (m <= 480) return '';
  var ot = m - 480;
  return Math.floor(ot / 60) + ':' + String(ot % 60).padStart(2, '0');
}

function totalOvertimeForExcel(rows) {
  var t = 0;
  rows.forEach(function(r) {
    var ot = calcOvertimeForExcel(r);
    if (ot) { var p = ot.split(':'); t += parseInt(p[0]) * 60 + parseInt(p[1] || 0); }
  });
  if (t === 0) return '0:00';
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}

function cell(v, style) {
  return { v: v === undefined || v === null ? '' : v, s: Object.assign({}, { border: BORDER_THIN }, style || {}) };
}

function headerCell(v) {
  return cell(v, { fill: HEADER_FILL, font: HEADER_FONT, alignment: { horizontal: 'center', vertical: 'center' } });
}

export function exportAttendanceExcel(rows, year, month, userName, status, transportEntries) {
  transportEntries = transportEntries || [];
  var th = totalHours(rows);
  var wd = workDayCount(rows);
  var ot = totalOvertimeForExcel(rows);
  var transportTotal = 0;
  transportEntries.forEach(function(e) { transportTotal += e.amount; });

  var wb = XLSX.utils.book_new();

  // --- Sheet1: 勤怠報告書 ---
  var wsData = [];

  // Title row
  wsData.push([cell('勤 怠 報 告 書', { font: { bold: true, sz: 16 }, alignment: { horizontal: 'center' } })]);
  // Meta row
  wsData.push([
    cell('氏名: ' + userName, { font: { bold: true, sz: 11 } }),
    cell(''),
    cell(''),
    cell(''),
    cell(year + '年 ' + month + '月', { alignment: { horizontal: 'center' }, font: { sz: 11 } }),
    cell(''),
    cell(''),
    cell(''),
    cell(status || '下書き', { font: { bold: true, sz: 11 }, alignment: { horizontal: 'right' } }),
  ]);
  wsData.push([]); // blank row

  // Header row
  var headers = ['日', '曜日', '祝日', '区分', '開始', '終了', '控除', '稼働', '残業', '稼動内容'];
  wsData.push(headers.map(function(h) { return headerCell(h); }));

  // Data rows
  rows.forEach(function(r) {
    var isWeekend = r.dow === '土' || r.dow === '日';
    var isHoliday = !!r.holiday;
    var rowFill = isHoliday ? HOLIDAY_FILL : isWeekend ? WEEKEND_FILL : null;
    var baseStyle = rowFill ? { fill: rowFill } : {};
    var dowFont = r.dow === '日' ? { color: { rgb: 'DC2626' } } : r.dow === '土' ? { color: { rgb: '2563EB' } } : {};
    var workTypeStyle = {};
    if (r.work_type === '有給') workTypeStyle = { font: { color: { rgb: '059669' }, bold: true } };
    else if (r.work_type === '欠勤') workTypeStyle = { font: { color: { rgb: 'DC2626' }, bold: true } };
    else if (r.work_type && r.work_type.includes('半休')) workTypeStyle = { font: { color: { rgb: '2563EB' }, bold: true } };

    wsData.push([
      cell(r.day, Object.assign({}, baseStyle, { alignment: { horizontal: 'center' } })),
      cell(r.dow, Object.assign({}, baseStyle, { font: dowFont, alignment: { horizontal: 'center' } })),
      cell(r.holiday || '', Object.assign({}, baseStyle, { font: { color: { rgb: 'DC2626' }, sz: 9 } })),
      cell(r.work_type && r.work_type !== '通常' ? r.work_type : '', Object.assign({}, baseStyle, workTypeStyle, { alignment: { horizontal: 'center' } })),
      cell(r.start_time || '', Object.assign({}, baseStyle, { alignment: { horizontal: 'center' } })),
      cell(r.end_time || '', Object.assign({}, baseStyle, { alignment: { horizontal: 'center' } })),
      cell(r.deduction || '', Object.assign({}, baseStyle, { alignment: { horizontal: 'center' } })),
      cell(r.work_hours || '', Object.assign({}, baseStyle, { font: { bold: true }, alignment: { horizontal: 'center' } })),
      cell(calcOvertimeForExcel(r), Object.assign({}, baseStyle, { font: { color: { rgb: 'F59E0B' }, bold: true }, alignment: { horizontal: 'center' } })),
      cell(r.work_content || '', Object.assign({}, baseStyle, { alignment: { horizontal: 'left' } })),
    ]);
  });

  // Summary row
  wsData.push([]);
  wsData.push([
    cell('稼働日数: ' + wd + '日', { font: { bold: true, sz: 11 } }),
    cell(''), cell(''), cell(''),
    cell('合計稼働時間: ' + th, { font: { bold: true, sz: 11 }, alignment: { horizontal: 'center' } }),
    cell(''), cell(''),
    cell('合計残業時間: ' + ot, { font: { bold: true, sz: 11 }, alignment: { horizontal: 'center' } }),
  ]);

  var ws = XLSX.utils.aoa_to_sheet(wsData);

  // Merge title cell
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
  ];

  // Column widths
  ws['!cols'] = [
    { wch: 4 }, { wch: 5 }, { wch: 10 }, { wch: 7 },
    { wch: 7 }, { wch: 7 }, { wch: 7 }, { wch: 7 },
    { wch: 7 }, { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, '勤怠報告書');

  // --- Sheet2: 交通費 ---
  if (transportEntries.length > 0) {
    var tsData = [];
    tsData.push([cell('交通費（電車・バス）', { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } })]);
    tsData.push([]);

    var tHeaders = ['日付', '手段', '区間', '種別', '金額'];
    tsData.push(tHeaders.map(function(h) { return headerCell(h); }));

    transportEntries.forEach(function(e) {
      var dt = e.expense_date ? new Date(e.expense_date) : null;
      var ds = dt ? (dt.getMonth() + 1) + '/' + dt.getDate() : '';
      tsData.push([
        cell(ds, { alignment: { horizontal: 'center' } }),
        cell(e.travel_method || '', { alignment: { horizontal: 'center' } }),
        cell((e.travel_from || '') + '→' + (e.travel_to || ''), { alignment: { horizontal: 'left' } }),
        cell(e.trip_type || '', { alignment: { horizontal: 'center' } }),
        cell('¥' + e.amount.toLocaleString(), { font: { bold: true }, alignment: { horizontal: 'right' } }),
      ]);
    });

    // Total row
    tsData.push([
      cell(''), cell(''), cell(''),
      cell('交通費合計', { font: { bold: true, sz: 11 }, alignment: { horizontal: 'right' } }),
      cell('¥' + transportTotal.toLocaleString(), { font: { bold: true, sz: 12 }, alignment: { horizontal: 'right' } }),
    ]);

    var ts = XLSX.utils.aoa_to_sheet(tsData);
    ts['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
    ts['!cols'] = [{ wch: 10 }, { wch: 8 }, { wch: 25 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ts, '交通費');
  }

  var fileName = '勤怠報告書_' + year + '年' + month + '月_' + userName + '.xlsx';
  XLSX.writeFile(wb, fileName);
}
