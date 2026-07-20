'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Globe, ArrowRight, Shield } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Mock log in locally and save mock session key
      localStorage.setItem('webaudit_token', 'mock_token_key');
      localStorage.setItem('webaudit_user', JSON.stringify({ email }));
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Giriş yapılamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-20 px-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col gap-6">
        <div className="flex flex-col items-center text-center gap-2">
          <Globe className="w-8 h-8 text-emerald-500" />
          <h1 className="text-2xl font-bold text-white">Yeniden Hoş Geldiniz</h1>
          <p className="text-sm text-slate-400">WebAudit AI hesabınıza giriş yapın</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">E-Posta Adresi</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="isim@sirket.com"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500 text-sm transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">Parola</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500 text-sm transition-all"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all text-sm"
          >
            {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center text-xs text-slate-400">
          Hesabınız yok mu?{' '}
          <Link href="/register" className="text-emerald-500 hover:underline">
            Ücretsiz kayıt olun
          </Link>
        </div>
      </div>
    </div>
  );
}
