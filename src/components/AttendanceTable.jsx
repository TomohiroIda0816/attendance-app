import { TIME_OPTIONS, DEDUCTION_OPTIONS, calcWorkHours, totalHours, totalTransport, workDayCount } from '../lib/utils';

var WORK_TYPES = ['通常', '有給', '半休(午前)', '半休(午後)', '欠勤'];

function getWarnings(r) {
  var warns = [];
  if (!r.start_time || !r.end_time || !r.work_hours) return warns;
  if (r.work_type === '有給' || r.work_type === '欠勤') return warns;
  // 稼働時間を分に変換
  var whParts = r.work_hours.split(':');
  var workMin = parseInt(whParts[0]) * 60 + parseInt(whParts[1] || 0);
  // 控除時間を分に変換
  var dedMin = 0;
  if (r.deduction) { var dp = r.deduction.split(':'); dedMin = parseInt(dp[0]) * 60 + parseInt(dp[1] || 0); }
  // 総勤務時間（控除前）
  var sp = r.start_time.split(':'), ep = r.end_time.split(':');
  var grossMin = (parseInt(ep[0]) * 60 + parseInt(ep[1])) - (parseInt(sp[0]) * 60 + parseInt(sp[1]));
  // 6時間超で休憩0分
  if (grossMin > 360 && dedMin === 0) warns.push('⚠️ 6h超勤務で休憩なし');
  // 8時間超で残業
  if (workMin > 480) warns.push('🕐 残業 ' + Math.floor((workMin - 480) / 60) + ':' + String((workMin - 480) % 60).padStart(2, '0'));
  return warns;
}

function countLeave(rows) {
  var paid = 0, halfAm = 0, halfPm = 0, absent = 0;
  rows.forEach(function(r) {
    if (r.work_type === '有給') paid++;
    else if (r.work_type === '半休(午前)') halfAm++;
    else if (r.work_type === '半休(午後)') halfPm++;
    else if (r.work_type === '欠勤') absent++;
  });
  return { paid: paid, halfAm: halfAm, halfPm: halfPm, absent: absent };
}

export default function AttendanceTable({ rows, onCellChange, readOnly = false }) {
  const handleChange = (index, field, value) => {
    if (readOnly || !onCellChange) return;
    const updated = { ...rows[index], [field]: value };
    if (['start_time', 'end_time', 'deduction'].includes(field)) {
      updated.work_hours = calcWorkHours(updated.start_time, updated.end_time, updated.deduction);
    }
    if (field === 'transport') {
      updated.transport = Number(value) || 0;
    }
    // 有給・欠勤の場合は時間をクリア
    if (field === 'work_type') {
      if (value === '有給' || value === '欠勤') {
        updated.start_time = '';
        updated.end_time = '';
        updated.deduction = '';
        updated.work_hours = '';
        updated.work_content = value;
      } else if (value === '通常' && (!updated.start_time)) {
        // 通常に戻した場合はデフォルト値は入れない（ユーザーに任せる）
      }
    }
    onCellChange(index, updated);
  };

  var leave = countLeave(rows);

  return (
    <div className="table-wrap">
      <table className="att-table">
        <thead>
          <tr>
            <th style={{ width: 38 }}>日</th>
            <th style={{ width: 34 }}>曜</th>
            <th style={{ width: 66 }}>祝日</th>
            <th style={{ width: 78 }}>勤務区分</th>
            <th style={{ width: 82 }}>開始時間</th>
            <th style={{ width: 82 }}>終了時間</th>
            <th style={{ width: 82 }}>控除時間</th>
            <th style={{ width: 64 }}>稼働時間</th>
            <th>稼動内容</th>
            <th style={{ width: 96 }}>交通費(円)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isHol = !!r.holiday;
            const isWE = r.dow === '土' || r.dow === '日';
            const trClass = isHol ? 'row-holiday' : isWE ? 'row-weekend' : '';
            const dowClass = r.dow === '日' ? 'dow-sun' : r.dow === '土' ? 'dow-sat' : '';
            const isLeave = r.work_type === '有給' || r.work_type === '欠勤';
            const isHalf = r.work_type === '半休(午前)' || r.work_type === '半休(午後)';
            const warns = getWarnings(r);
            const workTypeClass = r.work_type === '有給' ? 'wt-paid' : r.work_type === '欠勤' ? 'wt-absent' : isHalf ? 'wt-half' : '';

            return (
              <tr key={i} className={trClass}>
                <td className="cell-center">{r.day}</td>
                <td className={`cell-center cell-dow ${dowClass}`}>{r.dow}</td>
                <td className="cell-holiday">{r.holiday}</td>

                {readOnly ? (
                  <td className={`cell-center ${workTypeClass}`}>{r.work_type || '通常'}</td>
                ) : (
                  <td className="cell-input">
                    <select
                      className={`cell-select ${workTypeClass}`}
                      value={r.work_type || '通常'}
                      onChange={e => handleChange(i, 'work_type', e.target.value)}
                    >
                      {WORK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                )}

                {readOnly ? (
                  <>
                    <td className="cell-center">{r.start_time}</td>
                    <td className="cell-center">{r.end_time}</td>
                    <td className="cell-center">{r.deduction}</td>
                  </>
                ) : (
                  <>
                    <td className="cell-input">
                      <select className="cell-select" value={r.start_time} disabled={isLeave}
                        onChange={e => handleChange(i, 'start_time', e.target.value)}>
                        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t || '---'}</option>)}
                      </select>
                    </td>
                    <td className="cell-input">
                      <select className="cell-select" value={r.end_time} disabled={isLeave}
                        onChange={e => handleChange(i, 'end_time', e.target.value)}>
                        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t || '---'}</option>)}
                      </select>
                    </td>
                    <td className="cell-input">
                      <select className="cell-select" value={r.deduction} disabled={isLeave}
                        onChange={e => handleChange(i, 'deduction', e.target.value)}>
                        {DEDUCTION_OPTIONS.map(t => <option key={t} value={t}>{t || '---'}</option>)}
                      </select>
                    </td>
                  </>
                )}

                <td className="cell-center cell-hours">
                  {r.work_hours}
                  {warns.map(function(w, wi) { return <div key={wi} className="cell-warning">{w}</div>; })}
                </td>

                {readOnly ? (
                  <td className="cell-content-ro">{r.work_content}</td>
                ) : (
                  <td className="cell-input">
                    <input className="cell-text" value={r.work_content} disabled={isLeave}
                      onChange={e => handleChange(i, 'work_content', e.target.value)} />
                  </td>
                )}

                {readOnly ? (
                  <td className="cell-center">
                    {r.transport ? `¥${Number(r.transport).toLocaleString()}` : ''}
                  </td>
                ) : (
                  <td className="cell-input">
                    <input className="cell-number" type="number" value={r.transport || ''} disabled={isLeave}
                      onChange={e => handleChange(i, 'transport', e.target.value)} placeholder="0" />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="total-row">
            <td colSpan={7} className="total-label">合計</td>
            <td className="total-value">{totalHours(rows)}</td>
            <td className="total-days">
              稼働{workDayCount(rows)}日
              {leave.paid > 0 && <span className="leave-badge leave-paid">有給{leave.paid}</span>}
              {(leave.halfAm + leave.halfPm) > 0 && <span className="leave-badge leave-half">半休{leave.halfAm + leave.halfPm}</span>}
            </td>
            <td className="total-value">¥{totalTransport(rows).toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
