"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  const handleLogin = () => {
    // Initiates Google OAuth flow; after successful sign‑in the user is sent to the dashboard
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
      <div className="w-full max-w-md space-y-6 rounded-xl bg-gray-800 p-8 shadow-lg">
        <h2 className="text-center text-2xl font-bold">Sign in to TradeVision Pro</h2>
        <button
          onClick={handleLogin}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-white py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
        >
          {/* Google logo */}
          <svg
            viewBox="0 0 533.5 544.3"
            className="h-5 w-5"
          >
            <path
              fill="#4285F4"
              d="M533.5 278.4c0-17.5-1.5-34.2-4.4-50.5H272v95.5h146.9c-6.4 34.4-25.6 63.5-54.5 83V447h88.1c51.6-47.5 80.9-117.5 80.9-200.6"
            />
            <path
              fill="#34A853"
              d="M272 544.3c73.4 0 135-24.5 180-66.5l-88.1-68c-24.4 16.4-55.8 26-91.9 26-70.8 0-130.7-47.7-152.2-111.7H30.1v70.2c45 89.5 139.6 149.9 241.9 149.9"
            />
            <path
              fill="#FBBC05"
              d="M119.8 324.1c-10-30-10-62.2 0-92.2V161.7H30.1c-39 77.2-39 168.8 0 246l89.7-73.6"
            />
            <path
              fill="#EA4335"
              d="M272 107.7c39.9-.6 78.5 15.1 106.9 43.4l80-80C416.9 23.5 345.5 0 272 0 169.7 0 75.1 60.4 30.1 149.9l89.7 70.2C141.3 155.5 201.2 107.7 272 107.7"
            />
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}
