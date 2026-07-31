import type { HttpRequester } from "../http.js"
import type {
  MicroVMCreateRequest,
  MicroVMCreateOptions,
  MicroVMDetails,
  MicroVMListState,
  ExecRequest,
  StreamWriter,
} from "../types.js"

interface ExecSseOutputMessage {
  type: "output"
  stream: "stdout" | "stderr"
  base64Content: string
}

interface ExecSseExitMessage {
  type: "exit"
  code: number
}

type ExecSseMessage = ExecSseOutputMessage | ExecSseExitMessage

interface ExecHandlers {
  stdout?: StreamWriter
  stderr?: StreamWriter
  onExit?: (code: number) => void
}

export class MicroVMsClient {
  private readonly http: HttpRequester

  constructor(http: HttpRequester) {
    this.http = http
  }

  async create(
    request: MicroVMCreateRequest,
    options?: MicroVMCreateOptions,
  ): Promise<MicroVMDetails> {
    const body = options?.timeoutMs
      ? { resources: { timeoutMs: options.timeoutMs } }
      : request
    return this.http.post<MicroVMDetails>(
      "/v1/microvms",
      body,
    )
  }

  async list(state?: MicroVMListState): Promise<MicroVMDetails[]> {
    const path = state ? `/v1/microvms?state=${encodeURIComponent(state)}` : "/v1/microvms"
    return this.http.get<{ data: MicroVMDetails[] }>(path).then(r => r.data)
  }

  async get(microvmID: string): Promise<MicroVMDetails> {
    return this.http.get<MicroVMDetails>(`/v1/microvms/${microvmID}`)
  }

  async terminate(microvmID: string): Promise<void> {
    await this.http.delete(`/v1/microvms/${microvmID}`)
  }

  async writeFile(microvmID: string, path: string, content: BodyInit): Promise<void> {
    const encodedPath = encodeURIComponent(path)
    await this.http.putRaw(
      `/v1/microvms/${microvmID}/files?path=${encodedPath}`,
      content,
    )
  }

  async readFile(microvmID: string, path: string): Promise<ReadableStream<Uint8Array>> {
    const encodedPath = encodeURIComponent(path)
    return this.http.getStream(
      `/v1/microvms/${microvmID}/files?path=${encodedPath}`,
    )
  }

  async deleteFile(microvmID: string, path: string): Promise<void> {
    const encodedPath = encodeURIComponent(path)
    await this.http.delete(
      `/v1/microvms/${microvmID}/files?path=${encodedPath}`,
    )
  }

  exec(microvmID: string, request: ExecRequest): void {
    const { command, user = "root", cwd = "/", stdout, stderr, onExit, onError } = request

    void (async () => {
      try {
        const { execId } = await this.http.post<{ execId: string }>(
          `/v1/microvms/${microvmID}/exec`,
          { command, user, cwd },
        )

        const body = await this.http.getStream(
          `/v1/microvms/${microvmID}/exec/${execId}/stream`,
        )

        await this.consumeSseStream(body, { stdout, stderr, onExit })
      } catch (err) {
        onError?.(toError(err))
      }
    })()
  }

  private async consumeSseStream(
    body: ReadableStream<Uint8Array>,
    handlers: ExecHandlers,
  ): Promise<void> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let sepIndex = buffer.indexOf("\n\n")
        while (sepIndex !== -1) {
          const rawEvent = buffer.slice(0, sepIndex)
          buffer = buffer.slice(sepIndex + 2)
          this.processSseEvent(rawEvent, handlers)
          sepIndex = buffer.indexOf("\n\n")
        }
      }
    } catch (err) {
      try {
        await reader.cancel()
      } catch {
        // ignore cancel errors, the original error is what matters
      }
      throw err
    }
  }

  private processSseEvent(rawEvent: string, handlers: ExecHandlers): void {
    const dataLines: string[] = []
    for (const line of rawEvent.split("\n")) {
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart())
      }
    }

    for (const data of dataLines) {
      const msg = JSON.parse(data) as ExecSseMessage
      if (msg.type === "exit") {
        handlers.onExit?.(msg.code ?? -1)
      } else if (msg.stream === "stdout") {
        handlers.stdout?.write(base64ToUint8Array(msg.base64Content ?? ""))
      } else if (msg.stream === "stderr") {
        handlers.stderr?.write(base64ToUint8Array(msg.base64Content ?? ""))
      }
    }
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err))
}
