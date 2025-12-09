//backend /src/api/store/middleware/log-auth.ts
import type { MedusaRequest, MedusaResponse, NextFunction } from "@medusajs/framework/http"

function decodePayload(token: string): any {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const json = Buffer.from(payload, "base64").toString("utf-8")
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function logAuthMiddleware(req: MedusaRequest, _res: MedusaResponse, next: NextFunction) {
  const auth = req.headers["authorization"] || ""
  const bearer = Array.isArray(auth) ? auth[0] : auth
  const token = typeof bearer === "string" && bearer.startsWith("Bearer ") ? bearer.slice(7) : ""
  const decoded = token ? decodePayload(token) : null
  const logger = (req as any).scope?.resolve?.("logger") || console
  logger.info(
    JSON.stringify({
      route: req.originalUrl || req.url,
      step: "store_request_auth",
      has_authorization: !!bearer,
      has_bearer_token: !!token,
      token_prefix: token ? token.slice(0, 16) : "",
      decoded_actor_id: decoded?.actor_id ?? "",
      decoded_provider: decoded?.provider ?? "",
      decoded_user_email: decoded?.user_metadata?.email ?? "",
      decoded_app_email: decoded?.app_metadata?.email ?? "",
    })
  )
  next()
}
