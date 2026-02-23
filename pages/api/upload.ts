import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

const BUCKET = process.env.S3_BUCKET!;
const REGION = process.env.S3_REGION || "eu-west-1";
const PRESIGN_EXPIRES = 300; // 5 minutes
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const ALLOWED_MIMES: Record<string, string> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "audio/mp4": "audio",
  "audio/webm": "audio",
  "audio/ogg": "audio",
  "application/pdf": "document",
  "text/plain": "document",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "document",
};

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/mp4": ".m4a",
    "audio/webm": ".weba",
    "audio/ogg": ".ogg",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      ".docx",
  };
  return map[mime] || "";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { files } = req.body;

  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: "files array is required" });
  }

  if (files.length > 5) {
    return res.status(400).json({ error: "Maximum 5 files allowed" });
  }

  const results = [];

  for (const file of files) {
    const { name, mimeType, size } = file as {
      name: string;
      mimeType: string;
      size: number;
    };

    if (!name || !mimeType || !size) {
      return res.status(400).json({ error: "Each file needs name, mimeType, and size" });
    }

    if (!ALLOWED_MIMES[mimeType]) {
      return res.status(400).json({ error: `Unsupported file type: ${mimeType}` });
    }

    if (size > MAX_FILE_SIZE) {
      return res.status(413).json({ error: `File too large: ${name} (max 50MB)` });
    }

    const ext = extFromMime(mimeType);
    const key = `uploads/${uuidv4()}${ext}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: PRESIGN_EXPIRES,
    });

    const publicUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

    results.push({
      uploadUrl,
      url: publicUrl,
      key,
      name,
      type: ALLOWED_MIMES[mimeType],
      mimeType,
      size,
    });
  }

  return res.json({ files: results });
}
