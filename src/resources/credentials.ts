import type { HttpRequester } from "../http.js"
import type { CredentialMetadata, GeneratedCredential } from "../types.js"

export class CredentialsClient {
  private readonly http: HttpRequester

  constructor(http: HttpRequester) {
    this.http = http
  }

  async list(): Promise<CredentialMetadata[]> {
    return this.http.get<{ data: CredentialMetadata[] }>("/v1/credentials").then(r => r.data)
  }

  async create(name: string): Promise<GeneratedCredential> {
    return this.http.post<GeneratedCredential>("/v1/credentials", { name })
  }

  async rotate(clientId: string): Promise<GeneratedCredential> {
    return this.http.post<GeneratedCredential>(`/v1/credentials/${encodeURIComponent(clientId)}/rotate`, {})
  }

  async delete(clientId: string): Promise<void> {
    await this.http.delete(`/v1/credentials/${encodeURIComponent(clientId)}`)
  }
}
