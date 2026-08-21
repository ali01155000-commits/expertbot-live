import { NextRequest } from "next/server";
import { db } from "@/lib/db";

// GET /api/trade/open/[accountId]
// Returns: { trades: [] } — open trades for the account, newest first.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;

    const trades = await db.trade.findMany({
      where: { accountId, status: "open" },
      orderBy: { openedAt: "desc" },
    });

    return Response.json({ trades });
  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? "Internal server error" },
      { status: 400 }
    );
  }
}
