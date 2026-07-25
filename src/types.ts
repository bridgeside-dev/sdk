export type MicroVMState = "RUNNING" | "COMPLETE" | "FAILED"

export type MicroVMListState = "RUNNING"

export interface MicroVMCreateRequest {
  resources: { timeoutMs: number }
}

export interface MicroVMDetails {
  id: string
  state: MicroVMState
  endpoint?: string
  createdAt: string
  terminatedAt?: string
  reason?: string
}

export interface MicroVMCreateOptions {
  timeoutMs?: number
}

export const DEFAULT_BASE_URL = "https://api.bridgeside.com"
