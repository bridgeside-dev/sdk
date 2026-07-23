export type SandboxState = "PROVISIONING" | "RUNNING" | "SUSPENDED" | "TERMINATED"

export type SandboxListState = "PROVISIONING" | "RUNNING" | "SUSPENDED"

export interface ComputeResources {
  cpu?: number
  memoryMB?: number
  timeoutMs?: number
}

export interface NetworkPolicy {
  allowRules?: AllowRule[]
}

export interface AllowRule {
  domain?: string
  port?: number
}

export interface SandboxCreateRequest {
  resources: ComputeResources
  env?: Record<string, string>
  networkPolicy?: NetworkPolicy
  bootstrapScript?: string
  metadata?: Record<string, string>
}

export interface SandboxDetails {
  sandboxId: string
  state: SandboxState
  createdAt: string
  resources: ComputeResources
  metadata?: Record<string, string>
}

export interface SandboxCreateOptions {
  wait?: boolean
  timeoutMs?: number
}

export const DEFAULT_BASE_URL = "https://api.bridgeside.com/v1"
export const DEFAULT_WAIT_TIMEOUT_MS = 60_000
export const POLL_INITIAL_INTERVAL_MS = 1_000
export const POLL_MAX_INTERVAL_MS = 10_000
