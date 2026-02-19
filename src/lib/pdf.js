import { totalHours, workDayCount } from './utils';

function calcOvertimeForPdf(r) {
  if (!r.work_hours) return '';
  if (r.work_type === '有給' || r.work_type === '欠勤') return '';
  var p = r.work_hours.split(':');
  var m = parseInt(p[0]) * 60 + parseInt(p[1] || 0);
  if (m <= 480) return '';
  var ot = m - 480;
  return Math.floor(ot / 60) + ':' + String(ot % 60).padStart(2, '0');
}

function totalOvertimeForPdf(rows) {
  var t = 0;
  rows.forEach(function(r) {
    var ot = calcOvertimeForPdf(r);
    if (ot) { var p = ot.split(':'); t += parseInt(p[0]) * 60 + parseInt(p[1] || 0); }
  });
  if (t === 0) return '0:00';
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}

export function openPrintPDF(rows, year, month, userName, status) {
  const th = totalHours(rows);
  const wd = workDayCount(rows);
  const ot = totalOvertimeForPdf(rows);

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>勤怠報告書 ${year}年${month}月 - ${userName}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif;
    font-size: 10px; color: #1a1a2e; padding: 10mm;
  }
  h1 { font-size: 20px; text-align: center; margin-bottom: 8px; letter-spacing: 4px; font-weight: 800; }
  .meta {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 10px; font-size: 12px; padding: 0 4px;
  }
  .badge {
    display: inline-block; padding: 2px 12px; border-radius: 4px;
    font-size: 11px; font-weight: 600;
  }
  .badge-submitted { background: #dcfce7; color: #166534; }
  .badge-draft { background: #fef3c7; color: #92400e; }
  .badge-approved { background: #dbeafe; color: #1e40af; }
  .badge-rejected { background: #fee2e2; color: #991b1b; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 12px; }
  th, td { border: 1px solid #94a3b8; padding: 4px 6px; text-align: center; white-space: nowrap; }
  th { background: #1e293b; color: #f1f5f9; font-weight: 600; font-size: 9px; }
  tr.weekend { background: #eff6ff; }
  tr.holiday { background: #fff1f2; }
  .sun { color: #dc2626; }
  .sat { color: #2563eb; }
  .footer-row {
    display: flex; justify-content: space-between; font-size: 12px;
    padding: 8px 4px; border-top: 2px solid #1e293b;
  }
  .footer-row span { font-weight: 600; }
  .signature-area {
    display: flex; justify-content: flex-end; gap: 40px; margin-top: 24px; font-size: 11px;
  }
  .signature-box {
    width: 120px; text-align: center; border-bottom: 1px solid #1e293b; padding-bottom: 30px;
  }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>勤 怠 報 告 書</h1>
  <div class="meta">
    <span>氏名: <strong>${userName}</strong></span>
    <span>${year}年 ${month}月</span>
    <span class="badge badge-${status === '申請済' ? 'submitted' : status === '承認済' ? 'approved' : status === '差戻し' ? 'rejected' : 'draft'}">${status || '下書き'}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:30px">日</th>
        <th style="width:28px">曜日</th>
        <th style="width:60px">祝日</th>
        <th style="width:48px">区分</th>
        <th style="width:50px">開始</th>
        <th style="width:50px">終了</th>
        <th style="width:50px">控除</th>
        <th style="width:50px">稼働</th>
        <th style="width:50px">残業</th>
        <th>稼動内容</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => {
        const cls = r.holiday ? 'holiday' : (r.dow === '土' || r.dow === '日') ? 'weekend' : '';
        const dowCls = r.dow === '日' ? 'sun' : r.dow === '土' ? 'sat' : '';
        return `<tr class="${cls}">
          <td>${r.day}</td>
          <td class="${dowCls}">${r.dow}</td>
          <td style="font-size:8px;color:#dc2626">${r.holiday || ''}</td>
          <td style="font-size:8px;${r.work_type==='有給'?'color:#059669;font-weight:700':r.work_type==='欠勤'?'color:#dc2626;font-weight:700':r.work_type&&r.work_type.includes('半休')?'color:#2563eb;font-weight:700':''}">${r.work_type && r.work_type !== '通常' ? r.work_type : ''}</td>
          <td>${r.start_time || ''}</td>
          <td>${r.end_time || ''}</td>
          <td>${r.deduction || ''}</td>
          <td style="font-weight:600">${r.work_hours || ''}</td>
          <td style="color:#f59e0b;font-weight:600">${calcOvertimeForPdf(r)}</td>
          <td style="text-align:left">${r.work_content || ''}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  <div class="footer-row">
    <span>稼働日数: ${wd}日</span>
    <span>合計稼働時間: ${th}</span>
    <span>合計残業時間: ${ot}</span>
  </div>
  <div class="signature-area">
    <div>
      <div class="signature-box">承認者</div>
    </div>
    <div>
      <div class="signature-box">申請者</div>
    </div>
  </div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}
