/**
 * POST /api/auth/password/forgot
 *
 * Accepts an email, generates a reset token, and sends a link to the user.
 * Always returns 200 regardless of whether the email exists — this prevents
 * user enumeration (an attacker cannot tell if an account is registered).
 */
import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { saveResetToken } from "@/lib/reset-token-store";
import { OtpSendSchema } from "@/lib/validators";
import { checkRateLimit } from "@/lib/rate-limit";

// A function, not a singleton: a NextResponse's body stream can only be
// read once, so reusing the same instance across requests returns an empty
// body on every call after the first.
const genericOk = () => NextResponse.json({ success: true });

const emailHtml = (resetUrl: string) => `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:440px;margin:0 auto;padding:32px;background:#fff;border-radius:16px;border:1px solid #e2e8f0">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
      <svg width="20" height="26" viewBox="0 0 31 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="m8.75 11.3 6.75 3.884 6.75-3.885M8.75 34.58v-7.755L2 22.939m27 0-6.75 3.885v7.754M2.405 15.408 15.5 22.954l13.095-7.546M15.5 38V22.939M29 28.915V16.962a2.98 2.98 0 0 0-1.5-2.585L17 8.4a3.01 3.01 0 0 0-3 0L3.5 14.377A3 3 0 0 0 2 16.962v11.953A2.98 2.98 0 0 0 3.5 31.5L14 37.477a3.01 3.01 0 0 0 3 0L27.5 31.5a3 3 0 0 0 1.5-2.585" stroke="#050040" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span style="font-size:18px;font-weight:600;color:#050040">MeetBox</span>
    </div>
    <h2 style="font-size:20px;font-weight:600;color:#050040;margin:0 0 8px">Recupera tu contraseña</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px">
      Haz clic en el botón para crear una nueva contraseña. El enlace es válido por <strong>30 minutos</strong>.
    </p>
    <a href="${resetUrl}" style="display:inline-block;background:#050040;color:#fff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:10px;text-decoration:none;margin-bottom:24px">
      Restablecer contraseña
    </a>
    <p style="color:#94a3b8;font-size:12px;margin:0">
      Si no solicitaste este correo, ignóralo. Tu contraseña no cambiará.
    </p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0" />
    <p style="color:#cbd5e1;font-size:11px;margin:0">
      Si el botón no funciona, copia este enlace en tu navegador:<br/>
      <span style="color:#64748b">${resetUrl}</span>
    </p>
  </div>
`;

export async function POST(req: NextRequest) {
  const body   = await req.json().catch(() => ({}));
  const result = OtpSendSchema.safeParse(body);
  if (!result.success) return genericOk(); // don't reveal format errors either

  const email = result.data.email.toLowerCase().trim();

  // Rate-limited silently — revealing the limit would leak whether the email
  // is registered, defeating the anti-enumeration pattern below.
  if (!checkRateLimit(`reset:${email}`, 3, 15 * 60 * 1000)) return genericOk();

  const db = getSupabase();

  // Gate by password_hash, not provider: an account that also linked Google
  // can still reset its password as long as it has one. Google-only
  // accounts (no password_hash) have nothing to reset.
  const { data: user } = await db
    .from("users")
    .select("id, password_hash")
    .eq("email", email)
    .maybeSingle();

  // No user / no password → return the same generic 200 (anti-enumeration)
  if (!user?.password_hash) return genericOk();

  const token    = randomBytes(32).toString("hex");
  const baseUrl  = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/auth/reset?token=${token}&email=${encodeURIComponent(email)}`;

  saveResetToken(email, token);

  try {
    await sendEmail({
      to:      email,
      subject: "Recupera tu contraseña — MeetBox",
      html:    emailHtml(resetUrl),
    });
  } catch (err) {
    console.error("[forgot-password] Error sending reset email:", (err as Error).message);
    // Log in dev so the link is accessible without email config.
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n[DEV] Reset link for ${email}:\n  ${resetUrl}\n`);
    }
  }

  return genericOk();
}
