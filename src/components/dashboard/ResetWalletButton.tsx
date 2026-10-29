"use client"

import { useState } from "react"

export default function ResetWalletButton({ onReset }: { onReset: () => Promise<void> }) {
  const [loading, setLoading] = useState(false)

  const handleReset = async () => {
    if (!window.confirm("Are you sure you want to reset demo balances to default values?")) return
    setLoading(true)
    try {
      const res = await fetch("/api/wallet/reset", { method: "POST" })
      if (!res.ok) throw new Error("Failed to reset wallets")
      await onReset()
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
      className="tv-button tv-reset"
    >
      {loading ? "Resetting..." : "Reset Demo Balance"}
    </button>
  )
}
