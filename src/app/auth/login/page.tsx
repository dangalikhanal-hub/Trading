"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        redirectTo: "/dashboard",
      });
      if (!result || result.error) {
        throw new Error("Unable to sign in. Check your email and password, or try again later.");
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="login-glow login-glow-one" aria-hidden="true" />
      <div className="login-glow login-glow-two" aria-hidden="true" />

      <div className="login-layout">
        <section className="login-story" aria-label="TradeVision Pro">
          <Link className="login-brand" href="/" aria-label="TradeVision Pro home">
            <span className="login-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="none">
                <path d="M5 22.5 12.2 15l4.8 4.7L27 9" />
                <path d="M19.5 9H27v7.5" />
              </svg>
            </span>
            <span>
              TradeVision<span className="login-brand-light">Pro</span>
            </span>
          </Link>

          <div className="login-story-copy">
            <div className="login-kicker">
              <span className="login-kicker-dot" />
              YOUR MARKET EDGE STARTS HERE
            </div>
            <h1>
              See the market
              <span> in a new light.</span>
            </h1>
            <p>
              A clearer view of your trading journey starts with the right
              tools. Step into your personal trading space.
            </p>
          </div>

          <div className="login-visual" aria-hidden="true">
            <div className="login-visual-caption">
              <span className="login-visual-icon">
                <svg viewBox="0 0 20 20" fill="none">
                  <path d="M3 14.5 7.3 10l3 2.8L17 5.5" />
                  <path d="M12.5 5.5H17V10" />
                </svg>
              </span>
              <span>One step ahead</span>
            </div>
            <svg className="login-wave" viewBox="0 0 440 150" fill="none">
              <defs>
                <linearGradient
                  id="loginWaveGradient"
                  x1="220"
                  y1="0"
                  x2="220"
                  y2="150"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#78d6a8" />
                  <stop offset="1" stopColor="#78d6a8" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                className="login-wave-fill"
                d="M0 113c36-5 50-48 83-42s43 43 78 30 47-53 80-43 44 43 77 19 63-30 122-19v92H0z"
              />
              <path
                className="login-wave-line"
                d="M0 113c36-5 50-48 83-42s43 43 78 30 47-53 80-43 44 43 77 19 63-30 122-19"
              />
            </svg>
            <div className="login-visual-footer">
              <span>Clarity in every move</span>
              <span className="login-visual-dashes">
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>

          <div className="login-story-footer">
            <span className="login-footer-spark" />
            Built for curious minds and confident decisions
          </div>
        </section>

        <section className="login-card" aria-labelledby="login-heading">
          <div className="login-card-top">
            <span className="login-lock-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none">
                <rect x="4.25" y="8.5" width="11.5" height="8" rx="2" />
                <path d="M6.75 8.5V6.25a3.25 3.25 0 0 1 6.5 0V8.5" />
                <path d="M10 11.5v2" />
              </svg>
            </span>
            <span>SECURE SIGN IN</span>
          </div>

          <div className="login-card-heading">
            <h2 id="login-heading">
              Welcome back<span>.</span>
            </h2>
            <p>Sign in to pick up where you left off.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="email">Email address</label>
              <input
                className="login-input"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">Password</label>
              <input
                className="login-input"
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                minLength={12}
                maxLength={128}
                placeholder="Enter your password"
                required
                disabled={loading}
              />
            </div>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            <button
              className="login-submit"
              type="submit"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? "Please wait..." : "Sign in"}
              {!loading && <span aria-hidden="true">↗</span>}
            </button>
          </form>

          <div className="login-divider">
            <span>PRIVATE &amp; SECURE</span>
          </div>

          <p className="login-security-note">
            <span className="login-security-dot" />
            Your account and trading activity stay protected.
          </p>

          <div className="login-card-bottom">
            <span>New to TradeVision Pro?</span>
            <Link className="login-register-toggle" href="/auth/register">
              Create a free account
            </Link>
            <span className="login-approval-note">
              New accounts are reviewed by an administrator before activation.
            </span>
          </div>
        </section>
      </div>

      <footer className="login-page-footer">
        <span>TRADEVISION PRO</span>
        <span className="login-page-footer-separator" />
        <span>A clearer view of the markets</span>
      </footer>
    </main>
  );
}
