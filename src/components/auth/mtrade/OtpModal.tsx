"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowRight, Check, ShieldCheck, Smartphone, X } from "lucide-react";

export type OtpMode = "signin" | "register";

export type OtpResult =
  | { ok: true; title: string; text: string }
  | { ok: false; error: string };

type Props = {
  mode: OtpMode;
  onClose: () => void;
  onVerify: (code: string) => Promise<OtpResult>;
  onDone: () => void;
};

const EMPTY_DIGITS = ["", "", "", "", "", ""];

export default function OtpModal({ mode, onClose, onVerify, onDone }: Props) {
  const [digits, setDigits] = useState<string[]>(() => [...EMPTY_DIGITS]);
  const [seconds, setSeconds] = useState(30);
  const [step, setStep] = useState<"entry" | "success">("entry");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ title: string; text: string } | null>(null);
  const [timerKey, setTimerKey] = useState(0);

  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    document.body.classList.add("mtx-modal-open");
    const focusTimer = window.setTimeout(() => inputsRef.current[0]?.focus(), 80);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.classList.remove("mtx-modal-open");
    };
  }, []);

  useEffect(() => {
    if (step !== "entry") return;

    const id = window.setInterval(() => {
      setSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(id);
  }, [step, timerKey]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const code = digits.join("");
  const complete = code.length === 6;

  function updateDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(0, 1);
    setDigits((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });

    if (digit && index < EMPTY_DIGITS.length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
      updateDigit(index - 1, "");
    }

    if (event.key === "Enter" && complete) {
      void handleVerify();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = (event.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    event.preventDefault();
    const next = EMPTY_DIGITS.map((_, index) => pasted[index] ?? "");
    setDigits(next);
    inputsRef.current[Math.min(pasted.length, EMPTY_DIGITS.length - 1)]?.focus();
  }

  function resetCode() {
    setDigits([...EMPTY_DIGITS]);
    setError("");
    setSeconds(30);
    setStep("entry");
    setTimerKey((key) => key + 1);
    window.setTimeout(() => inputsRef.current[0]?.focus(), 40);
  }

  async function handleVerify() {
    if (!complete || loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await onVerify(code);
      if (response.ok) {
        setResult({ title: response.title, text: response.text });
        setStep("success");
      } else {
        setError(response.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const verifyLabel = mode === "register" ? "Verify & Submit Request" : "Verify & Enter Terminal";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label="Two-factor verification">
      <button type="button" aria-label="Close verification" className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <div className="mtx-glass relative w-full max-w-[400px] rounded-2xl p-6 sm:p-7">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close verification"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>

        {step === "entry" ? (
          <div>
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h3 id="mtxOtpTitle" className="text-[15px] font-semibold text-white">
                  Two-factor verification
                </h3>
                <p className="mt-0.5 text-[10px] text-slate-500">Enter the 6-digit code from your authenticator.</p>
              </div>
            </div>

            <div className="mb-4 flex items-center justify-between rounded-lg border border-white/[0.07] bg-[#080c15]/70 px-3 py-2">
              <span className="flex items-center gap-1.5 font-mono text-[9px] text-slate-500">
                <Smartphone className="h-3 w-3 text-emerald-400" />
                Authenticator app
              </span>
              <span className={`font-mono text-[9px] ${seconds === 0 ? "text-rose-400" : "text-slate-400"}`}>
                {seconds === 0 ? "Code expired" : `Expires in 00:${String(seconds).padStart(2, "0")}`}
              </span>
            </div>

            <div className="grid grid-cols-6 gap-2">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(node) => {
                    inputsRef.current[index] = node;
                  }}
                  value={digit}
                  onChange={(event) => updateDigit(index, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  onPaste={handlePaste}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  autoComplete="one-time-code"
                  aria-label={`Digit ${index + 1}`}
                  className={`mtx-otp-input ${digit ? "mtx-filled" : ""}`}
                />
              ))}
            </div>

            <p className="mt-3 text-center font-mono text-[8px] text-slate-600">Demo mode: enter any 6 digits</p>

            {error && (
              <p className="mt-3 text-center text-[10px] leading-5 text-rose-400" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => void handleVerify()}
              disabled={!complete || loading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-[11px] font-bold text-[#04120c] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Verifying..." : verifyLabel}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={resetCode}
                disabled={loading}
                className="font-mono text-[9px] text-slate-500 transition hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Resend code
              </button>
              <button type="button" onClick={onClose} className="font-mono text-[9px] text-slate-500 transition hover:text-slate-300">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-emerald-500/30 bg-emerald-500/[0.1] text-emerald-400">
              <Check className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">{result?.title ?? "Verified"}</h3>
            <p className="mx-auto mt-2 max-w-[260px] text-[11px] leading-5 text-slate-500">{result?.text}</p>
            <button
              type="button"
              onClick={onDone}
              className="mt-5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[11px] font-semibold text-slate-200 transition hover:bg-white/[0.08]"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
