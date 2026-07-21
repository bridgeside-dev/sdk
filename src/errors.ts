export class BridgesideError extends Error {
  readonly statusCode?: number

  constructor(message: string, statusCode?: number) {
    super(message)
    this.name = "BridgesideError"
    this.statusCode = statusCode
  }
}

export class AuthenticationError extends BridgesideError {
  constructor(message = "Invalid API key or secret") {
    super(message, 401)
    this.name = "AuthenticationError"
  }
}

export class BadRequestError extends BridgesideError {
  constructor(message = "Bad request") {
    super(message, 400)
    this.name = "BadRequestError"
  }
}

export class NotFoundError extends BridgesideError {
  constructor(message = "Resource not found") {
    super(message, 404)
    this.name = "NotFoundError"
  }
}

export class PaymentRequiredError extends BridgesideError {
  constructor(message = "Payment required") {
    super(message, 402)
    this.name = "PaymentRequiredError"
  }
}

export class RateLimitError extends BridgesideError {
  readonly retryAfter?: number

  constructor(message = "Rate limit exceeded", retryAfter?: number) {
    super(message, 429)
    this.name = "RateLimitError"
    this.retryAfter = retryAfter
  }
}

export class APIError extends BridgesideError {
  constructor(message: string, statusCode: number) {
    super(message, statusCode)
    this.name = "APIError"
  }
}

export class SandboxProvisioningError extends BridgesideError {
  constructor(message: string) {
    super(message)
    this.name = "SandboxProvisioningError"
  }
}
