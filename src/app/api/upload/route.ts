import { writeFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { join } from "node:path";

import { NextResponse } from "next/server";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const UPLOADS_DIR = "public/uploads/avatars";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: { code: "NO_FILE", message: "No file was provided." } },
        { status: 422 },
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "INVALID_FILE_TYPE",
            message: "File must be PNG, JPEG, GIF, or WebP.",
          },
        },
        { status: 422 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "FILE_TOO_LARGE",
            message: "File must be under 5MB.",
          },
        },
        { status: 413 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 12);
    const random = randomBytes(4).toString("hex");
    const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : file.type === "image/gif" ? "gif" : "webp";
    const filename = hash + "-" + random + "." + ext;
    const filepath = join(process.cwd(), UPLOADS_DIR, filename);

    await writeFile(filepath, buffer);

    const url = "/uploads/avatars/" + filename;

    return NextResponse.json({ ok: true, url });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "UPLOAD_FAILED",
          message: "Image upload failed. Try again or use a URL instead.",
        },
      },
      { status: 500 },
    );
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
