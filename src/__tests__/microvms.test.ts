import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { BridgesideClient } from "../client.js"
import type { MicroVMDetails, MicroVMCreateRequest } from "../types.js"

function mockMicroVM(overrides: Partial<MicroVMDetails> = {}): MicroVMDetails {
  return {
    id: "mvm-test123",
    state: "RUNNING",
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

const createRequest: MicroVMCreateRequest = {
  resources: { timeoutMs: 300000 },
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

    it("uses options.timeoutMs over request.resources.timeoutMs", async () => {
      mockFetchSequence([{ body: mockMicroVM() }])

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      await client.microvms.create(
        { resources: { timeoutMs: 300000 } },
        { timeoutMs: 600000 },
      )

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.resources.timeoutMs).toBe(600000)
    })

    it("sends request body when no options provided", async () => {
      mockFetchSequence([{ body: mockMicroVM() }])

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      await client.microvms.create({ resources: { timeoutMs: 300000 } })

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.resources.timeoutMs).toBe(300000)
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

    it("includes terminatedAt and reason when present", async () => {
      const microvms = [
        mockMicroVM({ id: "mvm-1", state: "COMPLETE", terminatedAt: "2026-01-01T01:00:00Z", reason: "TIMEOUT" }),
        mockMicroVM({ id: "mvm-2", state: "RUNNING" }),
      ]
      mockFetchSequence([{ body: { data: microvms } }])

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      const result = await client.microvms.list()
      expect(result[0].terminatedAt).toBe("2026-01-01T01:00:00Z")
      expect(result[0].reason).toBe("TIMEOUT")
      expect(result[1].terminatedAt).toBeUndefined()
      expect(result[1].reason).toBeUndefined()
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
      expect(url).toContain("/v1/microvms/mvm-test123")
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
      expect(url).toContain("/v1/microvms/mvm-test123")
      expect(fetchMock.mock.calls[0][1].method).toBe("DELETE")
    })
  })

  describe("writeFile", () => {
    it("sends PUT with encoded path and raw content", async () => {
      mockFetchSequence([{ body: null, init: { status: 204 } }])

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      await client.microvms.writeFile("mvm-123", "/workspace/myfile.txt", "Hello, World!")

      const url = fetchMock.mock.calls[0][0] as string
      expect(url).toContain("/v1/microvms/mvm-123/files")
      expect(url).toContain("path=%2Fworkspace%2Fmyfile.txt")
      expect(fetchMock.mock.calls[0][1].method).toBe("PUT")
      expect(fetchMock.mock.calls[0][1].body).toBe("Hello, World!")
    })

    it("encodes special characters in path", async () => {
      mockFetchSequence([{ body: null, init: { status: 204 } }])

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      await client.microvms.writeFile("mvm-123", "/workspace/my file.txt", "data")

      const url = fetchMock.mock.calls[0][0] as string
      expect(url).toContain("path=%2Fworkspace%2Fmy%20file.txt")
    })

    it("propagates error from controlplane", async () => {
      mockFetchSequence([{ body: { message: "MicroVM not found" }, init: { status: 404 } }])

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      await expect(
        client.microvms.writeFile("mvm-missing", "/workspace/x.txt", "data"),
      ).rejects.toThrow("MicroVM not found")
    })
  })

  describe("readFile", () => {
    it("sends GET and returns stream", async () => {
      mockFetchSequence([{ body: "file content", init: { status: 200 } }])

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      const stream = await client.microvms.readFile("mvm-123", "/workspace/myfile.txt")

      const url = fetchMock.mock.calls[0][0] as string
      expect(url).toContain("/v1/microvms/mvm-123/files")
      expect(url).toContain("path=%2Fworkspace%2Fmyfile.txt")
      expect(fetchMock.mock.calls[0][1].method).toBe("GET")
      expect(stream).toBeDefined()
    })
  })

  describe("deleteFile", () => {
    it("sends DELETE with encoded path", async () => {
      mockFetchSequence([{ body: null, init: { status: 204 } }])

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      await client.microvms.deleteFile("mvm-123", "/workspace/myfile.txt")

      const url = fetchMock.mock.calls[0][0] as string
      expect(url).toContain("/v1/microvms/mvm-123/files")
      expect(url).toContain("path=%2Fworkspace%2Fmyfile.txt")
      expect(fetchMock.mock.calls[0][1].method).toBe("DELETE")
    })
  })

  describe("exec", () => {
    it("posts the command and streams stdout/stderr to writers", async () => {
      const stdoutChunks: string[] = []
      const stderrChunks: string[] = []
      let exitCode: number | undefined

      fetchMock.mockImplementation(async (url) => {
        if (String(url).includes("/stream")) {
          const events = [
            `data: ${JSON.stringify({ type: "output", stream: "stdout", base64Content: btoa("hello") })}`,
            `data: ${JSON.stringify({ type: "output", stream: "stderr", base64Content: btoa("oops") })}`,
            `data: ${JSON.stringify({ type: "exit", code: 0 })}`,
          ].join("\n\n") + "\n\n"
          return new Response(events, {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          })
        }
        return new Response(JSON.stringify({ execId: "exec-1" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        })
      })

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      client.microvms.exec("mvm-1", {
        command: "echo hi",
        user: "alice",
        cwd: "/workspace",
        stdout: {
          write: (chunk) => stdoutChunks.push(new TextDecoder().decode(chunk)),
        },
        stderr: {
          write: (chunk) => stderrChunks.push(new TextDecoder().decode(chunk)),
        },
        onExit: (code) => {
          exitCode = code
        },
      })

      await vi.waitFor(() => expect(exitCode).toBe(0))
      expect(stdoutChunks).toEqual(["hello"])
      expect(stderrChunks).toEqual(["oops"])

      const postBody = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(postBody).toEqual({ command: "echo hi", user: "alice", cwd: "/workspace" })
      expect(String(fetchMock.mock.calls[0][0])).toContain("/v1/microvms/mvm-1/exec")
      expect(String(fetchMock.mock.calls[1][0])).toContain(
        "/v1/microvms/mvm-1/exec/exec-1/stream",
      )
    })

    it("defaults user and cwd", async () => {
      let exitCode: number | undefined

      fetchMock.mockImplementation(async (url) => {
        if (String(url).includes("/stream")) {
          return new Response(
            `data: ${JSON.stringify({ type: "exit", code: 0 })}\n\n`,
            { status: 200 },
          )
        }
        return new Response(JSON.stringify({ execId: "exec-2" }), { status: 201 })
      })

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      client.microvms.exec("mvm-1", {
        command: "ls",
        onExit: (code) => {
          exitCode = code
        },
      })

      await vi.waitFor(() => expect(exitCode).toBe(0))
      const postBody = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(postBody).toEqual({ command: "ls", user: "root", cwd: "/" })
    })

    it("buffers events split across stream chunks", async () => {
      const stdoutChunks: string[] = []
      let exitCode: number | undefined

      fetchMock.mockImplementation(async (url) => {
        if (String(url).includes("/stream")) {
          const full =
            `data: ${JSON.stringify({ type: "output", stream: "stdout", base64Content: btoa("partial") })}` +
            "\n\n" +
            `data: ${JSON.stringify({ type: "exit", code: 0 })}` +
            "\n\n"
          const encoded = new TextEncoder().encode(full)
          const half = Math.ceil(encoded.length / 2)
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(encoded.slice(0, half))
              controller.enqueue(encoded.slice(half))
              controller.close()
            },
          })
          return new Response(stream as unknown as BodyInit, { status: 200 })
        }
        return new Response(JSON.stringify({ execId: "exec-3" }), { status: 201 })
      })

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      client.microvms.exec("mvm-1", {
        command: "cat /tmp/prompt.txt",
        stdout: {
          write: (chunk) => stdoutChunks.push(new TextDecoder().decode(chunk)),
        },
        onExit: (code) => {
          exitCode = code
        },
      })

      await vi.waitFor(() => expect(exitCode).toBe(0))
      expect(stdoutChunks).toEqual(["partial"])
    })

    it("calls onError when the exec POST fails", async () => {
      const errors: Error[] = []

      fetchMock.mockImplementation(async () => {
        return new Response(JSON.stringify({ message: "MicroVM not found" }), {
          status: 404,
        })
      })

      const client = new BridgesideClient({
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "http://localhost",
      })
      client.microvms.exec("mvm-missing", {
        command: "ls",
        onError: (err) => errors.push(err),
      })

      await vi.waitFor(() => expect(errors).toHaveLength(1))
      expect(errors[0].message).toBe("MicroVM not found")
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })
})
