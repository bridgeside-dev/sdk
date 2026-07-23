import type { HttpRequester } from "../http.js"
import type {
  MicroVMCreateRequest,
  MicroVMCreateOptions,
  MicroVMDetails,
  MicroVMListState,
} from "../types.js"
import {
  DEFAULT_WAIT_TIMEOUT_MS,
  POLL_INITIAL_INTERVAL_MS,
  POLL_MAX_INTERVAL_MS,
} from "../types.js"
import { MicroVMProvisioningError } from "../errors.js"

export class MicroVMsClient {
  private readonly http: HttpRequester

  constructor(http: HttpRequester) {
    this.http = http
  }

  async create(
    request: MicroVMCreateRequest,
    options?: MicroVMCreateOptions,
  ): Promise<MicroVMDetails> {
    const details = await this.http.post<MicroVMDetails>(
      "/microvms",
      request,
    )

    if (!options?.wait) {
      return details
    }

    return this.waitForRunning(
      details.id,
      options.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS,
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

  private async waitForRunning(
    microvmId: string,
    timeoutMs: number,
  ): Promise<MicroVMDetails> {
    const deadline = Date.now() + timeoutMs
    let interval = POLL_INITIAL_INTERVAL_MS

    while (true) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) {
        throw new MicroVMProvisioningError(
          `MicroVM ${microvmId} provisioning timed out after ${timeoutMs}ms`,
        )
      }

      const details = await this.get(microvmId)

      if (details.state === "RUNNING") {
        return details
      }

      if (
        details.state === "TERMINATED" ||
        details.state === "SUSPENDED"
      ) {
        throw new MicroVMProvisioningError(
          `MicroVM ${microvmId} entered unexpected state "${details.state}" during provisioning`,
        )
      }

      await sleep(Math.min(interval, remaining))
      interval = Math.min(interval * 2, POLL_MAX_INTERVAL_MS)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
