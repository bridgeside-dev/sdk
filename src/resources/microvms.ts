import type { HttpRequester } from "../http.js"
import type {
  MicroVMCreateRequest,
  MicroVMCreateOptions,
  MicroVMDetails,
  MicroVMListState,
} from "../types.js"

export class MicroVMsClient {
  private readonly http: HttpRequester

  constructor(http: HttpRequester) {
    this.http = http
  }

  async create(
    request: MicroVMCreateRequest,
    _options?: MicroVMCreateOptions,
  ): Promise<MicroVMDetails> {
    return this.http.post<MicroVMDetails>(
      "/microvms",
      request,
    )
  }

  async list(state?: MicroVMListState): Promise<MicroVMDetails[]> {
    const path = state ? `/microvms?state=${encodeURIComponent(state)}` : "/microvms"
    return this.http.get<{ data: MicroVMDetails[] }>(path).then(r => r.data)
  }

  async get(microvmId: string): Promise<MicroVMDetails> {
    return this.http.get<MicroVMDetails>(`/microvms/${microvmId}`)
  }

  async terminate(microvmId: string): Promise<void> {
    await this.http.delete(`/microvms/${microvmId}`)
  }
}
