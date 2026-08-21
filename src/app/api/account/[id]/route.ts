import { NextRequest } from "next/server";
import { db } from "@/lib/db";

// GET /api/account/[id]
// Returns: { account } or 404
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const account = await db.account.findUnique({
      where: { id },
      include: {
        botConfigs: true,
      },
    });

    if (!account) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }

    return Response.json({ account });
  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? "Internal server error" },
      { status: 400 }
    );
  }
}
