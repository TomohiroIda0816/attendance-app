import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error && data) setProfile(data);
      return data;
    } catch (e) {
      return null;
    }
  };

  useEffect(function() {
    var timer = setTimeout(function() { setLoading(false); }, 3000);

    supabase.auth.getSession().then(function(result) {
      var session = result.data.session;
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).then(function() {
          clearTimeout(timer);
          setLoading(false);
        });
      } else {
        clearTimeout(timer);
        setLoading(false);
      }
    }).catch(function() {
      clearTimeout(timer);
      setLoading(false);
    });

    var sub = supabase.auth.onAuthStateChange(
      async function(_event, session) {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return function() { sub.data.subscription.unsubscribe(); };
  }, []);

  const signUp = async (email, password, fullName) => {
    var redirectUrl = window.location.origin + window.location.pathname;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: redirectUrl,
      },
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
  };

  var value = {
    user: user,
    profile: profile,
    loading: loading,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    isAdmin: profile?.role === 'admin',
    fetchProfile: fetchProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  var context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
