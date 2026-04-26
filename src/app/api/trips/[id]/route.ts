import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recordUserActivity } from "@/lib/user-usage";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await recordUserActivity(session.user.id);

  const { id } = await params;

  // Varmista omistajuus
  const trip = await getPrisma().trip.findUnique({ where: { id } });
  if (!trip || trip.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await getPrisma().trip.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
