import { NextRequest, NextResponse } from "next/server";

const SARVAM_API_URL = "https://api.sarvam.ai/speech-to-text";

export async function POST(req: NextRequest) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, message: "STT service not configured." },
      { status: 500 }
    );
  }

  try {
    // Forward the multipart form-data from the browser to Sarvam AI
    const formData = await req.formData();
    const audioFile = formData.get("file") as Blob | null;
    const languageCode = (formData.get("language_code") as string) || "en-IN";

    if (!audioFile) {
      return NextResponse.json(
        { success: false, message: "No audio file received." },
        { status: 400 }
      );
    }

    // Build multipart body for Sarvam AI
    const sarvamForm = new FormData();
    sarvamForm.append("file", audioFile, "audio.wav");
    sarvamForm.append("language_code", languageCode);
    sarvamForm.append("model", "saarika:v2.5");
    sarvamForm.append("with_timestamps", "false");

    const sarvamRes = await fetch(SARVAM_API_URL, {
      method: "POST",
      headers: {
        "api-subscription-key": apiKey,
      },
      body: sarvamForm,
    });

    if (!sarvamRes.ok) {
      const errText = await sarvamRes.text();
      console.error("Sarvam STT error:", sarvamRes.status, errText);
      return NextResponse.json(
        { success: false, message: "Transcription service error. Please try again." },
        { status: 502 }
      );
    }

    const data = await sarvamRes.json();
    // Sarvam returns { transcript: "..." }
    const transcript: string = data.transcript ?? "";

    if (!transcript.trim()) {
      return NextResponse.json(
        { success: false, message: "No speech detected. Please try again." },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, transcript });
  } catch (err: unknown) {
    console.error("STT route error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
