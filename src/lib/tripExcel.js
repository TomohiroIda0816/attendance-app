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

export function exportTripExcel(entries, year, month, userName, status) {
  var totalLunch = 0, totalDinner = 0, totalAll = 0;
  entries.forEach(function(e) {
    totalLunch += e.lunch_allowance;
    totalDinner += e.dinner_allowance;
    totalAll += e.total_allowance;
  });

  var wb = XLSX.utils.book_new();

  // --- Sheet1: 出張報告書 ---
  var wsData = [];

  wsData.push([cell('出 張 報 告 書', { font: { bold: true, sz: 16 }, alignment: { horizontal: 'center' } })]);
  wsData.push([
    cell('氏名: ' + userName, { font: { bold: true, sz: 11 } }),
    cell(''), cell(''), cell(''),
    cell(year + '年 ' + month + '月', { alignment: { horizontal: 'center' }, font: { sz: 11 } }),
    cell(''), cell(''),
    cell(''),
    cell(status || '下書き', { font: { bold: true, sz: 11 }, alignment: { horizontal: 'right' } }),
  ]);
  wsData.push([]);

  if (entries.length === 0) {
    wsData.push([cell('この月の出張記録はありません。', { font: { sz: 11 }, alignment: { horizontal: 'center' } })]);
  } else {
    var headers = ['No.', '出張先', '出発日', '帰着日', '到着', '泊数', '昼食代', '夕食代', '手当合計'];
    wsData.push(headers.map(function(h) { return headerCell(h); }));

    entries.forEach(function(e, i) {
      wsData.push([
        cell(i + 1, { alignment: { horizontal: 'center' } }),
        cell(e.destination, { alignment: { horizontal: 'left' } }),
        cell(fmtDate(e.departure_date), { alignment: { horizontal: 'center' } }),
        cell(fmtDate(e.return_date), { alignment: { horizontal: 'center' } }),
        cell((e.arrival_time || '午前') + '着', { alignment: { horizontal: 'center' } }),
        cell(e.nights + '泊', { alignment: { horizontal: 'center' } }),
        cell('¥' + e.lunch_allowance.toLocaleString(), { font: { bold: true }, alignment: { horizontal: 'right' } }),
        cell('¥' + e.dinner_allowance.toLocaleString(), { font: { bold: true }, alignment: { horizontal: 'right' } }),
        cell('¥' + e.total_allowance.toLocaleString(), { font: { bold: true }, alignment: { horizontal: 'right' } }),
      ]);
    });

    // Total row
    wsData.push([
      cell(''), cell(''), cell(''), cell(''), cell(''), cell(''), cell(''),
      cell('手当合計', { font: { bold: true, sz: 12 }, alignment: { horizontal: 'right' } }),
      cell('¥' + totalAll.toLocaleString(), { font: { bold: true, sz: 12 }, alignment: { horizontal: 'right' } }),
    ]);
  }

  var ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];
  ws['!cols'] = [
    { wch: 5 }, { wch: 18 }, { wch: 10 }, { wch: 10 },
    { wch: 7 }, { wch: 6 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, '出張報告書');

  // --- Sheet2: 手当サマリー ---
  if (entries.length > 0) {
    var ssData = [];
    ssData.push([cell('手当サマリー', { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } })]);
    ssData.push([]);
    ssData.push([summaryHeaderCell('項目'), summaryHeaderCell('金額')]);

    ssData.push([
      cell('昼食代合計', { alignment: { horizontal: 'center' } }),
      cell('¥' + totalLunch.toLocaleString(), { font: { bold: true }, alignment: { horizontal: 'right' } }),
    ]);
    ssData.push([
      cell('夕食代合計', { alignment: { horizontal: 'center' } }),
      cell('¥' + totalDinner.toLocaleString(), { font: { bold: true }, alignment: { horizontal: 'right' } }),
    ]);
    ssData.push([
      cell('出張手当合計', { font: { bold: true, sz: 12 }, alignment: { horizontal: 'center' } }),
      cell('¥' + totalAll.toLocaleString(), { font: { bold: true, sz: 12 }, alignment: { horizontal: 'right' } }),
    ]);

    var ss = XLSX.utils.aoa_to_sheet(ssData);
    ss['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    ss['!cols'] = [{ wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ss, '手当サマリー');
  }

  var fileName = '出張報告書_' + year + '年' + month + '月_' + userName + '.xlsx';
  XLSX.writeFile(wb, fileName);
}
