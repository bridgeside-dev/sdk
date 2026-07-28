import { HttpRequester, AuthMode } from "./http.js"
import { MicroVMsClient } from "./resources/microvms.js"
import { CredentialsClient } from "./resources/credentials.js"
import { DEFAULT_BASE_URL } from "./types.js"

export interface BridgesideClientOptions {
  apiKey?: string
  apiSecret?: string
  authMode?: AuthMode
  bearerToken?: string
  baseUrl?: string
}

export class BridgesideClient {
  private readonly http: HttpRequester
  private _microvms?: MicroVMsClient
  private _credentials?: CredentialsClient

  constructor(options: BridgesideClientOptions) {
    const mode = options.authMode ?? "api-key"

    if (mode === "api-key") {
      if (!options.apiKey) {
        throw new Error("apiKey is required")
      }
      if (!options.apiSecret) {
        throw new Error("apiSecret is required")
      }
      this.http = new HttpRequester(
        options.baseUrl ?? DEFAULT_BASE_URL,
        "api-key",
        options.apiKey,
        options.apiSecret,
      )
    } else {
      if (!options.bearerToken) {
        throw new Error("bearerToken is required when authMode is 'bearer'")
      }
      this.http = new HttpRequester(
        options.baseUrl ?? DEFAULT_BASE_URL,
        "bearer",
        options.bearerToken,
      )
    }
  }

  get microvms(): MicroVMsClient {
    if (!this._microvms) {
      this._microvms = new MicroVMsClient(this.http)
    }
    return this._microvms
  }

  get credentials(): CredentialsClient {
    if (!this._credentials) {
      this._credentials = new CredentialsClient(this.http)
    }
    return this._credentials
  }
}
