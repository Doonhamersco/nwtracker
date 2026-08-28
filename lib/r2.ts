import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";
import { isDiaryObjectKey } from "@/lib/r2-keys";

export { isDiaryObjectKey, diaryVideoKey, diaryThumbKey } from "@/lib/r2-keys";

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("R2 is not configured");
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function getClient(): { client: S3Client; bucket: string } {
  const cfg = getR2Config();
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return { client, bucket: cfg.bucket };
}

function corsOrigins(): string[] {
  const origins = new Set([
    "http://localhost:3000",
    "https://localhost:3000",
    "https://nwtracker.fly.dev",
  ]);
  const authUrl = process.env.AUTH_URL;
  if (authUrl) {
    try {
      origins.add(new URL(authUrl).origin);
    } catch {
      // ignore invalid AUTH_URL
    }
  }
  return [...origins];
}

let corsEnsured = false;

export async function ensureR2Cors(): Promise<void> {
  if (corsEnsured) return;
  const { client, bucket } = getClient();
  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: corsOrigins(),
              AllowedMethods: ["GET", "PUT", "HEAD"],
              AllowedHeaders: ["content-type", "content-length"],
              ExposeHeaders: ["ETag", "Content-Length"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      })
    );
    corsEnsured = true;
  } catch (err) {
    console.warn("[r2] Could not set bucket CORS (object tokens often cannot). Uploads will fall back to the app proxy.", err);
    corsEnsured = true;
  }
}

export async function presignPutUrl(key: string, expiresIn = 900): Promise<string> {
  if (!isDiaryObjectKey(key)) throw new Error("Invalid object key");
  await ensureR2Cors();
  const { client, bucket } = getClient();
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: "application/octet-stream",
    }),
    { expiresIn }
  );
}

export async function presignGetUrl(key: string, expiresIn = 900): Promise<string> {
  if (!isDiaryObjectKey(key)) throw new Error("Invalid object key");
  await ensureR2Cors();
  const { client, bucket } = getClient();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn }
  );
}

export async function deleteDiaryObjects(keys: string[]): Promise<void> {
  const valid = keys.filter((k) => isDiaryObjectKey(k));
  if (valid.length === 0) return;
  const { client, bucket } = getClient();
  await client.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: valid.map((Key) => ({ Key })) },
    })
  );
}

export async function uploadObjectStream(
  key: string,
  body: ReadableStream<Uint8Array>
): Promise<void> {
  if (!isDiaryObjectKey(key)) throw new Error("Invalid object key");
  const { client, bucket } = getClient();
  const nodeStream = Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]);
  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: nodeStream,
      ContentType: "application/octet-stream",
    },
    queueSize: 1,
    partSize: 8 * 1024 * 1024,
  });
  await upload.done();
}

export async function getObjectBytes(key: string): Promise<Uint8Array> {
  if (!isDiaryObjectKey(key)) throw new Error("Invalid object key");
  const { client, bucket } = getClient();
  const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!obj.Body) throw new Error("Empty object");
  return new Uint8Array(await obj.Body.transformToByteArray());
}
