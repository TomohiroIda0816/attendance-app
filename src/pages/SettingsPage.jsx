import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { TIME_OPTIONS, DEDUCTION_OPTIONS } from '../lib/utils';

export default function SettingsPage() {
  var auth = useAuth();
  var _s = useState({ start_time: '09:00', end_time: '18:00', deduction: '01:00', work_content: '通常勤務', transport: 0 });
  var settings = _s[0], setSettings = _s[1];
  var _ld = useState(true), loading = _ld[0], setLoading = _ld[1];
  var _sv = useState(false), saving = _sv[0], setSaving = _sv[1];
  var _t = useState(''), toast = _t[0], setToast = _t[1];

  useEffect(function() {
    if (!auth.user) return;
    supabase.from('default_settings').select('*').eq('user_id', auth.user.id).single()
      .then(function(res) {
        if (res.data) {
          setSettings({
            start_time: res.data.start_time,
            end_time: res.data.end_time,
            deduction: res.data.deduction,
            work_content: res.data.work_content,
            transport: res.data.transport,
          });
        }
      })
      .catch(function() {})
      .finally(function() { setLoading(false); });
  }, [auth.user]);

  function handleSave() {
    setSaving(true);
    supabase.from('default_settings').update(settings).eq('user_id', auth.user.id)
      .then(function() {
        setToast('設定を保存しました');
        setTimeout(function() { setToast(''); }, 2500);
      })
      .catch(function() {
        setToast('保存に失敗しました');
        setTimeout(function() { setToast(''); }, 2500);
      })
      .finally(function() { setSaving(false); });
  }

  if (loading) return (<div className="page-loading"><div className="spinner"></div><span>読み込み中...</span></div>);

  return (
    <div className="settings-page">
      {toast && <div className="toast">{toast}</div>}
      <div className="card">
        <h2 className="card-title">デフォルト勤務設定</h2>
        <p className="card-desc">土日祝日以外の平日に自動入力される値を設定します。変更後「再生成」で現在の月に反映できます。</p>
        <div className="settings-grid">
          <div className="form-group">
            <label className="form-label">開始時間</label>
            <select className="form-select" value={settings.start_time} onChange={function(e) { setSettings(Object.assign({}, settings, { start_time: e.target.value })); }}>
              {TIME_OPTIONS.map(function(t) { return <option key={t} value={t}>{t || '---'}</option>; })}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">終了時間</label>
            <select className="form-select" value={settings.end_time} onChange={function(e) { setSettings(Object.assign({}, settings, { end_time: e.target.value })); }}>
              {TIME_OPTIONS.map(function(t) { return <option key={t} value={t}>{t || '---'}</option>; })}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">控除時間</label>
            <select className="form-select" value={settings.deduction} onChange={function(e) { setSettings(Object.assign({}, settings, { deduction: e.target.value })); }}>
              {DEDUCTION_OPTIONS.map(function(t) { return <option key={t} value={t}>{t || '---'}</option>; })}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">稼動内容</label>
            <input className="form-input" value={settings.work_content} onChange={function(e) { setSettings(Object.assign({}, settings, { work_content: e.target.value })); }} />
          </div>
          <div className="form-group">
            <label className="form-label">通勤交通費（円/日）</label>
            <input className="form-input" type="number" value={settings.transport} onChange={function(e) { setSettings(Object.assign({}, settings, { transport: Number(e.target.value) || 0 })); }} placeholder="0" />
          </div>
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '設定を保存'}</button>
      </div>
    </div>
  );
}
