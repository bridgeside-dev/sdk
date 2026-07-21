export type SandboxState = "PROVISIONING" | "RUNNING" | "SUSPENDED" | "TERMINATED"

export type SandboxListState = "PROVISIONING" | "RUNNING" | "SUSPENDED"

export interface ComputeResources {
  cpu?: number
  memoryMB?: number
  timeoutMs?: number
}

export interface AllowRule {
  domain?: string
  port?: number
}

export interface NetworkPolicy {
  allowRules?: AllowRule[]
}

export interface OpencodeAgentConfig {
  model: string
  primaryRepository: RepositoryRef
  createPullRequestOnCompletion?: boolean
  referenceRepositories?: RepositoryRef[]
  contextFiles?: ContextFile[]
}

export interface RepositoryRef {
  url: string
  branch?: string
}

export interface ContextFile {
  path?: string
  content?: string
}

export interface WorkloadSpec {
  type: string
  config: Record<string, unknown>
}

export interface SandboxCreateRequest {
  resources: ComputeResources
  workload: WorkloadSpec
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
  workloadType: string
}

export interface SandboxCreateOptions {
  wait?: boolean
  timeoutMs?: number
}

export const DEFAULT_BASE_URL = "https://api.bridgeside.com/v1"
export const DEFAULT_WAIT_TIMEOUT_MS = 60_000
export const POLL_INITIAL_INTERVAL_MS = 1_000
export const POLL_MAX_INTERVAL_MS = 10_000
