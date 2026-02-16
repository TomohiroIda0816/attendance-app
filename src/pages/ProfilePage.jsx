import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';

export default function ProfilePage() {
  var auth = useAuth();
  var _name = useState(auth.profile ? auth.profile.full_name : ''), name = _name[0], setName = _name[1];
  var _pw = useState(''), newPw = _pw[0], setNewPw = _pw[1];
  var _pw2 = useState(''), confirmPw = _pw2[0], setConfirmPw = _pw2[1];
  var _saving = useState(false), saving = _saving[0], setSaving = _saving[1];
  var _t = useState(''), toast = _t[0], setToast = _t[1];

  function flash(msg) { setToast(msg); setTimeout(function(){setToast('');}, 2500); }

  function handleSaveName() {
    if (!name.trim()) { flash('氏名を入力してください'); return; }
    setSaving(true);
    supabase.from('profiles').update({ full_name: name.trim() }).eq('id', auth.user.id)
      .then(function() {
        flash('氏名を更新しました');
        auth.fetchProfile(auth.user.id);
      })
      .catch(function() { flash('更新に失敗しました'); })
      .finally(function() { setSaving(false); });
  }

  function handleChangePassword() {
    if (!newPw) { flash('新しいパスワードを入力してください'); return; }
    if (newPw.length < 6) { flash('パスワードは6文字以上で入力してください'); return; }
    if (newPw !== confirmPw) { flash('パスワードが一致しません'); return; }
    setSaving(true);
    supabase.auth.updateUser({ password: newPw })
      .then(function(res) {
        if (res.error) throw res.error;
        flash('パスワードを変更しました');
        setNewPw(''); setConfirmPw('');
      })
      .catch(function(err) { flash('変更に失敗しました: ' + (err.message||'')); })
      .finally(function() { setSaving(false); });
  }

  return (
    <div className="settings-page">
      {toast && <div className="toast">{toast}</div>}

      <div className="card">
        <h2 className="card-title">アカウント情報</h2>
        <p className="card-desc">メールアドレス: <strong>{auth.user ? auth.user.email : ''}</strong></p>
        {auth.profile && auth.profile.role === 'admin' && <p className="card-desc"><span className="admin-role-badge">管理者</span></p>}

        <div style={{marginTop:'20px'}}>
          <h3 className="profile-section-title">氏名の変更</h3>
          <div style={{display:'flex',gap:'8px',alignItems:'flex-end',maxWidth:'400px'}}>
            <div className="form-group" style={{flex:1,marginBottom:0}}>
              <label className="form-label">氏名</label>
              <input className="form-input" value={name} onChange={function(e){setName(e.target.value);}} placeholder="氏名" />
            </div>
            <button className="btn-primary" style={{width:'auto',padding:'10px 20px',height:'42px'}} onClick={handleSaveName} disabled={saving}>保存</button>
          </div>
        </div>

        <div style={{marginTop:'28px',paddingTop:'20px',borderTop:'1px solid var(--border-light)'}}>
          <h3 className="profile-section-title">パスワードの変更</h3>
          <div style={{maxWidth:'400px'}}>
            <div className="form-group">
              <label className="form-label">新しいパスワード</label>
              <input className="form-input" type="password" value={newPw} onChange={function(e){setNewPw(e.target.value);}} placeholder="6文字以上" minLength={6} />
            </div>
            <div className="form-group">
              <label className="form-label">パスワード確認</label>
              <input className="form-input" type="password" value={confirmPw} onChange={function(e){setConfirmPw(e.target.value);}} placeholder="もう一度入力" />
            </div>
            <button className="btn-primary" style={{width:'auto',padding:'10px 20px'}} onClick={handleChangePassword} disabled={saving}>パスワードを変更</button>
          </div>
        </div>
      </div>
    </div>
  );
}
