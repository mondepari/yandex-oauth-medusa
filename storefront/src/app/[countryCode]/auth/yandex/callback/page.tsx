"use client"

import { useEffect, useState } from "react"
import { sdk } from "@lib/config"
import { decodeToken } from "react-jwt"

export default function YandexCallbackLocalized() {
  const [loading, setLoading] = useState(true)
  const [customerEmail, setCustomerEmail] = useState<string>("")
  const [errorMessage, setErrorMessage] = useState<string>("")

  const sendCallback = async () => {
    try {
      const qp = typeof window !== "undefined" ? Object.fromEntries(new URLSearchParams(window.location.search).entries()) : {}
      const token = await sdk.auth.callback("customer", "yandex", qp)
      return token
    } catch (e: any) {
      setErrorMessage(e?.message || "Authentication Failed")
      throw e
    }
  }

  const createCustomer = async (email: string) => {
    try {
      await sdk.store.customer.create({ email })
    } catch (e: any) {
      setErrorMessage(e?.message || "Customer creation failed")
      throw e
    }
  }

  const refreshToken = async () => {
    try {
      await sdk.auth.refresh()
    } catch (e: any) {
      setErrorMessage(e?.message || "Token refresh failed")
      throw e
    }
  }

  const validate = async () => {
    const token = await sendCallback()
    const decoded = decodeToken(token) as { actor_id?: string; user_metadata?: Record<string, any>; app_metadata?: Record<string, any> }
    if (process.env.NODE_ENV === "development") {
      console.log("decoded token", decoded)
    }
    const shouldCreate = !decoded?.actor_id
    if (shouldCreate) {
      const email = (decoded?.user_metadata?.email || "") as string
      if (email) {
        await createCustomer(email)
        await refreshToken()
      }
    }
    try {
      const { customer } = await sdk.store.customer.retrieve()
      setCustomerEmail(customer?.email || "")
    } catch (e: any) {
      setErrorMessage(e?.message || "Unauthorized")
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!loading) return
    validate()
  }, [loading])

  useEffect(() => {
    if (!customerEmail) return
    window.location.href = "/"
  }, [customerEmail])

  return <div>{loading ? "Loading..." : errorMessage ? errorMessage : ""}</div>
}
