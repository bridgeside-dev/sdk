import { HttpRequester } from "./http.js"
import { SandboxesClient } from "./resources/sandboxes.js"
import { DEFAULT_BASE_URL } from "./types.js"

export interface BridgesideClientOptions {
  apiKey: string
  apiSecret: string
  baseUrl?: string
}

export class BridgesideClient {
  private readonly http: HttpRequester
  private _sandboxes?: SandboxesClient

  constructor(options: BridgesideClientOptions) {
    if (!options.apiKey) {
      throw new Error("apiKey is required")
    }
    if (!options.apiSecret) {
      throw new Error("apiSecret is required")
    }
    this.http = new HttpRequester(
      options.baseUrl ?? DEFAULT_BASE_URL,
      options.apiKey,
      options.apiSecret,
    )
  }

  get sandboxes(): SandboxesClient {
    if (!this._sandboxes) {
      this._sandboxes = new SandboxesClient(this.http)
    }
    return this._sandboxes
  }
}
