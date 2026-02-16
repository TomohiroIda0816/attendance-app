import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

var AuthContext = createContext({});

export function AuthProvider({ children }) {
  var _s = useState(null), user = _s[0], setUser = _s[1];
  var _p = useState(null), profile = _p[0], setProfile = _p[1];
  var _l = useState(true), loading = _l[0], setLoading = _l[1];

  function fetchProfile(userId) {
    return supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(function(res) {
        if (!res.error && res.data) setProfile(res.data);
        return res.data;
      })
      .catch(function() { return null; });
  }

  useEffect(function() {
    var done = false;
    var timer = setTimeout(function() {
      if (!done) { done = true; setLoading(false); }
    }, 3000);

    supabase.auth.getSession()
      .then(function(result) {
        var session = result.data.session;
        if (session && session.user) {
          setUser(session.user);
          return fetchProfile(session.user.id);
        } else {
          setUser(null);
        }
      })
      .catch(function() { setUser(null); })
      .finally(function() {
        if (!done) { done = true; clearTimeout(timer); setLoading(false); }
      });

    var listener = supabase.auth.onAuthStateChange(function(_event, session) {
      if (session && session.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      if (!done) { done = true; clearTimeout(timer); setLoading(false); }
    });

    return function() {
      clearTimeout(timer);
      listener.data.subscription.unsubscribe();
    };
  }, []);

  function signUp(email, password, fullName, accountType) {
    var redirectUrl = window.location.origin + window.location.pathname;
    return supabase.auth.signUp({
      email: email,
      password: password,
      options: { data: { full_name: fullName, account_type: accountType || '社員' }, emailRedirectTo: redirectUrl },
    }).then(function(res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  function signIn(email, password) {
    return supabase.auth.signInWithPassword({
      email: email, password: password,
    }).then(function(res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  function signOut() {
    return supabase.auth.signOut()
      .then(function() { setUser(null); setProfile(null); })
      .catch(function() { setUser(null); setProfile(null); });
  }

  var value = {
    user: user, profile: profile, loading: loading,
    signUp: signUp, signIn: signIn, signOut: signOut,
    isAdmin: profile ? profile.role === 'admin' : false,
    isIntern: profile ? profile.account_type === 'インターン' : false,
    fetchProfile: fetchProfile,
  };

  return (<AuthContext.Provider value={value}>{children}</AuthContext.Provider>);
}

export function useAuth() { return useContext(AuthContext); }
