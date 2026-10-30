import type { Metadata } from "next";
import AuthExperience from "@/components/auth/mtrade/AuthExperience";
import "@/components/auth/mtrade/auth.css";

export const metadata: Metadata = {
  title: "Sign in — MTrade",
  description: "Sign in to the MTrade institutional paper-trading terminal.",
};

export default function LoginPage() {
  return <AuthExperience key="signin" initialMode="signin" />;
}
