/**
 * Unified email sending helper with a provider priority chain:
 *   1. Brevo HTTP API  — no custom domain required; easiest to configure
 *   2. Resend HTTP API — requires a verified sender domain
 *   3. Gmail/SMTP      — generic SMTP fallback via Nodemailer
 *
 * The first provider whose env vars are present wins; the others are skipped.
 */
import nodemailer from "nodemailer";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  // ── Brevo HTTP API ────────────────────────────────────────────────────
  // Preferred: sender verification is a single click, no domain needed.
  if (process.env.BREVO_API_KEY) {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "MeetBox",
          email: process.env.SMTP_FROM ?? "infomeetbox0@gmail.com",
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Brevo error: ${err}`);
    }
    return;
  }

  // ── Resend HTTP API ───────────────────────────────────────────────────
  // Requires RESEND_FROM to be a verified domain in resend.com/domains.
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM,
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error: ${err}`);
    }
    return;
  }

  // ── Gmail SMTP (fallback) ─────────────────────────────────────────────
  // Gmail app passwords sometimes contain spaces — strip them defensively.
  if (process.env.SMTP_HOST) {
    const pass = process.env.SMTP_PASS?.replace(/\s/g, "");
    const isGmail = process.env.SMTP_HOST === "smtp.gmail.com";

    const transporter = nodemailer.createTransport(
      isGmail
        ? { service: "gmail", auth: { user: process.env.SMTP_USER, pass } }
        : {
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === "true",
            auth: { user: process.env.SMTP_USER, pass },
            // Many ISPs block outbound port 465/587 on certain networks;
            // disabling rejectUnauthorized avoids TLS errors in those cases.
            tls: { rejectUnauthorized: false },
          },
    );

    // Race against an 8-second timeout so a blocked SMTP port doesn't hang
    // the entire API route indefinitely.
    await Promise.race([
      transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, html }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("SMTP timeout — port may be blocked")), 8_000),
      ),
    ]);
    return;
  }

  throw new Error("No email provider configured");
}
