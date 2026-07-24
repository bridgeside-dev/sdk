import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { BridgesideClient } from "../client.js"
import type { MicroVMDetails, MicroVMCreateRequest } from "../types.js"

function mockMicroVM(overrides: Partial<MicroVMDetails> = {}): MicroVMDetails {
  return {
    id: "mvm-test123",
    state: "RUNNING",
    createdAt: "2026-01-01T00:00:00Z",
    resources: { cpu: 1, memoryMB: 2048, timeoutMs: 300000 },
    ...overrides,
  }
}

const createRequest: MicroVMCreateRequest = {
  resources: { cpu: 1, memoryMB: 2048, timeoutMs: 300000 },
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

describe("MicroVMsClient", () => {
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
    it("returns immediately with RUNNING state", async () => {
      mockFetchSequence([{ body: mockMicroVM({ state: "RUNNING" }) }])

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      const result = await client.microvms.create(createRequest)
      expect(result.state).toBe("RUNNING")
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("returns COMPLETE state when microVM completes", async () => {
      mockFetchSequence([{ body: mockMicroVM({ state: "COMPLETE" }) }])

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      const result = await client.microvms.create(createRequest)
      expect(result.state).toBe("COMPLETE")
    })

    it("returns FAILED state when microVM fails", async () => {
      mockFetchSequence([{ body: mockMicroVM({ state: "FAILED" }) }])

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      const result = await client.microvms.create(createRequest)
      expect(result.state).toBe("FAILED")
    })
  })

  describe("list", () => {
    it("fetches microvms without filter", async () => {
      const microvms = [mockMicroVM(), mockMicroVM({ id: "mvm-456" })]
      mockFetchSequence([{ body: { data: microvms } }])

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      const result = await client.microvms.list()
      expect(result).toHaveLength(2)
    })

    it("passes state query parameter", async () => {
      mockFetchSequence([{ body: { data: [mockMicroVM({ state: "RUNNING" })] } }])

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      await client.microvms.list("RUNNING")

      const url = fetchMock.mock.calls[0][0] as string
      expect(url).toContain("state=RUNNING")
    })
  })

  describe("get", () => {
    it("fetches a single microvm", async () => {
      mockFetchSequence([{ body: mockMicroVM() }])

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      const result = await client.microvms.get("mvm-test123")
      expect(result.id).toBe("mvm-test123")

      const url = fetchMock.mock.calls[0][0] as string
      expect(url).toContain("/microvms/mvm-test123")
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
      await client.microvms.terminate("mvm-test123")

      const url = fetchMock.mock.calls[0][0] as string
      expect(url).toContain("/microvms/mvm-test123")
      expect(fetchMock.mock.calls[0][1].method).toBe("DELETE")
    })
  })
})
