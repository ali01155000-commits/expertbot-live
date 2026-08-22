import { NextRequest } from "next/server";
import { db } from "@/lib/db";

// DELETE /api/codes/[id]?adminKey=XXX
// يحذف أو يُعطّل كود
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const url = new URL(req.url);
    const adminKey = url.searchParams.get("adminKey");
    const { id } = await params;

    const validKey = process.env.ADMIN_KEY || "expertbot-admin-2024";
    if (adminKey !== validKey) {
      return Response.json({ error: "مفتاح المسؤول غير صحيح" }, { status: 401 });
    }

    await db.activationCode.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e?.message || "خطأ" }, { status: 500 });
  }
}

// PATCH /api/codes/[id]
// Body: { adminKey, action: "disable" | "enable" | "reset" }
export async function PATCH(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.pathname.split("/").pop()!;
    const body = await req.json();
    const { adminKey, action } = body || {};

    const validKey = process.env.ADMIN_KEY || "expertbot-admin-2024";
    if (adminKey !== validKey) {
      return Response.json({ error: "مفتاح المسؤول غير صحيح" }, { status: 401 });
    }

    const data: any = {};
    if (action === "disable") data.status = "disabled";
    if (action === "enable") data.status = "active";
    if (action === "reset") {
      data.status = "active";
      data.usedAt = null;
      data.usedByToken = null;
      data.usedByNote = null;
    }

    await db.activationCode.update({ where: { id }, data });
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e?.message || "خطأ" }, { status: 500 });
  }
}
