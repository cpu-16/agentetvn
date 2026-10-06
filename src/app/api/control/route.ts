import { NextResponse } from "next/server";
import { control } from "@/lib/motor/servicio";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(await control());
}
