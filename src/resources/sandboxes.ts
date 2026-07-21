import type { HttpRequester } from "../http.js"
import type {
  SandboxCreateRequest,
  SandboxCreateOptions,
  SandboxDetails,
  SandboxListState,
} from "../types.js"
import {
  DEFAULT_WAIT_TIMEOUT_MS,
  POLL_INITIAL_INTERVAL_MS,
  POLL_MAX_INTERVAL_MS,
} from "../types.js"
import { SandboxProvisioningError } from "../errors.js"

export class SandboxesClient {
  private readonly http: HttpRequester

  constructor(http: HttpRequester) {
    this.http = http
  }

  async create(
    request: SandboxCreateRequest,
    options?: SandboxCreateOptions,
  ): Promise<SandboxDetails> {
    const details = await this.http.post<SandboxDetails>(
      "/sandboxes",
      request,
    )

    if (!options?.wait) {
      return details
    }

    return this.waitForRunning(
      details.sandboxId,
      options.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS,
    )
  }

  async list(state?: SandboxListState): Promise<SandboxDetails[]> {
    const path = state ? `/sandboxes?state=${encodeURIComponent(state)}` : "/sandboxes"
    return this.http.get<SandboxDetails[]>(path)
  }

  async get(sandboxId: string): Promise<SandboxDetails> {
    return this.http.get<SandboxDetails>(`/sandboxes/${sandboxId}`)
  }

  async terminate(sandboxId: string): Promise<void> {
    await this.http.delete(`/sandboxes/${sandboxId}`)
  }

  private async waitForRunning(
    sandboxId: string,
    timeoutMs: number,
  ): Promise<SandboxDetails> {
    const deadline = Date.now() + timeoutMs
    let interval = POLL_INITIAL_INTERVAL_MS

    while (true) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) {
        throw new SandboxProvisioningError(
          `Sandbox ${sandboxId} provisioning timed out after ${timeoutMs}ms`,
        )
      }

      const details = await this.get(sandboxId)

      if (details.state === "RUNNING") {
        return details
      }

      if (
        details.state === "TERMINATED" ||
        details.state === "SUSPENDED"
      ) {
        throw new SandboxProvisioningError(
          `Sandbox ${sandboxId} entered unexpected state "${details.state}" during provisioning`,
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
