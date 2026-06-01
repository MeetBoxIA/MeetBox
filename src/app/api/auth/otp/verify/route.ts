import { NextRequest, NextResponse } from "next/server";
import { checkOTP } from "@/lib/otp-store";

export async function POST(req: NextRequest) {
  const { email, code } = await req.json();
  if (!email || !code) {
    return NextResponse.json({ error: "Email y código requeridos" }, { status: 400 });
  }
  const valid = checkOTP(email, code);
  if (!valid) {
    return NextResponse.json({ error: "Código inválido o expirado" }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
