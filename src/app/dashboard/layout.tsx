import { auth } from "@/auth";
import DashboardHeader from "@/app/dashboard/header";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-4" role="status">Loading dashboard...</div>}>
      <AuthenticatedDashboard>{children}</AuthenticatedDashboard>
    </Suspense>
  );
}

async function AuthenticatedDashboard({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth.js uses cryptographic randomness; run it only after a request arrives.
  await connection();
  const session = await auth();

  if (!session) {
    redirect("/auth/login");
  }

  const role = (session.user as typeof session.user & { role?: string }).role;

  return (
    <div className="tv-shell">
      <DashboardHeader role={role} />
      <main>
        {children}
      </main>
    </div>
  );
}
