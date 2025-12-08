import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "./lib/session";
import { validateFile } from "./lib/validators";
import { uploadFileToStorage } from "./lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  console.log("[Upload API] Received upload request");
  try {
    const sessionResult = await requireSession();
    if (!sessionResult.ok) {
      return NextResponse.json({ error: sessionResult.error }, { status: sessionResult.status });
    }
    const { userId } = sessionResult;

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error: any) {
      return NextResponse.json({ error: "Failed to parse form data", details: error.message }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    const validation = validateFile(file);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const upload = await uploadFileToStorage(file!, userId, validation.messengerType || "file");
    if (!upload.ok) {
      return NextResponse.json({ error: upload.error, details: upload.details }, { status: upload.status });
    }

    return NextResponse.json({
      success: true,
      url: upload.url,
      fileName: upload.path,
      type: upload.type,
      mimeType: upload.mimeType
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error.message || "Unknown error",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
