import nodemailer from "nodemailer";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  // ── Brevo HTTP API ────────────────────────────────────────────────────
  // No requiere dominio propio — verifica el email del remitente con un clic
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
  // Requiere RESEND_FROM con dominio verificado en resend.com/domains
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
            tls: { rejectUnauthorized: false },
          },
    );

    await Promise.race([
      transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, html }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("SMTP timeout — puerto bloqueado")), 8_000),
      ),
    ]);
    return;
  }

  throw new Error("No hay proveedor de email configurado");
}
