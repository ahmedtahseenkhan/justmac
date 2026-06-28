"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Logo } from "@/components/Logo";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-brand-900 text-white/60">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const setSession = useSession((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.login({ email, password });
      setSession(res.token, res.user);
      router.replace(params.get("next") || "/admin");
    } catch {
      setError("Invalid email or password.");
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-brand-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5 text-white">
          <Logo size={40} />
          <span className="font-display text-2xl font-extrabold">JustMac</span>
        </div>
        <div className="card p-7">
          <h1 className="font-display text-xl font-bold">Back office</h1>
          <p className="mt-1 text-sm text-ink-500">Sign in to manage orders, catalog and pricing.</p>

          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (email && password) void submit();
            }}
          >
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink-700">Email</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink-700">Password</span>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="btn-primary w-full" disabled={busy || !email || !password}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-5 rounded-lg bg-canvas p-3 text-xs text-ink-500">
            <p className="font-semibold text-ink-700">Demo accounts</p>
            <p className="mt-1">owner@justmac.test / owner1234 <span className="text-ink-300">(admin)</span></p>
            <p>staff@justmac.test / staff1234 <span className="text-ink-300">(ops staff)</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
