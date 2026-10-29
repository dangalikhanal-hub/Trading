"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  const handleLogin = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <main className="login-shell">
      <div className="login-glow login-glow-one" aria-hidden="true" />
      <div className="login-glow login-glow-two" aria-hidden="true" />

      <div className="login-layout">
        <section className="login-story" aria-label="TradeVision Pro">
          <a className="login-brand" href="/" aria-label="TradeVision Pro home">
            <span className="login-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="none">
                <path d="M5 22.5 12.2 15l4.8 4.7L27 9" />
                <path d="M19.5 9H27v7.5" />
              </svg>
            </span>
            <span>TradeVision<span className="login-brand-light">Pro</span></span>
          </a>

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
                <linearGradient id="loginWaveGradient" x1="220" y1="0" x2="220" y2="150" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#78d6a8" />
                  <stop offset="1" stopColor="#78d6a8" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className="login-wave-fill" d="M0 113c36-5 50-48 83-42s43 43 78 30 47-53 80-43 44 43 77 19 63-30 122-19v92H0z" />
              <path className="login-wave-line" d="M0 113c36-5 50-48 83-42s43 43 78 30 47-53 80-43 44 43 77 19 63-30 122-19" />
            </svg>
            <div className="login-visual-footer">
              <span>Clarity in every move</span>
              <span className="login-visual-dashes"><i /><i /><i /><i /><i /></span>
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
            <h2 id="login-heading">Welcome back<span>.</span></h2>
            <p>Sign in to pick up where you left off.</p>
          </div>

          <button onClick={handleLogin} className="login-google-button" type="button">
            <svg viewBox="0 0 533.5 544.3" aria-hidden="true">
              <path fill="#4285F4" d="M533.5 278.4c0-17.5-1.5-34.2-4.4-50.5H272v95.5h146.9c-6.4 34.4-25.6 63.5-54.5 83V447h88.1c51.6-47.5 80.9-117.5 80.9-200.6" />
              <path fill="#34A853" d="M272 544.3c73.4 0 135-24.5 180-66.5l-88.1-68c-24.4 16.4-55.8 26-91.9 26-70.8 0-130.7-47.7-152.2-111.7H30.1v70.2c45 89.5 139.6 149.9 241.9 149.9" />
              <path fill="#FBBC05" d="M119.8 324.1c-10-30-10-62.2 0-92.2V161.7H30.1c-39 77.2-39 168.8 0 246l89.7-73.6" />
              <path fill="#EA4335" d="M272 107.7c39.9-.6 78.5 15.1 106.9 43.4l80-80C416.9 23.5 345.5 0 272 0 169.7 0 75.1 60.4 30.1 149.9l89.7 70.2C141.3 155.5 201.2 107.7 272 107.7" />
            </svg>
            Continue with Google
            <span className="login-button-arrow" aria-hidden="true">↗</span>
          </button>

          <div className="login-divider"><span>QUICK &amp; SECURE</span></div>

          <p className="login-security-note">
            <span className="login-security-dot" />
            Your account is protected with Google authentication.
          </p>

          <div className="login-card-bottom">
            <span>New to TradeVision Pro?</span>
            <span className="login-card-bottom-accent">Your next chapter starts here.</span>
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
