"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [register, setRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setError("");
    setLoading(true);
    let accountCreated = false;
    try {
      if (register) {
        const response = await fetch("/api/auth/register", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to create account.");
        accountCreated = true;
      }
      const result = await signIn("credentials", { email, password, redirect: false, redirectTo: "/dashboard" });
      if (!result || result.error) {
        throw new Error(accountCreated ? "Account created. Please sign in to continue." : "Unable to sign in. Check your email and password, or try again later.");
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      if (accountCreated) setRegister(false);
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4 text-white">
      <div className="w-full max-w-md space-y-6 rounded-xl bg-gray-800 p-8 shadow-lg">
        <div>
          <h1 className="text-center text-2xl font-bold">TradeVision Pro</h1>
          <p className="mt-2 text-center text-gray-300">{register ? "Create your paper trading account" : "Sign in to your account"}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" maxLength={254} required disabled={loading}
              className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 outline-none focus:border-blue-400" />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm">Password</label>
            <input id="password" name="password" type="password" autoComplete={register ? "new-password" : "current-password"}
              minLength={12} maxLength={128} required disabled={loading}
              className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 outline-none focus:border-blue-400" />
            {register && <p className="mt-1 text-xs text-gray-400">Use 12–128 characters.</p>}
          </div>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <button type="submit" disabled={loading} className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500 disabled:opacity-50">
            {loading ? "Please wait..." : register ? "Create account" : "Sign in"}
          </button>
        </form>
        <button type="button" disabled={loading} onClick={() => { setRegister(!register); setError(""); }}
          className="w-full text-sm text-blue-300 hover:underline disabled:opacity-50">
          {register ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}
