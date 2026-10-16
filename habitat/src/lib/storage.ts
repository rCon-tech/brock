import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface Storage {
  presignPut(key: string, mime: string, bytes: number): Promise<string>;
  presignGet(key: string, ttlSeconds: number): Promise<string>;
  head(key: string): Promise<{ bytes: number; mime: string } | null>;
  remove(key: string): Promise<void>;
}

export const PUT_URL_TTL = 300; // 5 minutes
export const GET_URL_TTL = 3600; // 1 hour

export function storageConfigured() {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
  );
}

function r2(): Storage {
  const bucket = process.env.R2_BUCKET ?? 'habitat-media';
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return {
    presignPut: (key, mime, bytes) =>
      getSignedUrl(
        client,
        new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mime, ContentLength: bytes }),
        {
          expiresIn: PUT_URL_TTL,
        },
      ),
    presignGet: (key, ttl) =>
      getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: ttl }),
    async head(key) {
      try {
        const r = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return { bytes: r.ContentLength ?? 0, mime: r.ContentType ?? '' };
      } catch (e) {
        if (
          (e as { name?: string }).name === 'NotFound' ||
          (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
        ) {
          return null;
        }
        throw e;
      }
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

let override: Storage | undefined;
/** Tests inject a fake; production uses R2. */
export function setStorage(s: Storage | undefined) {
  override = s;
}

export function getStorage(): Storage {
  if (override) return override;
  if (!storageConfigured()) throw new Error('Photo storage is not configured');
  return r2();
}
