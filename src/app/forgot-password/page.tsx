'use client';

import { useState } from 'react';
import { requestPasswordReset } from './actions';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    const result = await requestPasswordReset(email);
    if (result.success) {
      setStatus('sent');
    } else {
      setErrorMsg(result.error || 'Something went wrong.');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-neutral-800 p-8 rounded-xl shadow-xl border border-neutral-700">

        {status === 'sent' ? (
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white">Check your email</h1>
            <p className="text-neutral-400 text-sm leading-relaxed">
              If <span className="text-white font-medium">{email}</span> is registered, you&apos;ll receive a password reset link shortly. Click it to set a new password on the Player Index site.
            </p>
            <Link href="/login" className="text-blue-400 hover:text-blue-300 text-sm underline mt-2">
              Back to login
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white">Forgot your password?</h1>
              <p className="text-neutral-400 text-sm mt-1">Enter your admin email and we&apos;ll send a reset link.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Admin Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@yourstore.com"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {status === 'error' && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                  <p className="text-sm text-red-400 text-center">{errorMsg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {status === 'loading' ? 'Sending…' : 'Send Reset Link'}
              </button>

              <Link href="/login" className="block text-center text-sm text-neutral-500 hover:text-neutral-400">
                ← Back to login
              </Link>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
