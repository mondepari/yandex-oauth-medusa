"use client"

import { sdk } from "@lib/config"

export default function YandexLogin() {
  const onClick = async () => {
    let callback_url = ""
    if (typeof window !== "undefined") {
      const origin = window.location.origin
      const parts = window.location.pathname.split("/").filter(Boolean)
      const country = parts[0] || "ru"
      callback_url = `${origin}/auth/yandex/callback`
    }
    const result = await sdk.auth.login("customer", "yandex", { callback_url })
    if (typeof result === "object" && (result as any).location) {
      window.location.href = (result as any).location as string
      return
    }
    if (typeof result === "string") {
      try {
        const { customer } = await sdk.store.customer.retrieve()
        if (customer?.email) {
          window.location.href = "/"
        }
      } catch (e) {
        // ignore transient unauthorized
      }
    }
  }

  return (
    <button className="w-full border border-gray-300 px-4 py-2" onClick={onClick}>
      Войти через Yandex
    </button>
  )
}
