'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase-client';
import { Loader2, ShieldCheck, ShoppingBag, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface AuthContextType {
  user: any;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState('Initializing private shop session...');
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Manual override states
  const [showManualForm, setShowManualForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [manualName, setManualName] = useState('Shop Owner');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const supabase = getSupabaseClient();

  useEffect(() => {
    if (!supabase) {
      Promise.resolve().then(() => {
        setLoading(false);
      });
      return;
    }

    async function checkAndAutoLogin() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUser(session.user);
          setLoading(false);
          return;
        }

        // 1. Try Silent auto-login of default shop owner user (Server-assisted to guarantee user exists)
        setStatusText('Configuring secure shop owner workspace...');
        const email = 'shop-owner@privateshop.com';
        const password = 'PrivateShopOwnerPassword123!';

        // Pre-create/verify default user on the server to bypass client-side signup limits entirely
        setStatusText('Preparing admin credentials on server...');
        try {
          const initRes = await fetch('/api/auth/default-admin', { method: 'POST' });
          const initData = await initRes.json();
          if (!initRes.ok) {
            console.warn('Default admin creation api status:', initRes.status, initData);
          }
        } catch (initErr) {
          console.error('Failed to trigger default admin verification on server:', initErr);
        }

        setStatusText('Authenticating private session...');
        // Try signing in
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInData?.user) {
          setUser(signInData.user);
          setLoading(false);
          return;
        }

        // 2. Fallback to Anonymous login if email login fails
        setStatusText('Configuring backup guest session...');
        try {
          const { data: anonData, error: anonError } = await (supabase.auth as any).signInAnonymously();
          if (anonData?.user) {
            setUser(anonData.user);
            setLoading(false);
            return;
          }
          if (anonError) {
            console.log('Anonymous login fallback failed:', anonError.message);
          }
        } catch (e) {
          console.log('Anonymous login fallback exception.');
        }

        if (signInError) {
          console.error('Sign in error:', signInError);
          if (signInError.message?.includes('rate limit') || signInError.status === 429) {
            setAuthError('Supabase email login rate limit exceeded. Please configure a custom admin account below.');
            setShowManualForm(true);
          } else {
            // Try to signUp as a final fallback
            setStatusText('Creating private shop credentials...');
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email,
              password,
              options: {
                data: {
                  full_name: 'Shop Owner',
                },
              },
            });

            if (signUpError) {
              console.error('Auto signup error:', signUpError);
              setAuthError(signUpError.message);
              setShowManualForm(true);
              return;
            }

            // Sign in again after registration
            const { data: retrySignInData } = await supabase.auth.signInWithPassword({
              email,
              password,
            });

            if (retrySignInData?.user) {
              setUser(retrySignInData.user);
            } else {
              setShowManualForm(true);
            }
          }
        }
      } catch (err: any) {
        console.error('Silent login failure:', err);
        setAuthError(err.message || 'Unexpected login error.');
        setShowManualForm(true);
      } finally {
        setLoading(false);
      }
    }

    checkAndAutoLogin();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (session) {
        setUser(session.user);
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    setFormError(null);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: manualEmail,
          password: manualPassword,
          options: {
            data: {
              full_name: manualName,
            },
          },
        });
        if (error) throw error;
        
        // Try sign-in
        const { data: signData, error: signErr } = await supabase.auth.signInWithPassword({
          email: manualEmail,
          password: manualPassword,
        });
        if (signErr) throw signErr;
        if (signData?.user) {
          setUser(signData.user);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: manualEmail,
          password: manualPassword,
        });
        if (error) throw error;
        if (data?.user) {
          setUser(data.user);
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'Authentication failed. Please try another email/password.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || (showManualForm && !user)) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 text-white font-sans antialiased p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-950/50">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-2xl font-bold tracking-tight text-white">
                SaaS ID Card Generator
              </h2>
              <p className="text-slate-400 text-sm font-light">
                Private Shop Workspace
              </p>
            </div>
          </div>

          {!showManualForm ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 text-slate-300 text-sm shadow-inner">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-400 shrink-0" />
                <span className="font-mono tracking-tight text-left">{statusText}</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 font-mono">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>Secure Admin Access Enforced</span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  {isSignUp ? 'Create Workspace Account' : 'Shop Owner Login'}
                </h3>
                <p className="text-xs text-slate-400 font-light leading-relaxed">
                  {authError ? 'Default shop credentials hit a Supabase rate limit. Please sign up or log in below to bypass it.' : 'Enter your credentials to access your private shop dashboard.'}
                </p>
              </div>

              {formError && (
                <div className="p-3 bg-red-950/50 border border-red-900 text-red-200 rounded-xl text-xs flex gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleManualSubmit} className="space-y-4">
                {isSignUp && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300 font-mono">Shop Owner Name</label>
                    <input
                      type="text"
                      required
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="e.g. Shop Admin"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-sans transition-colors"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 font-mono">Email Address</label>
                  <input
                    type="email"
                    required
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="e.g. owner@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-sans transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 font-mono">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={manualPassword}
                      onChange={(e) => setManualPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-sans transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/50 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>{isSignUp ? 'Create Workspace' : 'Access Workspace'}</span>
                  )}
                </button>
              </form>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setFormError(null);
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline font-mono"
                >
                  {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create One"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

