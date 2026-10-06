import { NextResponse } from "next/server";
import { evento } from "@/lib/motor/servicio";
export const dynamic = "force-dynamic";
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const e = await evento(id);
  return e ? NextResponse.json(e) : NextResponse.json({ error: "evento no existe" }, { status: 404 });
}
