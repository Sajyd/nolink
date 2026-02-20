import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import formidable from "formidable";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export const config = {
  api: { bodyParser: false },
};

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const MIME_TO_TYPE: Record<string, string> = {
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
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  const form = formidable({
    uploadDir: UPLOAD_DIR,
    keepExtensions: true,
    maxFileSize: MAX_FILE_SIZE,
    maxFiles: 5,
    filename: (_name, ext) => `${uuidv4()}${ext}`,
    filter: ({ mimetype }) => {
      return !!mimetype && !!MIME_TO_TYPE[mimetype];
    },
  });

  try {
    const [_fields, files] = await form.parse(req);

    const uploadedFiles = (files.file || []).map((f) => {
      const mediaType = MIME_TO_TYPE[f.mimetype || ""] || "document";
      return {
        url: `/uploads/${f.newFilename}`,
        name: f.originalFilename || f.newFilename,
        type: mediaType,
        mimeType: f.mimetype,
        size: f.size,
      };
    });

    if (uploadedFiles.length === 0) {
      return res.status(400).json({ error: "No valid files uploaded" });
    }

    return res.json({ files: uploadedFiles });
  } catch (err) {
    if (err instanceof Error && err.message.includes("maxFileSize")) {
      return res.status(413).json({ error: "File too large (max 50MB)" });
    }
    return res.status(500).json({ error: "Upload failed" });
  }
}
