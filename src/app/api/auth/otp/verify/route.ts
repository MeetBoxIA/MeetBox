/**
 * POST /api/auth/otp/verify
 *
 * Validates the OTP submitted by the user against the in-process store.
 * checkOTP deletes the entry on both success and expiry, so each code is
 * single-use and cannot be replayed.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkOTP } from "@/lib/otp-store";
import { OtpVerifySchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const result = OtpVerifySchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Ingresa un email válido y un código de 4 dígitos.",
        reason: "invalid_payload",
      },
      { status: 400 },
    );
  }

  const { email, code } = result.data;
  const otp = await checkOTP(email, code);

  if (!otp.valid) {
    const locked = otp.reason === "locked";
    const expired = otp.reason === "expired" || otp.reason === "missing";

    return NextResponse.json(
      {
        error: locked
          ? "Demasiados intentos. Solicita un código nuevo."
          : expired
            ? "El código expiró o ya no es válido. Solicita uno nuevo."
            : `Código incorrecto. Te quedan ${otp.attemptsRemaining} intento${otp.attemptsRemaining === 1 ? "" : "s"}.`,
        reason: otp.reason,
        attemptsRemaining: otp.attemptsRemaining,
        maxAttempts: otp.maxAttempts,
        locked,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    attemptsRemaining: otp.attemptsRemaining,
    maxAttempts: otp.maxAttempts,
  });
}
