import {
    LambdaMicroVMsClient,
    RunMicrovmCommand,
    GetMicrovmCommand,
    TerminateMicrovmCommand,
    CreateMicrovmAuthTokenCommand,
    GetMicrovmResponse
} from "@aws-sdk/client-lambda-microvms";

export interface SandboxCreateOptions {
    apiKey?: string;
    timeoutMs?: number;
    cpu?: number;        // vCPU baseline allocation (e.g. 1, 2)
    memoryMB?: number;   // RAM baseline allocation in MiB (e.g. 2048, 4096)
    envs?: Record<string, string>;
}

export interface CommandRunOptions {
    user?: string;
    timeoutMs?: number;
}

export interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export interface SandboxMetrics {
    cpuUsagePercent: number;
    memoryUsageMb: number;
    diskUsageMb: number;
    activeProcesses: number;
}

export class Sandbox {
    private static client = new LambdaMicroVMsClient({});

    constructor(
        public readonly sandboxId: string,
        public readonly endpoint: string,
        private authToken: string,
        private readonly apiKey?: string
    ) {}

    /**
     * Connect to an existing active or suspended MicroVM sandbox session
     */
    static async connect(sandboxId: string, options: { apiKey?: string } = {}): Promise<Sandbox> {
        const info = await this.client.send(new GetMicrovmCommand({ MicrovmId: sandboxId }));

        // Generate a fresh short-lived JWE auth token for the data-plane endpoint
        const tokenRes = await this.client.send(new CreateMicrovmAuthTokenCommand({
            MicrovmId: sandboxId,
            ValidityInSeconds: 3600
        }));

        return new Sandbox(
            sandboxId,
            info.EndpointUrl!,
            tokenRes.AuthToken!,
            options.apiKey
        );
    }

    /**
     * Provision and launch a new stateful MicroVM sandbox from a Blueprint
     */
    static async create(
        blueprintRef: string = "bridgeside",
        options: SandboxCreateOptions = {}
    ): Promise<Sandbox> {
        const timeoutMs = options.timeoutMs || 60_000;

        const runRes = await this.client.send(new RunMicrovmCommand({
            ImageName: blueprintRef,
            BaselineConfig: {
                vCPU: options.cpu || 1,
                MemoryMiB: options.memoryMB || 2048
            },
            IdlePolicy: {
                AutoSuspendTimeoutInSeconds: Math.floor(timeoutMs / 1000)
            },
            EnvironmentVariables: options.envs
        }));

        const tokenRes = await this.client.send(new CreateMicrovmAuthTokenCommand({
            MicrovmId: runRes.MicrovmId!,
            ValidityInSeconds: 3600
        }));

        return new Sandbox(
            runRes.MicrovmId!,
            runRes.EndpointUrl!,
            tokenRes.AuthToken!,
            options.apiKey
        );
    }

    /**
     * Execute an HTTP request against the internal daemon runner agent inside the VM
     */
    private async request<T>(path: string, method: "GET" | "POST", payload?: any): Promise<T> {
        const response = await fetch(`${this.endpoint}${path}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.authToken}`,
                ...(this.apiKey ? { "X-Bridgeside-Api-Key": this.apiKey } : {})
            },
            body: payload ? JSON.stringify(payload) : undefined
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Sandbox Data-Plane Request Failed [${response.status}]: ${errorText}`);
        }

        return response.json() as Promise<T>;
    }

    /**
     * Execute a shell command inside the sandbox VM
     */
    async runCmd(command: string, options: CommandRunOptions = {}): Promise<CommandResult> {
        return this.request<CommandResult>("/commands/run", "POST", {
            command,
            user: options.user || "root",
            timeoutMs: options.timeoutMs || 60_000
        });
    }

    /**
     * Alias for runCmd to maintain backwards compatibility with E2B SDK interface
     */
    get commands() {
        return {
            run: (command: string, options?: CommandRunOptions) => this.runCmd(command, options)
        };
    }

    /**
     * Write a file directly to the sandbox filesystem
     */
    async writeFile(path: string, content: string): Promise<{ status: string }> {
        return this.request<{ status: string }>("/files/write", "POST", { path, content });
    }

    /**
     * Filesystem helper accessor matching E2B SDK
     */
    get files() {
        return {
            write: (path: string, content: string) => this.writeFile(path, content)
        };
    }

    /**
     * Fetch system metrics from the inside daemon runner
     */
    async getMetrics(): Promise<SandboxMetrics> {
        return this.request<SandboxMetrics>("/metrics", "GET");
    }

    /**
     * Get low-level MicroVM metadata directly from AWS Control Plane
     */
    async getInfo(): Promise<GetMicrovmResponse> {
        return Sandbox.client.send(new GetMicrovmCommand({ MicrovmId: this.sandboxId }));
    }

    /**
     * Get host URL
     */
    getHost(): string {
        return `${this.endpoint}`;
    }

    /**
     * Immediately terminate the MicroVM sandbox instance
     */
    async kill(): Promise<void> {
        await Sandbox.client.send(new TerminateMicrovmCommand({ MicrovmId: this.sandboxId }));
    }
}