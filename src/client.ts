import { HttpRequester } from "./http.js"
import { MicroVMsClient } from "./resources/microvms.js"
import { DEFAULT_BASE_URL } from "./types.js"

export interface BridgesideClientOptions {
  apiKey: string
  apiSecret: string
  baseUrl?: string
}

export class BridgesideClient {
  private readonly http: HttpRequester
  private _microvms?: MicroVMsClient

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

  get microvms(): MicroVMsClient {
    if (!this._microvms) {
      this._microvms = new MicroVMsClient(this.http)
    }
    return this._microvms
  }
}
