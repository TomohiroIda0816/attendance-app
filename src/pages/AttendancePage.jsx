import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { generateMonthRows, calcWorkHours } from '../lib/utils';
import { openPrintPDF } from '../lib/pdf';
import AttendanceTable from '../components/AttendanceTable';

export default function AttendancePage() {
  const { user, profile } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [rows, setRows] = useState([]);
  const [reportId, setReportId] = useState(null);
  const [status, setStatus] = useState('下書き');
  const [defaults, setDefaults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const saveTimer = useRef(null);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  // ── デフォルト設定取得 ──────────────────────────────────────
  const loadDefaults = useCallback(async () => {
    if (!user) return null;
    const { data } = await supabase
      .from('default_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (data) setDefaults(data);
    return data;
  }, [user]);

  // ── 月データ取得 ────────────────────────────────────────────
  const loadMonthData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // まずデフォルト取得
    let defs = defaults;
    if (!defs) defs = await loadDefaults();

    // レポート取得
    const { data: report } = await supabase
      .from('monthly_reports')
      .select('*')
      .eq('user_id', user.id)
      .eq('year', year)
      .eq('month', month)
      .single();

    if (report) {
      setReportId(report.id);
      setStatus(report.status);

      // 行データ取得
      const { data: rowData } = await supabase
        .from('attendance_rows')
        .select('*')
        .eq('report_id', report.id)
        .order('day');

      if (rowData && rowData.length > 0) {
        setRows(rowData);
      } else {
        // レポートはあるが行データがない場合
        const generated = generateMonthRows(year, month, defs || {});
        setRows(generated);
        await insertRows(report.id, generated);
      }
    } else {
      // 新規月: レポート&行データ作成
      const generated = generateMonthRows(year, month, defs || {});
      setRows(generated);

      const { data: newReport } = await supabase
        .from('monthly_reports')
        .insert({ user_id: user.id, year, month, status: '下書き' })
        .select()
        .single();

      if (newReport) {
        setReportId(newReport.id);
        setStatus('下書き');
        await insertRows(newReport.id, generated);
      }
    }

    setLoading(false);
  }, [user, year, month, defaults, loadDefaults]);

  // ── 行データ一括挿入 ────────────────────────────────────────
  const insertRows = async (repId, rowsData) => {
    const inserts = rowsData.map(r => ({
      report_id: repId,
      day: r.day,
      dow: r.dow,
      holiday: r.holiday || '',
      start_time: r.start_time || '',
      end_time: r.end_time || '',
      deduction: r.deduction || '',
      work_hours: r.work_hours || '',
      work_content: r.work_content || '',
      transport: Number(r.transport) || 0,
    }));
    await supabase.from('attendance_rows').insert(inserts);
  };

  useEffect(() => {
    loadMonthData();
  }, [loadMonthData]);

  // ── セル変更 (デバウンス保存) ────────────────────────────────
  const onCellChange = (index, updatedRow) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], ...updatedRow };
    setRows(newRows);

    // デバウンスでDBに保存
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const row = newRows[index];
      if (row.id) {
        await supabase
          .from('attendance_rows')
          .update({
            start_time: row.start_time,
            end_time: row.end_time,
            deduction: row.deduction,
            work_hours: row.work_hours,
            work_content: row.work_content,
            transport: Number(row.transport) || 0,
          })
          .eq('id', row.id);
      }
    }, 500);
  };

  // ── 申請 ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!reportId) return;
    setSaving(true);
    await supabase
      .from('monthly_reports')
      .update({ status: '申請済', submitted_at: new Date().toISOString() })
      .eq('id', reportId);
    setStatus('申請済');
    flash(`${year}年${month}月 申請しました`);
    setSaving(false);
  };

  // ── 申請取消 ─────────────────────────────────────────────────
  const handleUnsubmit = async () => {
    if (!reportId) return;
    setSaving(true);
    await supabase
      .from('monthly_reports')
      .update({ status: '下書き', submitted_at: null })
      .eq('id', reportId);
    setStatus('下書き');
    flash('申請を取り消しました');
    setSaving(false);
  };

  // ── 再生成 ────────────────────────────────────────────────────
  const handleRegenerate = async () => {
    if (!reportId) return;
    setSaving(true);

    // 既存行削除
    await supabase.from('attendance_rows').delete().eq('report_id', reportId);

    // 再生成
    const defs = defaults || {};
    const generated = generateMonthRows(year, month, defs);
    await insertRows(reportId, generated);

    // 再取得
    const { data: rowData } = await supabase
      .from('attendance_rows')
      .select('*')
      .eq('report_id', reportId)
      .order('day');

    if (rowData) setRows(rowData);
    setStatus('下書き');
    await supabase.from('monthly_reports').update({ status: '下書き' }).eq('id', reportId);

    flash('デフォルト設定で再生成しました');
    setSaving(false);
  };

  // ── 月移動 ────────────────────────────────────────────────────
  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  };

  // ── ステータスバッジ色 ──────────────────────────────────────
  const statusClass = {
    '下書き': 'badge-draft',
    '申請済': 'badge-submitted',
    '承認済': 'badge-approved',
    '差戻し': 'badge-rejected',
  }[status] || 'badge-draft';

  if (loading) {
    return <div className="page-loading"><div className="spinner" /><span>読み込み中...</span></div>;
  }

  return (
    <div className="attendance-page">
      {toast && <div className="toast">{toast}</div>}

      <div className="month-header">
        <div className="month-nav">
          <button className="btn-icon" onClick={prevMonth}>◀</button>
          <h2 className="month-title">{year}年{month}月</h2>
          <button className="btn-icon" onClick={nextMonth}>▶</button>
        </div>
        <div className="header-actions">
          <span className={`status-badge ${statusClass}`}>{status}</span>
          <button className="btn-outline" onClick={handleRegenerate} disabled={saving}>
            🔄 再生成
          </button>
          <button
            className="btn-outline"
            onClick={() => openPrintPDF(rows, year, month, profile?.full_name || '', status)}
          >
            📄 PDF
          </button>
          {status === '申請済' || status === '承認済' ? (
            <button className="btn-danger" onClick={handleUnsubmit} disabled={saving || status === '承認済'}>
              {status === '承認済' ? '承認済' : '申請取消'}
            </button>
          ) : (
            <button className="btn-submit" onClick={handleSubmit} disabled={saving}>
              ✓ 申請
            </button>
          )}
        </div>
      </div>

      <AttendanceTable
        rows={rows}
        onCellChange={onCellChange}
        readOnly={status === '承認済'}
      />
    </div>
  );
}
