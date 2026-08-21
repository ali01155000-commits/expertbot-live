import { NextRequest } from "next/server";
import { db } from "@/lib/db";

// POST /api/account/login
// Body: { email, platformToken, accountType }
// Returns: { account, token }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email: string | undefined = body?.email;
    const platformToken: string | undefined = body?.platformToken;
    const accountType: string = body?.accountType === "real" ? "real" : "demo";

    if (!email || typeof email !== "string" || email.trim().length === 0) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    if (!platformToken || typeof platformToken !== "string") {
      return Response.json(
        { error: "platformToken is required" },
        { status: 400 }
      );
    }

    // Upsert account by email. New accounts start at balance 10000.
    // Existing accounts keep their current balance.
    const account = await db.account.upsert({
      where: { email },
      update: {
        // Refresh token + type on each login but keep balance intact.
        platformToken,
        accountType,
      },
      create: {
        email,
        platformToken,
        accountType,
        balance: 10000,
        currency: "USD",
      },
    });

    return Response.json({ account, token: account.id });
  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? "Internal server error" },
      { status: 400 }
    );
  }
}
