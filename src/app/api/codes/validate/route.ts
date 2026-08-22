import { NextRequest } from "next/server";
import { db } from "@/lib/db";

// POST /api/codes/validate
// Body: { code: string, usedByToken?: string, usedByNote?: string }
// يتحقق من الكود ويُفعّله (يربطه بالمستخدم)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, usedByToken, usedByNote } = body || {};

    if (!code || typeof code !== "string") {
      return Response.json({ error: "الكود مطلوب" }, { status: 400 });
    }

    const normalized = code.trim().toUpperCase();

    const record = await db.activationCode.findUnique({
      where: { code: normalized },
    });

    if (!record) {
      return Response.json({ valid: false, error: "الكود غير موجود" }, { status: 404 });
    }

    if (record.status === "used") {
      return Response.json(
        { valid: false, error: "هذا الكود مُستخدم بالفعل" },
        { status: 400 }
      );
    }

    if (record.status === "disabled") {
      return Response.json(
        { valid: false, error: "هذا الكود مُعطّل" },
        { status: 400 }
      );
    }

    if (record.expiresAt && record.expiresAt < new Date()) {
      return Response.json(
        { valid: false, error: "انتهت صلاحية هذا الكود" },
        { status: 400 }
      );
    }

    // فعّل الكود
    await db.activationCode.update({
      where: { id: record.id },
      data: {
        status: "used",
        usedAt: new Date(),
        usedByToken: usedByToken || null,
        usedByNote: usedByNote || null,
      },
    });

    return Response.json({
      valid: true,
      code: record.code,
      message: "تم تفعيل الكود بنجاح",
    });
  } catch (e: any) {
    return Response.json({ error: e?.message || "خطأ" }, { status: 500 });
  }
}

// GET /api/codes/validate?code=XXX
// يتحقق من الكود بدون تفعيله (للتحقق المسبق)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return Response.json({ error: "الكود مطلوب" }, { status: 400 });
    }

    const normalized = code.trim().toUpperCase();
    const record = await db.activationCode.findUnique({
      where: { code: normalized },
    });

    if (!record) {
      return Response.json({ valid: false, reason: "not_found" });
    }
    if (record.status === "used") {
      return Response.json({ valid: false, reason: "used", usedAt: record.usedAt });
    }
    if (record.status === "disabled") {
      return Response.json({ valid: false, reason: "disabled" });
    }
    if (record.expiresAt && record.expiresAt < new Date()) {
      return Response.json({ valid: false, reason: "expired" });
    }

    return Response.json({ valid: true, reason: "active" });
  } catch (e: any) {
    return Response.json({ error: e?.message || "خطأ" }, { status: 500 });
  }
}
