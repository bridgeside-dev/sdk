import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { HttpRequester } from "../http.js"
import {
  AuthenticationError,
  BadRequestError,
  NotFoundError,
  PaymentRequiredError,
  RateLimitError,
  APIError,
} from "../errors.js"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function textResponse(status: number, statusText: string): Response {
  return new Response(null, { status, statusText })
}

describe("HttpRequester", () => {
  const OriginalFetch = globalThis.fetch

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    globalThis.fetch = OriginalFetch
  })

  function mockFetch(handler: (url: string, init: RequestInit) => Response) {
    globalThis.fetch = vi.fn().mockImplementation(
      async (url: string, init: RequestInit) => handler(url, init),
    ) as typeof fetch
  }

  it("throws if apiKey is empty", () => {
    expect(
      () => new HttpRequester("http://localhost", "api-key", "", "secret"),
    ).toThrow("apiKey is required")
  })

  it("throws if apiSecret is empty", () => {
    expect(
      () => new HttpRequester("http://localhost", "api-key", "key", ""),
    ).toThrow("apiSecret is required")
  })

  it("sends correct headers", async () => {
    mockFetch((_url, init) => {
      expect(init.headers).toMatchObject({
        "X-API-Key": "my-key",
        "X-API-Secret": "my-secret",
        Accept: "application/json",
      })
      return jsonResponse({ ok: true })
    })

    const http = new HttpRequester("http://localhost", "api-key", "my-key", "my-secret")
    const result = await http.get("/test")
    expect(result).toEqual({ ok: true })
  })

  it("strips trailing slash from baseUrl", async () => {
    mockFetch((url) => {
      expect(url).toBe("http://localhost/api/test")
      return jsonResponse({ ok: true })
    })

    const http = new HttpRequester(
      "http://localhost/",
      "api-key",
      "key",
      "secret",
    )
    await http.get("/api/test")
  })

  describe("get", () => {
    it("returns parsed JSON", async () => {
      mockFetch(() => jsonResponse({ sandboxId: "sbx-123" }))

      const http = new HttpRequester("http://localhost", "api-key", "k", "s")
      const result = await http.get("/sandboxes/sbx-123")
      expect(result).toEqual({ sandboxId: "sbx-123" })
    })
  })

  describe("post", () => {
    it("sends JSON body and returns parsed response", async () => {
      mockFetch((_url, init) => {
        expect(init.method).toBe("POST")
        expect(JSON.parse(init.body as string)).toEqual({ cpu: 1 })
        return jsonResponse({ id: "new" }, 201)
      })

      const http = new HttpRequester("http://localhost", "api-key", "k", "s")
      const result = await http.post("/sandboxes", { cpu: 1 })
      expect(result).toEqual({ id: "new" })
    })
  })

  describe("delete", () => {
    it("sends DELETE and resolves void", async () => {
      mockFetch((_url, init) => {
        expect(init.method).toBe("DELETE")
        return new Response(null, { status: 204 })
      })

      const http = new HttpRequester("http://localhost", "api-key", "k", "s")
      await http.delete("/sandboxes/sbx-123")
    })
  })

  describe("error handling", () => {
    it("throws BadRequestError on 400", async () => {
      mockFetch(() => jsonResponse({ message: "bad" }, 400))

      const http = new HttpRequester("http://localhost", "api-key", "k", "s")
      await expect(http.get("/test")).rejects.toThrow(BadRequestError)
    })

    it("throws AuthenticationError on 401", async () => {
      mockFetch(() => jsonResponse({ message: "unauthorized" }, 401))

      const http = new HttpRequester("http://localhost", "api-key", "k", "s")
      await expect(http.get("/test")).rejects.toThrow(AuthenticationError)
    })

    it("throws NotFoundError on 404", async () => {
      mockFetch(() => jsonResponse({ message: "gone" }, 404))

      const http = new HttpRequester("http://localhost", "api-key", "k", "s")
      await expect(http.get("/test")).rejects.toThrow(NotFoundError)
    })

    it("throws PaymentRequiredError on 402", async () => {
      mockFetch(() => jsonResponse({ message: "billing cap exceeded" }, 402))

      const http = new HttpRequester("http://localhost", "api-key", "k", "s")
      try {
        await http.get("/test")
        expect.fail("should have thrown")
      } catch (err) {
        expect(err).toBeInstanceOf(PaymentRequiredError)
        expect((err as PaymentRequiredError).statusCode).toBe(402)
        expect((err as PaymentRequiredError).message).toBe("billing cap exceeded")
      }
    })

    it("throws RateLimitError on 429 with Retry-After", async () => {
      mockFetch(() => {
        const res = jsonResponse({ message: "slow" }, 429)
        res.headers.set("Retry-After", "30")
        return res
      })

      const http = new HttpRequester("http://localhost", "api-key", "k", "s")
      try {
        await http.get("/test")
        expect.fail("should have thrown")
      } catch (err) {
        expect(err).toBeInstanceOf(RateLimitError)
        expect((err as RateLimitError).retryAfter).toBe(30)
      }
    })

    it("throws APIError on unexpected status", async () => {
      mockFetch(() => jsonResponse({ message: "oops" }, 500))

      const http = new HttpRequester("http://localhost", "api-key", "k", "s")
      await expect(http.get("/test")).rejects.toThrow(APIError)
    })

    it("uses statusText when body has no message", async () => {
      mockFetch(() => textResponse(502, "Bad Gateway"))

      const http = new HttpRequester("http://localhost", "api-key", "k", "s")
      try {
        await http.get("/test")
        expect.fail("should have thrown")
      } catch (err) {
        expect(err).toBeInstanceOf(APIError)
        expect((err as APIError).message).toBe("Bad Gateway")
      }
    })

    it("throws on network error", async () => {
      globalThis.fetch = vi
        .fn()
        .mockRejectedValue(new Error("connection refused")) as typeof fetch

      const http = new HttpRequester("http://localhost", "api-key", "k", "s")
      await expect(http.get("/test")).rejects.toThrow("Network error")
    })
  })
})
