import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const endpoint = process.env.SPACES_ENDPOINT;
const region = process.env.SPACES_REGION || "us-east-1";
const bucket = process.env.SPACES_BUCKET;
const accessKey = process.env.SPACES_KEY;
const secretKey = process.env.SPACES_SECRET;

export const isSpacesEnabled = (): boolean => {
  return !!(endpoint && bucket && accessKey && secretKey);
};

export const s3Client = isSpacesEnabled()
  ? new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: accessKey!,
        secretAccessKey: secretKey!,
      },
      forcePathStyle: false, // For DigitalOcean Spaces, false is standard so bucket is in hostname
    })
  : null;

export async function uploadFileToSpace(key: string, body: Buffer, contentType: string) {
  if (!s3Client || !bucket) {
    throw new Error("Spaces storage is not configured.");
  }
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    ACL: "private",
  });
  await s3Client.send(command);
}

export async function deleteFileFromSpace(key: string) {
  if (!s3Client || !bucket) {
    throw new Error("Spaces storage is not configured.");
  }
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  await s3Client.send(command);
}

export async function getFileFromSpace(key: string) {
  if (!s3Client || !bucket) {
    throw new Error("Spaces storage is not configured.");
  }
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  const response = await s3Client.send(command);
  if (!response.Body) {
    throw new Error("Empty response body from Spaces.");
  }
  return response.Body;
}
