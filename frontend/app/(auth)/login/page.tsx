"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const DEMO_ACCOUNTS = [
  { label: "Employee", email: "employee@demo.com", password: "Demo@1234" },
  { label: "Manager", email: "manager@demo.com", password: "Demo@1234" },
  { label: "Admin", email: "admin@demo.com", password: "Demo@1234" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  function fillDemo(account: (typeof DEMO_ACCOUNTS)[number]) {
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
  }

  const inputClass =
    "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl mb-4">
            <BarChart3 size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Performance Management</h1>
          <p className="text-sm text-slate-500 mt-1">Platform</p>
        </div>

        <div className="card p-6 mb-4">
          <h2 className="text-base font-semibold text-slate-700 mb-5">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={inputClass}
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Sign In
            </button>
          </form>
        </div>

        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 mb-3">Demo Accounts (password: Demo@1234)</p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                onClick={() => fillDemo(account)}
                className="flex flex-col items-center gap-1 px-3 py-2.5 text-xs border border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
              >
                <span className="font-medium text-slate-700">{account.label}</span>
                <span className="text-[10px] text-slate-400 truncate w-full text-center">{account.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
