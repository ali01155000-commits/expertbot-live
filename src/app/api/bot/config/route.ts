import { NextRequest } from "next/server";
import { db } from "@/lib/db";

// POST /api/bot/config
// Body: { accountId, strategy, pair, amount, expirySec, martingale, mgMultiplier, maxTrades, active }
// Returns: { config }
//
// One BotConfig per account: find the first existing config for this account
// and update it, otherwise create a new one.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const accountId: string | undefined = body?.accountId;
    const strategy: string | undefined = body?.strategy;
    const pair: string | undefined = body?.pair;
    const amount: number = Number(body?.amount);
    const expirySec: number = Number(body?.expirySec);
    const martingale: boolean = Boolean(body?.martingale);
    const mgMultiplier: number =
      body?.mgMultiplier !== undefined ? Number(body.mgMultiplier) : 2;
    const maxTrades: number =
      body?.maxTrades !== undefined ? Number(body.maxTrades) : 0;
    const active: boolean = Boolean(body?.active);

    if (!accountId) {
      return Response.json({ error: "accountId is required" }, { status: 400 });
    }
    if (!strategy || typeof strategy !== "string") {
      return Response.json({ error: "strategy is required" }, { status: 400 });
    }
    if (!pair || typeof pair !== "string") {
      return Response.json({ error: "pair is required" }, { status: 400 });
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

    // Find existing config for this account (one per account).
    const existing = await db.botConfig.findFirst({
      where: { accountId },
    });

    const data = {
      strategy,
      pair,
      amount,
      expirySec,
      martingale,
      mgMultiplier,
      maxTrades,
      active,
    };

    let config;
    if (existing) {
      config = await db.botConfig.update({
        where: { id: existing.id },
        data,
      });
    } else {
      config = await db.botConfig.create({
        data: { accountId, ...data },
      });
    }

    return Response.json({ config });
  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? "Internal server error" },
      { status: 400 }
    );
  }
}
