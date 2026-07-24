export type MicroVMState = "RUNNING" | "COMPLETE" | "FAILED"

export type MicroVMListState = "RUNNING"

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
  timeoutMs?: number
}

export const DEFAULT_BASE_URL = "https://api.bridgeside.com/v1"
