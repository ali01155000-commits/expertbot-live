import { NextRequest } from "next/server";
import { db } from "@/lib/db";

// POST /api/trade/execute
// Body: { accountId, pair, direction, amount, expirySec, source, strategy, entryPrice }
// Returns: { trade }
//
// The stake (amount) is deducted from the account balance immediately and
// locked until the trade is settled. Settlement credits the payout back.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const accountId: string | undefined = body?.accountId;
    const pair: string | undefined = body?.pair;
    const direction: string | undefined = body?.direction;
    const amount: number = Number(body?.amount);
    const expirySec: number = Number(body?.expirySec);
    const source: string = body?.source === "bot" ? "bot" : "manual";
    const strategy: string | null = body?.strategy ? String(body.strategy) : null;
    const entryPrice: number = Number(body?.entryPrice);

    // Validation
    if (!accountId) {
      return Response.json({ error: "accountId is required" }, { status: 400 });
    }
    if (!pair || typeof pair !== "string") {
      return Response.json({ error: "pair is required" }, { status: 400 });
    }
    if (direction !== "CALL" && direction !== "PUT") {
      return Response.json(
        { error: "direction must be CALL or PUT" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json({ error: "amount must be > 0" }, { status: 400 });
    }
    if (!Number.isFinite(expirySec) || expirySec < 1) {
      return Response.json(
        { error: "expirySec must be >= 1" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
      return Response.json(
        { error: "entryPrice must be > 0" },
        { status: 400 }
      );
    }

    // Use a transaction so the trade creation + balance deduction are atomic.
    const trade = await db.$transaction(async (tx) => {
      const account = await tx.account.findUnique({ where: { id: accountId } });

      if (!account) {
        throw new Error("Account not found");
      }

      if (account.balance < amount) {
        throw new Error("Insufficient balance");
      }

      const updatedAccount = await tx.account.update({
        where: { id: accountId },
        data: { balance: { decrement: amount } },
      });

      // Sanity: guard against going negative due to a race.
      if (updatedAccount.balance < 0) {
        throw new Error("Insufficient balance");
      }

      return tx.trade.create({
        data: {
          accountId,
          pair,
          direction,
          amount,
          entryPrice,
          expirySec,
          status: "open",
          source,
          strategy,
          openedAt: new Date(),
        },
      });
    });

    return Response.json({ trade });
  } catch (err: any) {
    const msg = err?.message ?? "Internal server error";
    return Response.json({ error: msg }, { status: 400 });
  }
}
