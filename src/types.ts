export interface CredentialMetadata {
  clientId: string
  name: string
  status: "ACTIVE" | "REVOKED"
  createdAt: string
}

export interface GeneratedCredential {
  clientId: string
  clientSecret: string
}

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

export interface StreamWriter {
  write(chunk: Uint8Array): void
}

export interface ExecRequest {
  command: string
  user?: string
  cwd?: string
  pty?: boolean
  stdout?: StreamWriter
  stderr?: StreamWriter
  onExit?: (code: number) => void
  onError?: (err: Error) => void
}

export const DEFAULT_BASE_URL = "https://api.bridgeside.com"
