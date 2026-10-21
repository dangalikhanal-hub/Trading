"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function ResetWalletButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleReset = async () => {
    if (!window.confirm("Are you sure you want to reset demo balances to default values?")) return
    setLoading(true)
    try {
      const res = await fetch("/api/wallet/reset", { method: "POST" })
      if (!res.ok) throw new Error("Failed to reset wallets")
      // Refresh page to show updated balances
      router.refresh()
    } catch (e) {
      console.error(e)
      alert("Error resetting wallets")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleReset}
      disabled={loading}
      className="mt-2 w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-white disabled:opacity-50"
    >
      {loading ? "Resetting..." : "Reset Demo Balance"}
    </button>
  )
}
