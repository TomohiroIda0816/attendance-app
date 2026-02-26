import XLSX from 'xlsx-js-style';

var HEADER_FILL = { fgColor: { rgb: '1E293B' } };
var HEADER_FONT = { color: { rgb: 'F1F5F9' }, bold: true, sz: 10 };
var SUMMARY_HEADER_FILL = { fgColor: { rgb: '374151' } };
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

function summaryHeaderCell(v) {
  return cell(v, { fill: SUMMARY_HEADER_FILL, font: HEADER_FONT, alignment: { horizontal: 'center', vertical: 'center' } });
}

function fmtDate(d) {
  if (!d) return '';
  var dt = new Date(d);
  return (dt.getMonth() + 1) + '/' + dt.getDate();
}

function catDetail(e) {
  if (e.category === '旅費交通費') {
    var parts = [];
    if (e.travel_from || e.travel_to) parts.push((e.travel_from || '') + ' → ' + (e.travel_to || ''));
    if (e.travel_method) parts.push(e.travel_method);
    if (e.trip_type) parts.push(e.trip_type);
    return parts.join(' / ');
  }
  if (e.category === '書籍代' && e.book_title) return '書籍: ' + e.book_title;
  return e.description;
}

export function exportExpenseExcel(entries, year, month, userName) {
  var totalAmount = 0;
  var catTotals = {};
  entries.forEach(function(e) {
    totalAmount += e.amount;
    catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
  });

  var wb = XLSX.utils.book_new();

  // --- Sheet1: 経費精算書 ---
  var wsData = [];

  wsData.push([cell('経 費 精 算 書', { font: { bold: true, sz: 16 }, alignment: { horizontal: 'center' } })]);
  wsData.push([
    cell('氏名: ' + userName, { font: { bold: true, sz: 11 } }),
    cell(''),
    cell(year + '年 ' + month + '月', { alignment: { horizontal: 'center' }, font: { sz: 11 } }),
    cell(''),
    cell(''),
  ]);
  wsData.push([]);

  if (entries.length === 0) {
    wsData.push([cell('この月の経費記録はありません。', { font: { sz: 11 }, alignment: { horizontal: 'center' } })]);
  } else {
    var headers = ['No.', '日付', '費目', '内容', '金額'];
    wsData.push(headers.map(function(h) { return headerCell(h); }));

    entries.forEach(function(e, i) {
      wsData.push([
        cell(i + 1, { alignment: { horizontal: 'center' } }),
        cell(fmtDate(e.expense_date), { alignment: { horizontal: 'center' } }),
        cell(e.category, { alignment: { horizontal: 'center' } }),
        cell(catDetail(e), { alignment: { horizontal: 'left' } }),
        cell('¥' + e.amount.toLocaleString(), { font: { bold: true }, alignment: { horizontal: 'right' } }),
      ]);
    });

    // Total row
    wsData.push([
      cell(''), cell(''), cell(''),
      cell('経費合計', { font: { bold: true, sz: 12 }, alignment: { horizontal: 'right' } }),
      cell('¥' + totalAmount.toLocaleString(), { font: { bold: true, sz: 12 }, alignment: { horizontal: 'right' } }),
    ]);
  }

  var ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
  ws['!cols'] = [{ wch: 6 }, { wch: 10 }, { wch: 12 }, { wch: 35 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, '経費精算書');

  // --- Sheet2: 費目別サマリー ---
  if (entries.length > 0) {
    var ssData = [];
    ssData.push([cell('費目別サマリー', { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } })]);
    ssData.push([]);
    ssData.push([summaryHeaderCell('費目'), summaryHeaderCell('合計金額')]);

    var cats = Object.keys(catTotals);
    cats.forEach(function(cat) {
      ssData.push([
        cell(cat, { alignment: { horizontal: 'center' } }),
        cell('¥' + catTotals[cat].toLocaleString(), { font: { bold: true }, alignment: { horizontal: 'right' } }),
      ]);
    });

    ssData.push([
      cell('経費合計', { font: { bold: true, sz: 12 }, alignment: { horizontal: 'center' } }),
      cell('¥' + totalAmount.toLocaleString(), { font: { bold: true, sz: 12 }, alignment: { horizontal: 'right' } }),
    ]);

    var ss = XLSX.utils.aoa_to_sheet(ssData);
    ss['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    ss['!cols'] = [{ wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ss, '費目別サマリー');
  }

  var fileName = '経費精算書_' + year + '年' + month + '月_' + userName + '.xlsx';
  XLSX.writeFile(wb, fileName);
}
