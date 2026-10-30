import type { Metadata } from "next";
import AuthExperience from "@/components/auth/mtrade/AuthExperience";
import "@/components/auth/mtrade/auth.css";

export const metadata: Metadata = {
  title: "Open an account — MTrade",
  description: "Request access to the MTrade institutional paper-trading terminal.",
};

export default function RegisterPage() {
  return <AuthExperience key="register" initialMode="register" />;
}
