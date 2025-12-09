import { AbstractAuthModuleProvider } from "@medusajs/framework/utils"
import type {
  AuthIdentityProviderService,
  AuthenticationInput,
  AuthenticationResponse,
  Logger,
} from "@medusajs/framework/types"
import crypto from "crypto"

type InjectedDependencies = {
  logger: Logger
}

type Options = {
  clientId: string
  clientSecret: string
  callbackUrl: string
}

class YandexAuthProviderService extends AbstractAuthModuleProvider {
  static identifier = "yandex"
  static DISPLAY_NAME = "Yandex"

  protected logger_: Logger
  protected options_: Options

  constructor({ logger }: InjectedDependencies, options: Options) {
    super()
    this.logger_ = logger
    this.options_ = options
  }

  static validateOptions(options: Options) {
    if (!options.clientId) throw new Error("Yandex clientId is required")
    if (!options.clientSecret) throw new Error("Yandex clientSecret is required")
    if (!options.callbackUrl) throw new Error("Yandex callbackUrl is required")
  }

  async authenticate(
    data: AuthenticationInput,
    authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const query: Record<string, string> = (data.query || {}) as any
    const body: Record<string, string> = (data.body || {}) as any
    if (query.error) {
      return { success: false, error: query.error }
    }
    const stateKey = crypto.randomBytes(16).toString("hex")
    const callback_url = body?.callback_url || this.options_.callbackUrl
    await authIdentityProviderService.setState(stateKey, { callback_url })
    this.logger_.info(
      JSON.stringify({
        provider: "yandex",
        step: "authenticate",
        stateKey,
        callback_url,
        client_id: this.options_.clientId,
      })
    )
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.options_.clientId,
      redirect_uri: callback_url,
      scope: "login:email",
      state: stateKey,
    })
    const authUrl = `https://oauth.yandex.ru/authorize?${params.toString()}`
    return { success: true, location: authUrl }
  }

  async validateCallback(
    data: AuthenticationInput,
    authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const query: Record<string, string> = (data.query || {}) as any
    const body: Record<string, string> = (data.body || {}) as any
    if (query.error) {
      return { success: false, error: query.error }
    }
    const code = query?.code || body?.code
    if (!code) {
      return { success: false, error: "Code is required" }
    }
    const stateKey = query?.state as string
    const state = await authIdentityProviderService.getState(stateKey)
    this.logger_.info(
      JSON.stringify({
        provider: "yandex",
        step: "validate_callback_start",
        stateKey,
        has_state: !!state,
        code_present: !!code,
      })
    )
    if (!state) {
      return { success: false, error: "State missing or expired" }
    }

    const tokenRes = await fetch("https://oauth.yandex.ru/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: this.options_.clientId,
        client_secret: this.options_.clientSecret,
        redirect_uri: (state as any).callback_url,
      }),
    })
    if (!tokenRes.ok) {
      let detail = ""
      try {
        detail = await tokenRes.text()
      } catch {}
      this.logger_.warn(
        JSON.stringify({
          provider: "yandex",
          step: "token_exchange_failed",
          status: (tokenRes as any).status,
          statusText: (tokenRes as any).statusText,
          redirect_uri: (state as any).callback_url,
          has_client_id: !!this.options_.clientId,
          error_body: detail?.slice(0, 500),
        })
      )
      return { success: false, error: "Token exchange failed" }
    }
    const tokenJson = await tokenRes.json()
    const accessToken = tokenJson.access_token as string | undefined
    const refreshToken = tokenJson.refresh_token as string | undefined
    this.logger_.info(
      JSON.stringify({
        provider: "yandex",
        step: "token_exchange",
        ok: tokenRes.ok,
        status: (tokenRes as any).status,
        has_access_token: !!accessToken,
        has_refresh_token: !!refreshToken,
        token_type: tokenJson.token_type,
        expires_in: tokenJson.expires_in,
        scope: tokenJson.scope,
      })
    )
    if (!accessToken) {
      return { success: false, error: "No access token" }
    }

    const infoRes = await fetch("https://login.yandex.ru/info?format=json", {
      headers: { Authorization: `OAuth ${accessToken}` },
    })
    if (!infoRes.ok) {
      return { success: false, error: "User info request failed" }
    }
    const infoJson = (await infoRes.json()) as Record<string, any>
    this.logger_.info(
      JSON.stringify({
        provider: "yandex",
        step: "user_info",
        ok: infoRes.ok,
        status: (infoRes as any).status,
        uid: infoJson.uid || infoJson.id,
        login: infoJson.login,
        default_email: infoJson.default_email,
        emails_count: Array.isArray(infoJson.emails) ? infoJson.emails.length : 0,
        display_name: infoJson.display_name,
        avatar_id: infoJson.default_avatar_id || infoJson.avatar_id,
        psuid: infoJson.psuid,
      })
    )
    const email = (infoJson.default_email || (infoJson.emails && infoJson.emails[0])) as
      | string
      | undefined
    const entityId = (infoJson.uid || infoJson.id) as string | undefined
    if (!entityId) {
      return { success: false, error: "Identity not found" }
    }

    let authIdentity
    try {
      authIdentity = await authIdentityProviderService.retrieve({
        entity_id: entityId,
      })
      try {
        authIdentity = await authIdentityProviderService.update(entityId, {
          user_metadata: {
            email,
            name: infoJson.real_name || infoJson.name || infoJson.display_name,
            avatar_id: infoJson.default_avatar_id || infoJson.avatar_id,
            psuid: infoJson.psuid,
            uid: infoJson.uid || infoJson.id,
            login: infoJson.login,
          },
        })
      } catch (e) {
        this.logger_.warn(
          JSON.stringify({
            provider: "yandex",
            step: "identity_update_failed",
            entity_id: entityId,
            error: (e as any)?.message,
          })
        )
      }
    } catch {
      authIdentity = await authIdentityProviderService.create({
        entity_id: entityId,
        user_metadata: {
          email,
          name: infoJson.real_name || infoJson.name || infoJson.display_name,
          avatar_id: infoJson.default_avatar_id || infoJson.avatar_id,
          psuid: infoJson.psuid,
          uid: infoJson.uid || infoJson.id,
          login: infoJson.login,
        },
      })
    }

    try {
      const um = (authIdentity as any)?.user_metadata || {}
      if (!um.email && email) {
        (authIdentity as any).user_metadata = { ...um, email }
      }
      this.logger_.info(
        JSON.stringify({
          provider: "yandex",
          step: "identity_ready",
          entity_id: entityId,
          has_email: !!(authIdentity as any)?.user_metadata?.email,
        })
      )
    } catch {}

    return {
      success: true,
      authIdentity,
    }
  }
}

export default YandexAuthProviderService
