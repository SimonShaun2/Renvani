import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { storageEnv as env } from "../runtime-env.js";
import type { ObjectStorageProvider, SignedObjectUrl, StoredObjectReference } from "./types.js";

interface ByteArrayBody {
  transformToByteArray(): Promise<Uint8Array>;
}

function hasByteArrayBody(value: unknown): value is ByteArrayBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "transformToByteArray" in value &&
    typeof (value as { transformToByteArray?: unknown }).transformToByteArray === "function"
  );
}

function buildObjectReference(key: string): string {
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${key}`;
}

export class R2ObjectStorageProvider implements ObjectStorageProvider {
  private readonly client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY
    }
  });

  async putObject(objectKey: string, buffer: Buffer, contentType: string): Promise<StoredObjectReference> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: objectKey,
        Body: buffer,
        ContentType: contentType
      })
    );

    return {
      reference: buildObjectReference(objectKey),
      objectKey
    };
  }

  async createSignedDownloadUrl(objectKey: string, expiresInSeconds: number): Promise<SignedObjectUrl> {
    const command = new GetObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: objectKey
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });

    return {
      url,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      objectKey
    };
  }

  async createSignedUploadUrl(
    objectKey: string,
    contentType: string,
    expiresInSeconds: number
  ): Promise<SignedObjectUrl> {
    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });

    return {
      url,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      objectKey
    };
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: objectKey
      })
    );
  }

  resolveObjectKey(reference: string): string {
    const url = new URL(reference);
    const prefix = `/${env.R2_BUCKET_NAME}/`;

    if (!url.pathname.startsWith(prefix)) {
      throw new Error(`File URL does not belong to the configured R2 bucket: ${reference}`);
    }

    return decodeURIComponent(url.pathname.slice(prefix.length));
  }

  async pingBucket(): Promise<void> {
    await this.client.send(
      new HeadBucketCommand({
        Bucket: env.R2_BUCKET_NAME
      })
    );
  }

  async downloadObject(objectKey: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: objectKey
      })
    );

    if (!hasByteArrayBody(response.Body)) {
      throw new Error(`R2 object ${objectKey} did not include a readable body`);
    }

    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }
}
