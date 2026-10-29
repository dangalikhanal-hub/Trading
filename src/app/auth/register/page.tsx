"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "");
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to submit your request.");
      setSubmitted(true);
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
              Create your account and take the first step into a clearer,
              more confident trading journey.
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

        <section className="login-card" aria-labelledby="register-heading">
          <div className="login-card-top">
            <span className="login-lock-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none">
                <rect x="4.25" y="8.5" width="11.5" height="8" rx="2" />
                <path d="M6.75 8.5V6.25a3.25 3.25 0 0 1 6.5 0V8.5" />
                <path d="M10 11.5v2" />
              </svg>
            </span>
            <span>NEW ACCOUNT</span>
          </div>

          {submitted ? (
            <div className="login-request-success" role="status">
              <span className="login-success-mark" aria-hidden="true">✓</span>
              <h2 id="register-heading">Request received.</h2>
              <p>
                Your account request is now waiting for administrator approval.
                You&apos;ll be able to sign in once it has been verified.
              </p>
              <Link className="login-submit" href="/auth/login">
                Back to sign in
                <span aria-hidden="true">↗</span>
              </Link>
            </div>
          ) : (
            <>
              <div className="login-card-heading">
                <h2 id="register-heading">
                  Create your account<span>.</span>
                </h2>
                <p>
                  Submit your details. A super admin will verify and activate
                  your account.
                </p>
              </div>

              <form className="login-form" onSubmit={handleSubmit}>
                <div className="login-field">
                  <label htmlFor="name">Full name</label>
                  <input
                    className="login-input"
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    maxLength={80}
                    placeholder="Your full name"
                    required
                    disabled={loading}
                  />
                </div>

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
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    placeholder="Create a password"
                    required
                    disabled={loading}
                  />
                  <p className="login-password-hint">Use 12–128 characters.</p>
                </div>

                <div className="login-field">
                  <label htmlFor="confirmPassword">Confirm password</label>
                  <input
                    className="login-input"
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    placeholder="Repeat your password"
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
                  {loading ? "Please wait..." : "Request account"}
                  {!loading && <span aria-hidden="true">↗</span>}
                </button>
              </form>

              <div className="login-divider">
                <span>ADMIN VERIFICATION REQUIRED</span>
              </div>

              <p className="login-security-note">
                <span className="login-security-dot" />
                Your password is encrypted before the request is stored.
              </p>

              <div className="login-card-bottom">
                <span>Already have an account?</span>
                <Link className="login-register-toggle" href="/auth/login">
                  Sign in instead
                </Link>
              </div>
            </>
          )}
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
