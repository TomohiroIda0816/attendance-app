import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { TIME_OPTIONS, DEDUCTION_OPTIONS } from '../lib/utils';

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    start_time: '09:00',
    end_time: '18:00',
    deduction: '01:00',
    work_content: '通常勤務',
    transport: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('default_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (data) {
        setSettings({
          start_time: data.start_time,
          end_time: data.end_time,
          deduction: data.deduction,
          work_content: data.work_content,
          transport: data.transport,
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('default_settings')
      .update(settings)
      .eq('user_id', user.id);
    if (!error) {
      setToast('設定を保存しました');
      setTimeout(() => setToast(''), 2500);
    }
    setSaving(false);
  };

  if (loading) return <div className="page-loading"><div className="spinner" /><span>読み込み中...</span></div>;

  return (
    <div className="settings-page">
      {toast && <div className="toast">{toast}</div>}

      <div className="card">
        <h2 className="card-title">デフォルト勤務設定</h2>
        <p className="card-desc">
          土日祝日以外の平日に自動入力される値を設定します。<br />
          変更後、勤怠入力画面の「再生成」ボタンで現在の月に反映できます。
        </p>

        <div className="settings-grid">
          <div className="form-group">
            <label className="form-label">開始時間</label>
            <select
              className="form-select"
              value={settings.start_time}
              onChange={e => setSettings({ ...settings, start_time: e.target.value })}
            >
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t || '---'}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">終了時間</label>
            <select
              className="form-select"
              value={settings.end_time}
              onChange={e => setSettings({ ...settings, end_time: e.target.value })}
            >
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t || '---'}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">控除時間</label>
            <select
              className="form-select"
              value={settings.deduction}
              onChange={e => setSettings({ ...settings, deduction: e.target.value })}
            >
              {DEDUCTION_OPTIONS.map(t => <option key={t} value={t}>{t || '---'}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">稼動内容</label>
            <input
              className="form-input"
              value={settings.work_content}
              onChange={e => setSettings({ ...settings, work_content: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">通勤交通費（円/日）</label>
            <input
              className="form-input"
              type="number"
              value={settings.transport}
              onChange={e => setSettings({ ...settings, transport: Number(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>
        </div>

        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '設定を保存'}
        </button>
      </div>
    </div>
  );
}
