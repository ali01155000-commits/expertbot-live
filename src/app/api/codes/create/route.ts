import { NextRequest } from "next/server";
import { db } from "@/lib/db";

// POST /api/codes/create
// Body: { count?: number, note?: string, adminKey: string, expiresInDays?: number }
// ينشئ كود واحد أو أكثر
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { count = 1, note, adminKey, expiresInDays } = body || {};

    // تحقق من مفتاح المسؤول
    const validKey = process.env.ADMIN_KEY || "expertbot-admin-2024";
    if (adminKey !== validKey) {
      return Response.json({ error: "مفتاح المسؤول غير صحيح" }, { status: 401 });
    }

    const num = Math.max(1, Math.min(100, Number(count) || 1));
    const codes: string[] = [];

    for (let i = 0; i < num; i++) {
      // توليد كود بصيغة: XXXX-XXXX-XXXX-XXXX (حروف وأرقام)
      const code = generateCode();
      const expiresAt = expiresInDays
        ? new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000)
        : null;

      await db.activationCode.create({
        data: {
          code,
          status: "active",
          note: note || null,
          expiresAt,
        },
      });
      codes.push(code);
    }

    return Response.json({
      ok: true,
      codes,
      count: codes.length,
    });
  } catch (e: any) {
    return Response.json({ error: e?.message || "خطأ" }, { status: 500 });
  }
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // بدون أحرف ملتبسة (I,O,0,1)
  const part = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${part()}-${part()}-${part()}-${part()}`;
}
