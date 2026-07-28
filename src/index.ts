export { BridgesideClient } from "./client.js"
export type { BridgesideClientOptions } from "./client.js"

export { CredentialsClient } from "./resources/credentials.js"
export { MicroVMsClient } from "./resources/microvms.js"

export {
  BridgesideError,
  AuthenticationError,
  BadRequestError,
  NotFoundError,
  PaymentRequiredError,
  RateLimitError,
  APIError,
  MicroVMProvisioningError,
} from "./errors.js"

export type {
  CredentialMetadata,
  GeneratedCredential,
  MicroVMState,
  MicroVMListState,
  MicroVMCreateRequest,
  MicroVMDetails,
  MicroVMCreateOptions,
} from "./types.js"

export {
  DEFAULT_BASE_URL,
} from "./types.js"
