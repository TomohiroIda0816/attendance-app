import { TIME_OPTIONS, DEDUCTION_OPTIONS, calcWorkHours, totalHours, workDayCount } from '../lib/utils';

var WORK_TYPES = ['通常', '有給', '半休(午前)', '半休(午後)', '欠勤'];

function getOvertime(r) {
  if (!r.work_hours) return '';
  if (r.work_type === '有給' || r.work_type === '欠勤') return '';
  var whParts = r.work_hours.split(':');
  var workMin = parseInt(whParts[0]) * 60 + parseInt(whParts[1] || 0);
  if (workMin <= 480) return '';
  var ot = workMin - 480;
  return Math.floor(ot / 60) + ':' + String(ot % 60).padStart(2, '0');
}

function getBreakWarning(r) {
  if (!r.start_time || !r.end_time) return '';
  if (r.work_type === '有給' || r.work_type === '欠勤') return '';
  var dedMin = 0;
  if (r.deduction) { var dp = r.deduction.split(':'); dedMin = parseInt(dp[0]) * 60 + parseInt(dp[1] || 0); }
  var sp = r.start_time.split(':'), ep = r.end_time.split(':');
  var grossMin = (parseInt(ep[0]) * 60 + parseInt(ep[1])) - (parseInt(sp[0]) * 60 + parseInt(sp[1]));
  if (grossMin > 360 && dedMin === 0) return '⚠️ 休憩なし';
  return '';
}

function totalOvertime(rows) {
  var t = 0;
  rows.forEach(function(r) {
    var ot = getOvertime(r);
    if (ot) { var p = ot.split(':'); t += parseInt(p[0]) * 60 + parseInt(p[1] || 0); }
  });
  if (t === 0) return '';
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
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
    if (field === 'work_type') {
      if (value === '有給' || value === '欠勤') {
        updated.start_time = '';
        updated.end_time = '';
        updated.deduction = '';
        updated.work_hours = '';
        updated.work_content = value;
      }
    }
    onCellChange(index, updated);
  };

  var leave = countLeave(rows);
  var otTotal = totalOvertime(rows);

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
            <th style={{ width: 58 }}>残業</th>
            <th>稼動内容</th>
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
            const workTypeClass = r.work_type === '有給' ? 'wt-paid' : r.work_type === '欠勤' ? 'wt-absent' : isHalf ? 'wt-half' : '';
            const ot = getOvertime(r);
            const brkWarn = getBreakWarning(r);

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
                  {brkWarn && <div className="cell-warning">{brkWarn}</div>}
                </td>

                <td className="cell-center cell-overtime">{ot}</td>

                {readOnly ? (
                  <td className="cell-content-ro">{r.work_content}</td>
                ) : (
                  <td className="cell-input">
                    <input className="cell-text" value={r.work_content} disabled={isLeave}
                      onChange={e => handleChange(i, 'work_content', e.target.value)} />
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
            <td className="total-value cell-overtime">{otTotal}</td>
            <td className="total-days">
              稼働{workDayCount(rows)}日
              {leave.paid > 0 && <span className="leave-badge leave-paid">有給{leave.paid}</span>}
              {(leave.halfAm + leave.halfPm) > 0 && <span className="leave-badge leave-half">半休{leave.halfAm + leave.halfPm}</span>}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
