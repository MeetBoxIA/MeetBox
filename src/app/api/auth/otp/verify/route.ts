/**
 * POST /api/auth/otp/verify
 *
 * Validates the OTP submitted by the user against the in-process store.
 * checkOTP deletes the entry on both success and expiry, so each code is
 * single-use and cannot be replayed.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkOTP } from "@/lib/otp-store";

export async function POST(req: NextRequest) {
  const { email, code } = await req.json();
  if (!email || !code) {
    return NextResponse.json({ error: "Email and code required" }, { status: 400 });
  }
  const valid = checkOTP(email, code);
  if (!valid) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
