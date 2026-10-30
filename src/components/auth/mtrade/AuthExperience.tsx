"use client";

import { useEffect, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  Info,
  Lock,
  Mail,
  ShieldCheck,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import MarketTicker from "./MarketTicker";
import PriceChart from "./PriceChart";
import FearGreedGauge from "./FearGreedGauge";
import VolumeBars from "./VolumeBars";
import OtpModal, { type OtpMode, type OtpResult } from "./OtpModal";

type Mode = "signin" | "register";

type Pending =
  | { kind: "signin"; email: string; password: string }
  | { kind: "register"; name: string; email: string; password: string };

type ToastTone = "success" | "error" | "info";

function passwordStrength(value: string) {
  const checks = [
    value.length >= 12,
    /[a-z]/.test(value) && /[A-Z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ];
  const score = checks.filter(Boolean).length;
  const config = [
    { width: "0%", color: "#f43f5e", text: "—" },
    { width: "25%", color: "#f43f5e", text: "Weak" },
    { width: "50%", color: "#f59e0b", text: "Fair" },
    { width: "75%", color: "#38bdf8", text: "Good" },
    { width: "100%", color: "#10b981", text: "Strong" },
  ];
  return config[score];
}

export default function AuthExperience({ initialMode }: { initialMode: Mode }) {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [formError, setFormError] = useState("");

  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [showSigninPassword, setShowSigninPassword] = useState(false);
  const [remember, setRemember] = useState(false);

  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirm, setRegisterConfirm] = useState("");
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [terms, setTerms] = useState(false);

  const [otp, setOtp] = useState<{ open: boolean; mode: OtpMode }>({ open: false, mode: "signin" });

  const pendingRef = useRef<Pending | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const clockRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const updateClock = () => {
      if (!clockRef.current) return;
      clockRef.current.textContent = new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    };

    updateClock();
    const id = window.setInterval(updateClock, 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(toastTimer.current);
  }, []);

  function showToast(message: string, tone: ToastTone = "success") {
    setToast({ message, tone });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3400);
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setFormError("");
    router.push(next === "signin" ? "/auth/login" : "/auth/register");
  }

  function handleSigninSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const email = signinEmail.trim();
    if (!email || !signinPassword) {
      setFormError("Enter your email and password to continue.");
      return;
    }

    pendingRef.current = { kind: "signin", email, password: signinPassword };
    setOtp({ open: true, mode: "signin" });
  }

  function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const name = registerName.trim();
    const email = registerEmail.trim();

    if (!name || !email || !registerPassword) {
      setFormError("Complete all fields to open your account.");
      return;
    }
    if (registerPassword.length < 12) {
      setFormError("Use a password with at least 12 characters.");
      return;
    }
    if (registerPassword !== registerConfirm) {
      setFormError("Passwords do not match.");
      return;
    }
    if (!terms) {
      setFormError("Accept the terms to continue.");
      return;
    }

    pendingRef.current = { kind: "register", name, email, password: registerPassword };
    setOtp({ open: true, mode: "register" });
  }

  async function handleVerify(code: string): Promise<OtpResult> {
    if (code.length !== 6) {
      return { ok: false, error: "Enter the 6-digit verification code." };
    }

    const pending = pendingRef.current;
    if (!pending) {
      return { ok: false, error: "Your session expired. Please try again." };
    }

    if (pending.kind === "signin") {
      const result = await signIn("credentials", {
        email: pending.email,
        password: pending.password,
        redirect: false,
        redirectTo: "/dashboard",
      });

      if (!result || !result.ok || result.error) {
        return { ok: false, error: "Unable to sign in. Check your email and password." };
      }

      return { ok: true, title: "Access granted", text: "Welcome to MTrade. Your terminal is ready." };
    }

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: pending.name, email: pending.email, password: pending.password }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      return { ok: false, error: data.error || "Unable to submit your request." };
    }

    return {
      ok: true,
      title: "Request submitted",
      text: "Your application is under review. Our access team will verify your account shortly.",
    };
  }

  function handleOtpClose() {
    pendingRef.current = null;
    setOtp((current) => ({ ...current, open: false }));
  }

  function handleOtpDone() {
    const pending = pendingRef.current;
    pendingRef.current = null;
    setOtp((current) => ({ ...current, open: false }));

    if (pending?.kind === "signin") {
      router.replace("/dashboard");
      router.refresh();
    } else {
      router.push("/auth/login");
    }
  }

  function handleDemoFill() {
    setSigninEmail("demo@mtrade.io");
    setSigninPassword("DemoTrader#2026");
    setRemember(true);
    setFormError("");
    showToast("Demo credentials loaded. Press Enter Terminal.", "info");
  }

  function handleSso(provider: string) {
    showToast(`Connecting to ${provider} SSO...`, "info");
    window.setTimeout(() => showToast(`${provider} SSO is simulated in this demo.`, "info"), 1200);
  }

  function handlePasskey() {
    showToast("Waiting for biometric verification...", "info");
    window.setTimeout(() => showToast("Passkey verified. Open the terminal to continue.", "success"), 1400);
  }

  function handleTerms(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    showToast("Terms and privacy documents open in the full app.", "info");
  }

  const strength = passwordStrength(registerPassword);

  return (
    <div className="mtx-root min-h-screen bg-[#0b0f19] text-slate-200 antialiased selection:bg-emerald-500/25 selection:text-white">
      <div className="mtx-hero-glow pointer-events-none fixed inset-0" aria-hidden="true" />
      <div className="mtx-grid-bg pointer-events-none fixed inset-0" aria-hidden="true" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-40 bg-gradient-to-b from-[#0b0f19] to-transparent" aria-hidden="true" />

      <header className="relative z-30 border-b border-white/[0.06] bg-[#080b12]/85 backdrop-blur-xl">
        <div className="flex h-11 items-center">
          <Link href="/" className="flex shrink-0 items-center gap-2 border-r border-white/[0.06] px-4 lg:px-6">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-emerald-500 text-[#04120c] shadow-[0_0_18px_rgba(16,185,129,.35)]">
              <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.6} />
            </span>
            <span className="text-[13px] font-bold tracking-tight text-white">
              MTrade
              <span className="ml-1 font-mono text-[8px] font-medium uppercase tracking-[.2em] text-emerald-400/80">Terminal</span>
            </span>
          </Link>

          <MarketTicker />

          <div className="hidden shrink-0 items-center gap-2 border-l border-white/[0.06] px-4 md:flex lg:px-6">
            <span className="mtx-pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono text-[9px] uppercase tracking-[.16em] text-slate-400">Markets Open</span>
            <span ref={clockRef} className="font-mono text-[9px] text-slate-600" />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-44px)] w-full max-w-[1560px] grid-cols-1 gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_450px] lg:gap-10 lg:px-8 lg:py-8">
        <section className="hidden min-w-0 flex-col justify-between gap-6 lg:flex">
          <div className="mtx-float-in">
            <div className="mb-4 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.18em] text-emerald-400">
                <span className="mtx-pulse-dot h-1 w-1 rounded-full bg-emerald-400" />
                Institutional access
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[.14em] text-slate-600">v4.2.1</span>
            </div>
            <h1 className="max-w-[620px] text-[clamp(2.4rem,4.2vw,4rem)] font-semibold leading-[1.02] tracking-[-.055em] text-white">
              Trade the market
              <br />
              <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-300 bg-clip-text text-transparent">
                with an edge.
              </span>
            </h1>
            <p className="mt-4 max-w-[480px] text-[13px] leading-7 text-slate-400">
              Institutional-grade execution, real-time risk controls, and deep market intelligence — built for traders who demand precision.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {["REAL-TIME DATA", "SMART ORDER ROUTING", "PAPER TRADING"].map((item) => (
                <span key={item} className="mtx-glass-soft rounded-lg px-2.5 py-1.5 font-mono text-[9px] text-slate-400">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <PriceChart />

          <div className="grid grid-cols-3 gap-3">
            <FearGreedGauge />

            <div className="mtx-glass mtx-float-in rounded-2xl p-4" style={{ animationDelay: "210ms" }}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[8px] uppercase tracking-[.16em] text-slate-500">24h Volume</span>
                <BarChart3 className="h-3.5 w-3.5 text-slate-600" />
              </div>
              <div className="mt-3 font-mono text-xl font-semibold tracking-tight text-white">
                $42.8<span className="ml-0.5 text-[10px] font-normal text-slate-500">B</span>
              </div>
              <VolumeBars />
              <div className="mt-2 font-mono text-[8px] text-emerald-400">+12.4% vs 30d avg</div>
            </div>

            <div className="mtx-glass mtx-float-in rounded-2xl p-4" style={{ animationDelay: "270ms" }}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[8px] uppercase tracking-[.16em] text-slate-500">Execution</span>
                <Zap className="h-3.5 w-3.5 text-slate-600" />
              </div>
              <div className="mt-3 font-mono text-xl font-semibold tracking-tight text-white">
                9.4<span className="ml-0.5 text-[10px] font-normal text-slate-500">ms</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="mtx-pulse-dot h-1 w-1 rounded-full bg-emerald-400" />
                <span className="font-mono text-[8px] text-slate-500">Optimal routing</span>
              </div>
              <div className="mt-2 font-mono text-[8px] text-slate-600">99.99% uptime · 24/5</div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <div className="mtx-glass mtx-float-in w-full max-w-[450px] rounded-2xl p-6 sm:p-7">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-[#04120c] shadow-[0_0_24px_rgba(16,185,129,.3)]">
                  <TrendingUp className="h-5 w-5" strokeWidth={2.4} />
                </span>
                <div>
                  <div className="text-[15px] font-bold tracking-tight text-white">MTrade</div>
                  <div className="font-mono text-[8px] uppercase tracking-[.18em] text-slate-500">Trading Terminal</div>
                </div>
              </div>
              <span className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 font-mono text-[8px] text-slate-500">
                <Lock className="h-2.5 w-2.5 text-emerald-400" />
                SECURE
              </span>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-white/[0.07] bg-[#080c15]/70 p-1" role="tablist" aria-label="Authentication mode">
              <button
                id="tabSignin"
                type="button"
                role="tab"
                aria-selected={mode === "signin"}
                aria-controls="signinPanel"
                onClick={() => switchMode("signin")}
                className={`rounded-lg px-3 py-2.5 text-[11px] font-semibold transition ${
                  mode === "signin" ? "mtx-tab-active" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                Sign In
              </button>
              <button
                id="tabRegister"
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                aria-controls="registerPanel"
                onClick={() => switchMode("register")}
                className={`rounded-lg px-3 py-2.5 text-[11px] font-semibold transition ${
                  mode === "register" ? "mtx-tab-active" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                Open Trading Account
              </button>
            </div>

            <div id="signinPanel" role="tabpanel" aria-labelledby="tabSignin" className={mode === "signin" ? "" : "hidden"}>
              <div className="mb-5">
                <h2 className="text-lg font-semibold tracking-tight text-white">Welcome back</h2>
                <p className="mt-1 text-[11px] text-slate-500">Sign in to access your trading terminal.</p>
              </div>

              <form className="space-y-3.5" onSubmit={handleSigninSubmit} noValidate>
                <div>
                  <label htmlFor="signinEmail" className="mb-1.5 block font-mono text-[9px] uppercase tracking-[.14em] text-slate-500">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="mtx-field-icon absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                    <input
                      id="signinEmail"
                      name="email"
                      type="email"
                      autoComplete="username"
                      placeholder="trader@mtrade.io"
                      value={signinEmail}
                      onChange={(event) => setSigninEmail(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#080c15]/85 py-3 pl-10 pr-4 text-[12px] text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="signinPassword" className="mb-1.5 block font-mono text-[9px] uppercase tracking-[.14em] text-slate-500">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="mtx-field-icon absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                    <input
                      id="signinPassword"
                      name="password"
                      type={showSigninPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={signinPassword}
                      onChange={(event) => setSigninPassword(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#080c15]/85 py-3 pl-10 pr-11 text-[12px] text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSigninPassword((current) => !current)}
                      aria-label={showSigninPassword ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-300"
                    >
                      {showSigninPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-0.5">
                  <label className="flex cursor-pointer items-center gap-2 text-[10px] text-slate-500">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(event) => setRemember(event.target.checked)}
                      className="h-3.5 w-3.5 rounded border-white/20 bg-[#080c15] accent-emerald-500"
                    />
                    Remember device
                  </label>
                  <button
                    type="button"
                    onClick={() => showToast("Password reset is not configured yet.", "info")}
                    className="text-[10px] font-medium text-emerald-400 transition hover:text-emerald-300"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleDemoFill}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2.5 text-[10px] font-semibold text-emerald-300 transition hover:border-emerald-500/35 hover:bg-emerald-500/[0.1]"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Demo Trader — auto-fill credentials
                </button>

                {formError && (
                  <p className="text-[10px] leading-5 text-rose-400" role="alert">
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  className="mtx-cta-shine group flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3.5 text-[12px] font-bold text-[#04120c] transition hover:bg-emerald-400 hover:shadow-[0_0_34px_rgba(16,185,129,.35)]"
                >
                  Enter Terminal
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </form>

              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-white/[0.07]" />
                <span className="font-mono text-[8px] uppercase tracking-[.16em] text-slate-600">or continue with</span>
                <span className="h-px flex-1 bg-white/[0.07]" />
              </div>

              <button type="button" onClick={handlePasskey} className="mtx-sso-btn mb-2 w-full">
                <Fingerprint className="h-4 w-4 text-emerald-400" />
                Continue with passkey / biometric
              </button>

              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => handleSso("Google")} className="mtx-sso-btn">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M12 10.2v3.9h5.4c-.24 1.4-1.7 4.2-5.4 4.2-3.25 0-5.9-2.7-5.9-6s2.65-6 5.9-6c1.85 0 3.1.8 3.8 1.5l2.6-2.5C16.75 3.7 14.6 2.7 12 2.7 6.9 2.7 2.8 6.9 2.8 12s4.1 9.3 9.2 9.3c5.3 0 8.8-3.7 8.8-9 0-.6-.06-1.1-.15-2.1H12Z"
                    />
                  </svg>
                  Google
                </button>
                <button type="button" onClick={() => handleSso("Bloomberg")} className="mtx-sso-btn">
                  <span className="grid h-3.5 w-3.5 place-items-center rounded-[2px] bg-[#f59e0b] font-mono text-[8px] font-bold text-black">B</span>
                  Bloomberg
                </button>
                <button type="button" onClick={() => handleSso("Apple")} className="mtx-sso-btn">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                    <path d="M16.4 12.8c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-2.9-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.7-.4 6.7 1.1 8.9.7 1.1 1.6 2.3 2.8 2.2 1.1 0 1.5-.7 2.9-.7s1.7.7 2.9.7c1.2 0 2-1.1 2.7-2.1.9-1.3 1.2-2.5 1.2-2.6-.1 0-2.3-.9-2.3-3.5ZM14.2 6.1c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.6 1.4-.6.7-1 1.8-.9 2.8 1 .1 2-.5 2.6-1.3Z" />
                  </svg>
                  Apple
                </button>
              </div>

              <p className="mt-5 text-center text-[9px] leading-5 text-slate-600">
                Protected by institutional-grade encryption.
                <br />
                MTrade is a paper trading platform. No real funds are at risk.
              </p>
            </div>

            <div id="registerPanel" role="tabpanel" aria-labelledby="tabRegister" className={mode === "register" ? "" : "hidden"}>
              <div className="mb-5">
                <h2 className="text-lg font-semibold tracking-tight text-white">Open your account</h2>
                <p className="mt-1 text-[11px] text-slate-500">Apply for access to the MTrade terminal.</p>
              </div>

              <form className="space-y-3.5" onSubmit={handleRegisterSubmit} noValidate>
                <div>
                  <label htmlFor="registerName" className="mb-1.5 block font-mono text-[9px] uppercase tracking-[.14em] text-slate-500">
                    Full name
                  </label>
                  <div className="relative">
                    <User className="mtx-field-icon absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                    <input
                      id="registerName"
                      name="name"
                      type="text"
                      autoComplete="name"
                      placeholder="Alex Morgan"
                      value={registerName}
                      onChange={(event) => setRegisterName(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#080c15]/85 py-3 pl-10 pr-4 text-[12px] text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="registerEmail" className="mb-1.5 block font-mono text-[9px] uppercase tracking-[.14em] text-slate-500">
                    Work email
                  </label>
                  <div className="relative">
                    <Mail className="mtx-field-icon absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                    <input
                      id="registerEmail"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      value={registerEmail}
                      onChange={(event) => setRegisterEmail(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#080c15]/85 py-3 pl-10 pr-4 text-[12px] text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="registerPassword" className="mb-1.5 block font-mono text-[9px] uppercase tracking-[.14em] text-slate-500">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="mtx-field-icon absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                    <input
                      id="registerPassword"
                      name="password"
                      type={showRegisterPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Create a strong password"
                      value={registerPassword}
                      onChange={(event) => setRegisterPassword(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#080c15]/85 py-3 pl-10 pr-11 text-[12px] text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword((current) => !current)}
                      aria-label={showRegisterPassword ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-300"
                    >
                      {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="mtx-strength-bar h-full rounded-full" style={{ width: strength.width, backgroundColor: strength.color }} />
                    </div>
                    <span className="w-16 text-right font-mono text-[8px]" style={{ color: strength.color }}>
                      {strength.text}
                    </span>
                  </div>
                </div>

                <div>
                  <label htmlFor="registerPasswordConfirm" className="mb-1.5 block font-mono text-[9px] uppercase tracking-[.14em] text-slate-500">
                    Confirm password
                  </label>
                  <div className="relative">
                    <ShieldCheck className="mtx-field-icon absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                    <input
                      id="registerPasswordConfirm"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Repeat your password"
                      value={registerConfirm}
                      onChange={(event) => setRegisterConfirm(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#080c15]/85 py-3 pl-10 pr-4 text-[12px] text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10"
                    />
                  </div>
                </div>

                <label className="flex cursor-pointer items-start gap-2 pt-0.5 text-[9px] leading-5 text-slate-500">
                  <input
                    type="checkbox"
                    checked={terms}
                    onChange={(event) => setTerms(event.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-white/20 bg-[#080c15] accent-emerald-500"
                  />
                  <span>
                    I agree to the{" "}
                    <button type="button" onClick={handleTerms} className="text-emerald-400 hover:text-emerald-300">
                      Terms of Service
                    </button>{" "}
                    and{" "}
                    <button type="button" onClick={handleTerms} className="text-emerald-400 hover:text-emerald-300">
                      Privacy Policy
                    </button>
                    .
                  </span>
                </label>

                {formError && (
                  <p className="text-[10px] leading-5 text-rose-400" role="alert">
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  className="mtx-cta-shine group flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3.5 text-[12px] font-bold text-[#04120c] transition hover:bg-emerald-400 hover:shadow-[0_0_34px_rgba(16,185,129,.35)]"
                >
                  Open Trading Account
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </form>

              <p className="mt-4 text-center text-[9px] leading-5 text-slate-600">
                Account requests are reviewed by our access team.
                <br />
                You will receive a verification code once approved.
              </p>
            </div>
          </div>
        </section>
      </main>

      {otp.open && (
        <OtpModal key={otp.mode} mode={otp.mode} onClose={handleOtpClose} onVerify={handleVerify} onDone={handleOtpDone} />
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-xl border border-white/10 bg-[#0e1422]/95 px-4 py-3 text-[11px] text-slate-200 shadow-2xl backdrop-blur-xl"
        >
          <span className={toast.tone === "error" ? "text-rose-400" : toast.tone === "info" ? "text-sky-400" : "text-emerald-400"}>
            {toast.tone === "error" ? (
              <AlertCircle className="h-4 w-4" />
            ) : toast.tone === "info" ? (
              <Info className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
          </span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
