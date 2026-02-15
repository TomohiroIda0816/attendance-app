import { TIME_OPTIONS, DEDUCTION_OPTIONS, calcWorkHours, totalHours, totalTransport, workDayCount } from '../lib/utils';

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
    onCellChange(index, updated);
  };

  return (
    <div className="table-wrap">
      <table className="att-table">
        <thead>
          <tr>
            <th style={{ width: 38 }}>日</th>
            <th style={{ width: 34 }}>曜</th>
            <th style={{ width: 66 }}>祝日</th>
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

            return (
              <tr key={i} className={trClass}>
                <td className="cell-center">{r.day}</td>
                <td className={`cell-center cell-dow ${dowClass}`}>{r.dow}</td>
                <td className="cell-holiday">{r.holiday}</td>

                {readOnly ? (
                  <>
                    <td className="cell-center">{r.start_time}</td>
                    <td className="cell-center">{r.end_time}</td>
                    <td className="cell-center">{r.deduction}</td>
                  </>
                ) : (
                  <>
                    <td className="cell-input">
                      <select
                        className="cell-select"
                        value={r.start_time}
                        onChange={e => handleChange(i, 'start_time', e.target.value)}
                      >
                        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t || '---'}</option>)}
                      </select>
                    </td>
                    <td className="cell-input">
                      <select
                        className="cell-select"
                        value={r.end_time}
                        onChange={e => handleChange(i, 'end_time', e.target.value)}
                      >
                        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t || '---'}</option>)}
                      </select>
                    </td>
                    <td className="cell-input">
                      <select
                        className="cell-select"
                        value={r.deduction}
                        onChange={e => handleChange(i, 'deduction', e.target.value)}
                      >
                        {DEDUCTION_OPTIONS.map(t => <option key={t} value={t}>{t || '---'}</option>)}
                      </select>
                    </td>
                  </>
                )}

                <td className="cell-center cell-hours">{r.work_hours}</td>

                {readOnly ? (
                  <td className="cell-content-ro">{r.work_content}</td>
                ) : (
                  <td className="cell-input">
                    <input
                      className="cell-text"
                      value={r.work_content}
                      onChange={e => handleChange(i, 'work_content', e.target.value)}
                    />
                  </td>
                )}

                {readOnly ? (
                  <td className="cell-center">
                    {r.transport ? `¥${Number(r.transport).toLocaleString()}` : ''}
                  </td>
                ) : (
                  <td className="cell-input">
                    <input
                      className="cell-number"
                      type="number"
                      value={r.transport || ''}
                      onChange={e => handleChange(i, 'transport', e.target.value)}
                      placeholder="0"
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="total-row">
            <td colSpan={6} className="total-label">合計</td>
            <td className="total-value">{totalHours(rows)}</td>
            <td className="total-days">稼働日数: {workDayCount(rows)}日</td>
            <td className="total-value">¥{totalTransport(rows).toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
