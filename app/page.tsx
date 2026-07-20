'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Loader2 } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Falls back to direct dashboard routing just in case middleware is loading
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50">
      <div className="text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-100">
          <CreditCard className="h-7 w-7 animate-pulse" />
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          SaaS ID Card Generator
        </h1>
        <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          <span>Synchronizing your secure secure workspace session...</span>
        </div>
      </div>
    </div>
  );
}
