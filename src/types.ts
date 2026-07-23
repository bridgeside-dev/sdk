export type MicroVMState = "PROVISIONING" | "RUNNING" | "SUSPENDED" | "TERMINATED"

export type MicroVMListState = "PROVISIONING" | "RUNNING" | "SUSPENDED"

export interface ComputeResources {
  cpu: number
  memoryMB: number
  timeoutMs: number
}

export interface MicroVMCreateRequest {
  resources: ComputeResources
  env?: Record<string, string>
}

export interface MicroVMDetails {
  id: string
  state: MicroVMState
  endpoint?: string
  createdAt: string
  resources?: ComputeResources
}

export interface MicroVMCreateOptions {
  wait?: boolean
  timeoutMs?: number
}

export const DEFAULT_BASE_URL = "https://api.bridgeside.com/v1"
export const DEFAULT_WAIT_TIMEOUT_MS = 60_000
export const POLL_INITIAL_INTERVAL_MS = 1_000
export const POLL_MAX_INTERVAL_MS = 10_000
