import { getServerSession } from "next-auth/next";
import DashboardHeader from "@/app/dashboard/header";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. Fetch the user session using the correct method for your NextAuth version
  const session = await getServerSession();

  // 2. Protect the dashboard route by redirecting unauthenticated users
  if (!session) {
    redirect("/auth/login");
  }

  // 3. Render the dashboard layout
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <DashboardHeader />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}