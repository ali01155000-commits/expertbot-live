import { NextRequest } from "next/server";
import { db } from "@/lib/db";

// POST /api/trade/settle
// Body: { tradeId, exitPrice }
// Returns: { trade, won }
//
// Payout rules:
//   win  -> profit = amount * 0.85, payout = amount * 1.85 (stake + profit)
//   loss -> profit = -amount, payout = 0 (stake already deducted at execute time)
//   tie  -> profit = 0, payout = amount (return stake)
//
// On win/tie the payout is credited back to the account balance.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const tradeId: string | undefined = body?.tradeId;
    const exitPrice: number = Number(body?.exitPrice);

    if (!tradeId) {
      return Response.json({ error: "tradeId is required" }, { status: 400 });
    }
    if (!Number.isFinite(exitPrice) || exitPrice <= 0) {
      return Response.json(
        { error: "exitPrice must be > 0" },
        { status: 400 }
      );
    }

    const trade = await db.$transaction(async (tx) => {
      const existing = await tx.trade.findUnique({ where: { id: tradeId } });

      if (!existing) {
        throw new HttpError("Trade not found", 404);
      }
      if (existing.status !== "open") {
        throw new HttpError("Trade is not open", 400);
      }

      // Determine outcome based on direction + price movement.
      let status: "won" | "lost" | "tie";
      if (exitPrice === existing.entryPrice) {
        status = "tie";
      } else if (existing.direction === "CALL") {
        status = exitPrice > existing.entryPrice ? "won" : "lost";
      } else {
        // PUT wins when price goes down
        status = exitPrice < existing.entryPrice ? "won" : "lost";
      }

      // Payout computation.
      let profit: number;
      let payout: number;
      if (status === "won") {
        profit = existing.amount * 0.85;
        payout = existing.amount * 1.85;
      } else if (status === "lost") {
        profit = -existing.amount;
        payout = 0;
      } else {
        profit = 0;
        payout = existing.amount;
      }

      // Credit payout back to the account (only on win/tie; loss = nothing).
      if (payout > 0) {
        await tx.account.update({
          where: { id: existing.accountId },
          data: { balance: { increment: payout } },
        });
      }

      return tx.trade.update({
        where: { id: tradeId },
        data: {
          status,
          exitPrice,
          payout,
          profit,
          closedAt: new Date(),
        },
      });
    });

    return Response.json({ trade, won: trade.status === "won" });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json(
      { error: err?.message ?? "Internal server error" },
      { status: 400 }
    );
  }
}

class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
