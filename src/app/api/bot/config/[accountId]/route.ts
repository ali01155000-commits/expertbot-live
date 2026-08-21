import { NextRequest } from "next/server";
import { db } from "@/lib/db";

// GET /api/bot/config/[accountId]
// Returns: { config } or { config: null } if the account has no bot config yet.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;

    const config = await db.botConfig.findFirst({
      where: { accountId },
      orderBy: { updatedAt: "desc" },
    });

    return Response.json({ config: config ?? null });
  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? "Internal server error" },
      { status: 400 }
    );
  }
}
