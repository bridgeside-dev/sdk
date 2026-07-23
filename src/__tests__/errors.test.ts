import { describe, it, expect } from "vitest"
import {
  BridgesideError,
  AuthenticationError,
  BadRequestError,
  NotFoundError,
  PaymentRequiredError,
  RateLimitError,
  APIError,
  MicroVMProvisioningError,
} from "../errors.js"

describe("BridgesideError", () => {
  it("stores message and statusCode", () => {
    const err = new BridgesideError("test", 500)
    expect(err.message).toBe("test")
    expect(err.statusCode).toBe(500)
    expect(err.name).toBe("BridgesideError")
    expect(err).toBeInstanceOf(Error)
  })

  it("allows undefined statusCode", () => {
    const err = new BridgesideError("test")
    expect(err.statusCode).toBeUndefined()
  })
})

describe("AuthenticationError", () => {
  it("has status 401 and default message", () => {
    const err = new AuthenticationError()
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe("Invalid API key or secret")
    expect(err.name).toBe("AuthenticationError")
    expect(err).toBeInstanceOf(BridgesideError)
  })
})

describe("BadRequestError", () => {
  it("has status 400", () => {
    const err = new BadRequestError("invalid config")
    expect(err.statusCode).toBe(400)
    expect(err.message).toBe("invalid config")
    expect(err).toBeInstanceOf(BridgesideError)
  })
})

describe("NotFoundError", () => {
  it("has status 404", () => {
    const err = new NotFoundError("sbx not found")
    expect(err.statusCode).toBe(404)
    expect(err.message).toBe("sbx not found")
    expect(err).toBeInstanceOf(BridgesideError)
  })
})

describe("PaymentRequiredError", () => {
  it("has status 402 and default message", () => {
    const err = new PaymentRequiredError()
    expect(err.statusCode).toBe(402)
    expect(err.message).toBe("Payment required")
    expect(err.name).toBe("PaymentRequiredError")
    expect(err).toBeInstanceOf(BridgesideError)
  })

  it("accepts custom message", () => {
    const err = new PaymentRequiredError("billing cap exceeded")
    expect(err.statusCode).toBe(402)
    expect(err.message).toBe("billing cap exceeded")
  })
})

describe("RateLimitError", () => {
  it("has status 429 and retryAfter", () => {
    const err = new RateLimitError("slow down", 30)
    expect(err.statusCode).toBe(429)
    expect(err.retryAfter).toBe(30)
    expect(err).toBeInstanceOf(BridgesideError)
  })

  it("allows undefined retryAfter", () => {
    const err = new RateLimitError()
    expect(err.retryAfter).toBeUndefined()
  })
})

describe("APIError", () => {
  it("stores arbitrary status code", () => {
    const err = new APIError("server error", 503)
    expect(err.statusCode).toBe(503)
    expect(err).toBeInstanceOf(BridgesideError)
  })
})

describe("MicroVMProvisioningError", () => {
  it("has no statusCode and correct message", () => {
    const err = new MicroVMProvisioningError("timed out")
    expect(err.statusCode).toBeUndefined()
    expect(err.message).toBe("timed out")
    expect(err.name).toBe("MicroVMProvisioningError")
    expect(err).toBeInstanceOf(BridgesideError)
  })
})
