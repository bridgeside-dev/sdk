import {
  BridgesideError,
  AuthenticationError,
  BadRequestError,
  NotFoundError,
  PaymentRequiredError,
  RateLimitError,
  APIError,
} from "./errors.js"

export type AuthMode = "api-key" | "bearer"

export class HttpRequester {
  private readonly baseUrl: string
  private readonly authMode: AuthMode
  private readonly apiKey?: string
  private readonly apiSecret?: string
  private readonly bearerToken?: string

  constructor(
    baseUrl: string,
    authMode: AuthMode,
    apiKeyOrToken: string,
    apiSecret?: string,
  ) {
    if (authMode === "api-key") {
      if (!apiKeyOrToken) {
        throw new Error("apiKey is required")
      }
      if (!apiSecret) {
        throw new Error("apiSecret is required")
      }
      this.apiKey = apiKeyOrToken
      this.apiSecret = apiSecret
    } else {
      if (!apiKeyOrToken) {
        throw new Error("bearerToken is required")
      }
      this.bearerToken = apiKeyOrToken
    }
    this.baseUrl = baseUrl.replace(/\/$/, "")
    this.authMode = authMode
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path)
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body)
  }

  async delete(path: string): Promise<void> {
    await this.request<void>("DELETE", path)
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      Accept: "application/json",
    }

    if (this.authMode === "api-key") {
      headers["X-API-Key"] = this.apiKey!
      headers["X-API-Secret"] = this.apiSecret!
    } else {
      headers["Authorization"] = `Bearer ${this.bearerToken}`
    }

    const init: RequestInit = { method, headers }
    if (body !== undefined) {
      headers["Content-Type"] = "application/json"
      init.body = JSON.stringify(body)
    }

    let response: Response
    try {
      response = await fetch(url, init)
    } catch (err) {
      throw new Error(`Network error: ${err}`)
    }

    if (response.ok) {
      if (response.status === 204) {
        return undefined as T
      }
      return (await response.json()) as T
    }

    const message = await this.parseErrorMessage(response)
    throw this.createError(response.status, message, response)
  }

  private async parseErrorMessage(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { message?: string }
      return body.message ?? response.statusText
    } catch {
      return response.statusText
    }
  }

  private createError(
    status: number,
    message: string,
    response: Response,
  ): BridgesideError {
    switch (status) {
      case 400:
        return new BadRequestError(message)
      case 401:
        return new AuthenticationError(message)
      case 402:
        return new PaymentRequiredError(message)
      case 404:
        return new NotFoundError(message)
      case 429: {
        const retryAfter = response.headers.get("Retry-After")
        return new RateLimitError(
          message,
          retryAfter ? Number(retryAfter) : undefined,
        )
      }
      default:
        return new APIError(message, status)
    }
  }
}
