// ─── 曜日 ─────────────────────────────────────────────────────
export const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];

// ─── 時間選択肢 (10分刻み) ────────────────────────────────────
export const TIME_OPTIONS = (() => {
  const opts = [''];
  for (let h = 0; h < 24; h++)
    for (let m = 0; m < 60; m += 10)
      opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  return opts;
})();

export const DEDUCTION_OPTIONS = (() => {
  const opts = [''];
  for (let h = 0; h <= 3; h++)
    for (let m = 0; m < 60; m += 10)
      opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  return opts;
})();

// ─── 日本の祝日 (2025-2026) ──────────────────────────────────
export const HOLIDAYS = {
  '2025-01-01': '元日', '2025-01-13': '成人の日', '2025-02-11': '建国記念の日',
  '2025-02-23': '天皇誕生日', '2025-02-24': '振替休日', '2025-03-20': '春分の日',
  '2025-04-29': '昭和の日', '2025-05-03': '憲法記念日', '2025-05-04': 'みどりの日',
  '2025-05-05': 'こどもの日', '2025-05-06': '振替休日', '2025-07-21': '海の日',
  '2025-08-11': '山の日', '2025-09-15': '敬老の日', '2025-09-23': '秋分の日',
  '2025-10-13': 'スポーツの日', '2025-11-03': '文化の日', '2025-11-23': '勤労感謝の日',
  '2025-11-24': '振替休日',
  '2026-01-01': '元日', '2026-01-12': '成人の日', '2026-02-11': '建国記念の日',
  '2026-02-23': '天皇誕生日', '2026-03-20': '春分の日', '2026-04-29': '昭和の日',
  '2026-05-03': '憲法記念日', '2026-05-04': 'みどりの日', '2026-05-05': 'こどもの日',
  '2026-05-06': '振替休日', '2026-07-20': '海の日', '2026-08-11': '山の日',
  '2026-09-21': '敬老の日', '2026-09-22': '国民の休日', '2026-09-23': '秋分の日',
  '2026-10-12': 'スポーツの日', '2026-11-03': '文化の日', '2026-11-23': '勤労感謝の日',
};

// ─── ヘルパー関数 ──────────────────────────────────────────────
export function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

export function dayOfWeek(y, m, d) {
  return new Date(y, m - 1, d).getDay();
}

export function dateKey(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function getHoliday(y, m, d) {
  return HOLIDAYS[dateKey(y, m, d)] || '';
}

export function isWeekend(y, m, d) {
  const w = dayOfWeek(y, m, d);
  return w === 0 || w === 6;
}

export function calcWorkHours(start, end, deduction) {
  if (!start || !end) return '';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const [dh, dm] = (deduction || '00:00').split(':').map(Number);
  let total = (eh * 60 + em) - (sh * 60 + sm) - (dh * 60 + dm);
  if (total < 0) total = 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function totalHours(rows) {
  let t = 0;
  rows.forEach(r => {
    const wh = r.work_hours || r.wh;
    if (wh) {
      const [h, m] = wh.split(':').map(Number);
      t += h * 60 + m;
    }
  });
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function totalTransport(rows) {
  return rows.reduce((s, r) => s + (Number(r.transport) || 0), 0);
}

export function workDayCount(rows) {
  return rows.filter(r => (r.work_hours || r.wh)).length;
}

// ─── 月別行データ生成 ─────────────────────────────────────────
export function generateMonthRows(year, month, defaults = {}) {
  const days = daysInMonth(year, month);
  const rows = [];
  const st = defaults.start_time || '09:00';
  const et = defaults.end_time || '18:00';
  const dd = defaults.deduction || '01:00';
  const ct = defaults.work_content || '通常勤務';
  const tr = defaults.transport || 0;

  for (let d = 1; d <= days; d++) {
    const w = dayOfWeek(year, month, d);
    const hol = getHoliday(year, month, d);
    const off = isWeekend(year, month, d) || !!hol;
    rows.push({
      day: d,
      dow: DAYS_JP[w],
      holiday: hol,
      start_time: off ? '' : st,
      end_time: off ? '' : et,
      deduction: off ? '' : dd,
      work_hours: off ? '' : calcWorkHours(st, et, dd),
      work_content: off ? '' : ct,
      transport: off ? 0 : Number(tr),
    });
  }
  return rows;
}
