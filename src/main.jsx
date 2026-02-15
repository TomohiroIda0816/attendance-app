import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './components/AuthProvider';
import App from './App';
import './index.css';

// 壊れたセッションを自動クリーンアップ
try {
  var keys = Object.keys(localStorage);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].includes('supabase') && keys[i].includes('auth')) {
      try {
        var val = JSON.parse(localStorage.getItem(keys[i]));
        if (!val || !val.access_token) {
          localStorage.removeItem(keys[i]);
        }
      } catch(e) {
        localStorage.removeItem(keys[i]);
      }
    }
  }
} catch(e) {}

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(React.StrictMode, null,
    React.createElement(AuthProvider, null,
      React.createElement(App, null)
    )
  )
);
