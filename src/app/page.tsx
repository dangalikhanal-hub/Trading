import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <h1 className="text-4xl font-bold mb-6 text-black dark:text-white">MTrade Dashboard</h1>
      <Link href="/auth/login" className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium">
        Go to Login
      </Link>
    </div>
  );
}