import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { LambdaMicroVMsClient, CreateMicrovmImageCommand } from "@aws-sdk/client-lambda-microvms";

export interface BlueprintBuildConfig {
    apiKey?: string;
    cpu?: number;
    memoryMB?: number;
    tags?: string[];
    buildRoleArn?: string;
    bucketName?: string;
    onBuildLogs?: (log: string) => void;
}

export class Blueprint {
    private static s3 = new S3Client({});
    private static microVmClient = new LambdaMicroVMsClient({});

    constructor(public baseBlueprintName: string = "bridgeside") {}

    /**
     * Instantiate a Blueprint configurator from an existing base blueprint name
     */
    static fromBlueprint(baseBlueprintName: string): Blueprint {
        return new Blueprint(baseBlueprintName);
    }

    /**
     * Helper command builder
     */
    runCmd(command: string): { command: string } {
        return { command };
    }

    /**
     * Package artifact zip, upload to S3, and trigger AWS MicroVM snapshot generation
     */
    static async build(
        artifactZipBuffer: Buffer,
        blueprintName: string,
        config: BlueprintBuildConfig
    ) {
        const bucket = config.bucketName || process.env.BRIDGESIDE_ARTIFACT_BUCKET || "bridgeside-microvm-artifacts";
        const s3Key = `blueprints/${blueprintName}-${Date.now()}.zip`;

        if (config.onBuildLogs) {
            config.onBuildLogs(`[SDK] Uploading artifact package to s3://${bucket}/${s3Key}...`);
        }

        // 1. Upload code/Dockerfile artifact package to Amazon S3
        await this.s3.send(new PutObjectCommand({
            Bucket: bucket,
            Key: s3Key,
            Body: artifactZipBuffer
        }));

        if (config.onBuildLogs) {
            config.onBuildLogs(`[SDK] Triggering AWS Lambda MicroVM Image build for '${blueprintName}'...`);
        }

        // 2. Trigger AWS snapshot pre-initialization build
        const imageRes = await this.microVmClient.send(new CreateMicrovmImageCommand({
            Name: blueprintName,
            CodeArtifact: { Uri: `s3://${bucket}/${s3Key}` },
            BuildRoleArn: config.buildRoleArn || process.env.MICROVM_BUILD_ROLE_ARN,
            BaseImageArn: "arn:aws:lambda:us-east-1:aws:microvm-image:al2023-1"
        }));

        if (config.onBuildLogs) {
            config.onBuildLogs(`[SDK] MicroVM Image creation started: ${imageRes.ImageArn}`);
        }

        return imageRes;
    }
}