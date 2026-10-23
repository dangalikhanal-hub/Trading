import { auth } from "@/auth";
import DashboardHeader from "@/app/dashboard/header";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <DashboardHeader />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}