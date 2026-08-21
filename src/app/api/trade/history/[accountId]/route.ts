import { NextRequest } from "next/server";
import { db } from "@/lib/db";

// GET /api/trade/history/[accountId]?limit=50
// Returns: { trades: [] } — closed trades (won/lost/tie), newest first.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;

    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam
      ? Math.max(1, Math.min(500, Number(limitParam)))
      : 50;

    const trades = await db.trade.findMany({
      where: {
        accountId,
        status: { in: ["won", "lost", "tie"] },
      },
      orderBy: { closedAt: "desc" },
      take: limit,
    });

    return Response.json({ trades });
  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? "Internal server error" },
      { status: 400 }
    );
  }
}
