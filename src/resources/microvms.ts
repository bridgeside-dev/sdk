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
    options?: MicroVMCreateOptions,
  ): Promise<MicroVMDetails> {
    const body = options?.timeoutMs
      ? { resources: { timeoutMs: options.timeoutMs } }
      : request
    return this.http.post<MicroVMDetails>(
      "/v1/microvms",
      body,
    )
  }

  async list(state?: MicroVMListState): Promise<MicroVMDetails[]> {
    const path = state ? `/v1/microvms?state=${encodeURIComponent(state)}` : "/v1/microvms"
    return this.http.get<{ data: MicroVMDetails[] }>(path).then(r => r.data)
  }

  async get(microvmID: string): Promise<MicroVMDetails> {
    return this.http.get<MicroVMDetails>(`/v1/microvms/${microvmID}`)
  }

  async terminate(microvmID: string): Promise<void> {
    await this.http.delete(`/v1/microvms/${microvmID}`)
  }

  async writeFile(microvmID: string, path: string, content: BodyInit): Promise<void> {
    const encodedPath = encodeURIComponent(path)
    await this.http.putRaw(
      `/v1/microvms/${microvmID}/files?path=${encodedPath}`,
      content,
    )
  }

  async readFile(microvmID: string, path: string): Promise<ReadableStream<Uint8Array>> {
    const encodedPath = encodeURIComponent(path)
    return this.http.getStream(
      `/v1/microvms/${microvmID}/files?path=${encodedPath}`,
    )
  }

  async deleteFile(microvmID: string, path: string): Promise<void> {
    const encodedPath = encodeURIComponent(path)
    await this.http.delete(
      `/v1/microvms/${microvmID}/files?path=${encodedPath}`,
    )
  }
}
