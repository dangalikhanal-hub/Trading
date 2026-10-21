import { auth } from "next-auth";
import DashboardHeader from "@/app/dashboard/header";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect("/auth/login");
  }
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <DashboardHeader />
      <main className="p-4">{children}</main>
    </div>
  );
}
