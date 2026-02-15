import { totalHours, totalTransport, workDayCount } from './utils';

export function openPrintPDF(rows, year, month, userName, status) {
  const th = totalHours(rows);
  const tt = totalTransport(rows);
  const wd = workDayCount(rows);

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
        <th style="width:50px">開始</th>
        <th style="width:50px">終了</th>
        <th style="width:50px">控除</th>
        <th style="width:50px">稼働</th>
        <th>稼動内容</th>
        <th style="width:70px">交通費</th>
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
          <td>${r.start_time || ''}</td>
          <td>${r.end_time || ''}</td>
          <td>${r.deduction || ''}</td>
          <td style="font-weight:600">${r.work_hours || ''}</td>
          <td style="text-align:left">${r.work_content || ''}</td>
          <td>${r.transport ? '¥' + Number(r.transport).toLocaleString() : ''}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  <div class="footer-row">
    <span>稼働日数: ${wd}日</span>
    <span>合計稼働時間: ${th}</span>
    <span>交通費合計: ¥${tt.toLocaleString()}</span>
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
