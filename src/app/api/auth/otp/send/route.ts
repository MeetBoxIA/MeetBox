/**
 * POST /api/auth/otp/send
 *
 * Generates a 4-digit OTP, saves it in the in-process store, and delivers
 * it via whichever email provider is configured (Brevo > Resend > SMTP).
 *
 * Dev fallback: if no email provider is configured, the code is printed to
 * the server console so development doesn't require a real email account.
 * The same fallback activates when the send fails at runtime, preventing the
 * registration flow from being permanently blocked by a transient send error.
 */
import { NextRequest, NextResponse } from "next/server";
import { saveOTP } from "@/lib/otp-store";
import { sendEmail } from "@/lib/email";

/** Generate a 4-digit code in the range [1000, 9999]. */
function generateCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/** HTML template for the OTP email. Inline styles required for email clients. */
const emailHtml = (code: string) => `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:420px;margin:0 auto;padding:32px;background:#fff;border-radius:16px;border:1px solid #e2e8f0">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
      <svg width="20" height="26" viewBox="0 0 31 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="m8.75 11.3 6.75 3.884 6.75-3.885M8.75 34.58v-7.755L2 22.939m27 0-6.75 3.885v7.754M2.405 15.408 15.5 22.954l13.095-7.546M15.5 38V22.939M29 28.915V16.962a2.98 2.98 0 0 0-1.5-2.585L17 8.4a3.01 3.01 0 0 0-3 0L3.5 14.377A3 3 0 0 0 2 16.962v11.953A2.98 2.98 0 0 0 3.5 31.5L14 37.477a3.01 3.01 0 0 0 3 0L27.5 31.5a3 3 0 0 0 1.5-2.585" stroke="#050040" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span style="font-size:18px;font-weight:600;color:#050040">MeetBox</span>
    </div>
    <h2 style="font-size:20px;font-weight:600;color:#050040;margin:0 0 8px">Your verification code</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px">Enter this code to verify your account. Valid for <strong>10 minutes</strong>.</p>
    <div style="background:#f8fafc;border:2px dashed #e2e8f0;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
      <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:#050040">${code}</span>
    </div>
    <p style="color:#94a3b8;font-size:12px;margin:0">If you didn't request this code, ignore this message.</p>
  </div>
`;

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const code = generateCode();
  // Save before attempting to send so the code is valid even if send fails
  saveOTP(email, code);

  // Detect whether any provider is configured
  const hasBrevo  = !!process.env.BREVO_API_KEY;
  const hasResend = !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
  const hasSmtp   = !!process.env.SMTP_HOST;

  // No provider in env → dev mode, print to terminal instead of blocking registration
  if (!hasBrevo && !hasResend && !hasSmtp) {
    console.log("\n┌─────────────────────────────────────┐");
    console.log(`│  OTP for ${email}`);
    console.log(`│  Code: ${code}`);
    console.log("└─────────────────────────────────────┘\n");
    return NextResponse.json({ success: true, dev: true });
  }

  try {
    await sendEmail({
      to: email,
      subject: `${code} is your MeetBox verification code`,
      html: emailHtml(code),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Error sending OTP:", msg);
    // Fallback dev path: send failures shouldn't block registration — log and proceed
    console.log("\n┌─────────────────────────────────────┐");
    console.log(`│  [FALLBACK DEV] OTP for ${email}`);
    console.log(`│  Code: ${code}`);
    console.log("└─────────────────────────────────────┘\n");
    return NextResponse.json({ success: true, dev: true });
  }

  return NextResponse.json({ success: true });
}
