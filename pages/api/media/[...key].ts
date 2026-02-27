import type { NextApiRequest, NextApiResponse } from "next";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const keyParts = req.query.key;
  if (!keyParts || !Array.isArray(keyParts)) {
    return res.status(400).json({ error: "Invalid key" });
  }

  const key = keyParts.join("/");

  if (!key.startsWith("results/")) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const bucket = process.env.S3_BUCKET;
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!bucket || !accessKey || !secretKey) {
    return res.status(500).json({ error: "S3 not configured" });
  }

  try {
    const s3 = new S3Client({
      region: process.env.S3_REGION || "eu-west-1",
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 3600 }
    );

    res.setHeader("Cache-Control", "public, max-age=3600");
    res.redirect(302, url);
  } catch {
    return res.status(404).json({ error: "Not found" });
  }
}
