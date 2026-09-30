import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const BUCKET = process.env.S3_BUCKET ?? "avatars";

// S3-compatible client: ใช้ได้ทั้ง MinIO, Cloudflare R2, AWS S3 (เปลี่ยนแค่ env)
const s3 = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint: process.env.S3_ENDPOINT, // URL ที่ "server" ใช้คุยกับ storage
  forcePathStyle: true, // MinIO ต้องใช้ http://host/bucket/key
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "",
  },
});

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadAvatar(userId: string, file: File) {
  const ext = ALLOWED_IMAGE_TYPES[file.type];
  const key = `users/${userId}/${Date.now()}.${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type,
    })
  );
  return key;
}

export async function deleteFile(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// URL ที่ "browser" ใช้แสดงรูป (อาจต่างจาก S3_ENDPOINT เมื่อรันใน Docker)
export function publicUrl(key: string | null | undefined) {
  if (!key) return null;
  return `${process.env.S3_PUBLIC_URL}/${BUCKET}/${key}`;
}