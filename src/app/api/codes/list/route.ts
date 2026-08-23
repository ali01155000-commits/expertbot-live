import { NextRequest } from "next/server";
import { db } from "@/lib/db";

// GET /api/codes/list?adminKey=XXX&status=active|used|disabled|all
// يرجع قائمة كل الأكواد
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const adminKey = url.searchParams.get("adminKey");
    const status = url.searchParams.get("status") || "all";

    const validKey = process.env.ADMIN_KEY || "expertbot-admin-2024";
    if (adminKey !== validKey) {
      return Response.json({ error: "مفتاح المسؤول غير صحيح" }, { status: 401 });
    }

    const where = status !== "all" ? { status } : {};
    const codes = await db.activationCode.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return Response.json({
      codes: codes.map((c) => ({
        id: c.id,
        code: c.code,
        status: c.status,
        note: c.note,
        createdAt: c.createdAt,
        usedAt: c.usedAt,
        usedByNote: c.usedByNote,
        expiresAt: c.expiresAt,
      })),
      total: codes.length,
      active: codes.filter((c) => c.status === "active").length,
      used: codes.filter((c) => c.status === "used").length,
      disabled: codes.filter((c) => c.status === "disabled").length,
    });
  } catch (e: any) {
    return Response.json({ error: e?.message || "خطأ" }, { status: 500 });
  }
}
