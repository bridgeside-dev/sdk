import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { BridgesideClient } from "../client.js"
import { SandboxProvisioningError, NotFoundError } from "../errors.js"
import type { SandboxDetails, SandboxCreateRequest } from "../types.js"

function mockSandbox(overrides: Partial<SandboxDetails> = {}): SandboxDetails {
  return {
    sandboxId: "sbx-test123",
    state: "PROVISIONING",
    createdAt: "2026-01-01T00:00:00Z",
    resources: { cpu: 1, memoryMB: 2048 },
    workloadType: "opencode-agent",
    ...overrides,
  }
}

const createRequest: SandboxCreateRequest = {
  resources: { cpu: 1, memoryMB: 2048 },
  workload: { type: "opencode-agent", config: { model: "test" } },
}

describe("BridgesideClient", () => {
  it("throws if apiKey is missing", () => {
    expect(() => new BridgesideClient({ apiKey: "", apiSecret: "s" })).toThrow(
      "apiKey is required",
    )
  })

  it("throws if apiSecret is missing", () => {
    expect(() => new BridgesideClient({ apiKey: "k", apiSecret: "" })).toThrow(
      "apiSecret is required",
    )
  })
})

describe("SandboxesClient", () => {
  const OriginalFetch = globalThis.fetch
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as typeof fetch
  })

  afterEach(() => {
    vi.useRealTimers()
    globalThis.fetch = OriginalFetch
  })

  function mockFetchSequence(
    responses: Array<{ body: unknown; init?: ResponseInit }>,
  ) {
    let callIndex = 0
    fetchMock.mockImplementation(async () => {
      const { body, init } = responses[callIndex++] ?? {
        body: { message: "unexpected call" },
        init: { status: 500 },
      }
      const status = init?.status ?? 200
      if (status === 204 || body === null) {
        return new Response(null, {
          status,
          headers: { "Content-Type": "application/json" },
          ...init,
        })
      }
      return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
        ...init,
      })
    })
  }

  describe("create", () => {
    it("returns immediately when wait is not set", async () => {
      mockFetchSequence([{ body: mockSandbox({ state: "PROVISIONING" }) }])

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      const result = await client.sandboxes.create(createRequest)
      expect(result.state).toBe("PROVISIONING")
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("polls until RUNNING when wait=true", async () => {
      mockFetchSequence([
        { body: mockSandbox({ state: "PROVISIONING" }) },
        { body: mockSandbox({ state: "PROVISIONING" }) },
        { body: mockSandbox({ state: "RUNNING" }) },
      ])

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })

      const promise = client.sandboxes.create(createRequest, { wait: true })

      // Advance past the poll intervals
      await vi.advanceTimersByTimeAsync(1_000)
      await vi.advanceTimersByTimeAsync(2_000)

      const result = await promise
      expect(result.state).toBe("RUNNING")
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it("throws SandboxProvisioningError if sandbox TERMINATES during wait", async () => {
      mockFetchSequence([
        { body: mockSandbox({ state: "PROVISIONING" }) },
        { body: mockSandbox({ state: "TERMINATED" }) },
      ])

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })

      const promise = client.sandboxes.create(createRequest, { wait: true })
      const assertion = expect(promise).rejects.toThrow(SandboxProvisioningError)
      await vi.advanceTimersByTimeAsync(1_000)
      await assertion
    })

    it("throws SandboxProvisioningError on timeout", async () => {
      mockFetchSequence(
        Array(100).fill({ body: mockSandbox({ state: "PROVISIONING" }) }),
      )

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })

      const promise = client.sandboxes.create(createRequest, {
        wait: true,
        timeoutMs: 500,
      })

      const assertion = expect(promise).rejects.toThrow(SandboxProvisioningError)
      await vi.advanceTimersByTimeAsync(10_000)
      await assertion
    })

    it("throws NotFoundError if sandbox disappears during polling", async () => {
      mockFetchSequence([
        { body: mockSandbox({ state: "PROVISIONING" }) },
        { body: { message: "not found" }, init: { status: 404 } },
      ])

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })

      const promise = client.sandboxes.create(createRequest, { wait: true })
      const assertion = expect(promise).rejects.toThrow(NotFoundError)
      await vi.advanceTimersByTimeAsync(1_000)
      await assertion
    })
  })

  describe("list", () => {
    it("fetches sandboxes without filter", async () => {
      const sandboxes = [mockSandbox(), mockSandbox({ sandboxId: "sbx-456" })]
      mockFetchSequence([{ body: sandboxes }])

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      const result = await client.sandboxes.list()
      expect(result).toHaveLength(2)
    })

    it("passes state query parameter", async () => {
      mockFetchSequence([{ body: [mockSandbox({ state: "RUNNING" })] }])

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      await client.sandboxes.list("RUNNING")

      const url = fetchMock.mock.calls[0][0] as string
      expect(url).toContain("state=RUNNING")
    })
  })

  describe("get", () => {
    it("fetches a single sandbox", async () => {
      mockFetchSequence([{ body: mockSandbox() }])

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      const result = await client.sandboxes.get("sbx-test123")
      expect(result.sandboxId).toBe("sbx-test123")

      const url = fetchMock.mock.calls[0][0] as string
      expect(url).toContain("/sandboxes/sbx-test123")
    })
  })

  describe("terminate", () => {
    it("sends DELETE and resolves", async () => {
      mockFetchSequence([{ body: null, init: { status: 204 } }])

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      await client.sandboxes.terminate("sbx-test123")

      const url = fetchMock.mock.calls[0][0] as string
      expect(url).toContain("/sandboxes/sbx-test123")
      expect(fetchMock.mock.calls[0][1].method).toBe("DELETE")
    })
  })
})
