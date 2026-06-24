/**
 * /api/payments/webhook
 *
 * Recibe la notificación de Mercado Pago cuando un pago es aprobado.
 * Mercado Pago envía un POST con { type: "payment", data: { id: "..." } }
 *
 * Luego consultamos la API de MP para verificar el pago y activamos el plan
 * del usuario en Supabase.
 *
 * Configurar en: MP Dashboard → Tu app → Webhooks → URL:
 *   https://tu-dominio.com/api/payments/webhook
 *
 * Variables de entorno necesarias:
 *   MP_ACCESS_TOKEN  → tu token de Mercado Pago (mismo que usa el microservicio)
 *   MP_WEBHOOK_SECRET → (opcional) para validar la firma del webhook
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import type { PlanId } from "@/lib/plans";

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN ?? "";

// Cuánto tiempo dura cada plan (en días). null = no expira.
const PLAN_DURATION_DAYS: Record<string, number | null> = {
  plan_sala:    30,
  plan_empresa: null,
};

interface MPPayment {
  id:                 number;
  status:             string;   // "approved" | "pending" | "rejected" | ...
  status_detail:      string;
  payer: { email: string };
  metadata: { plan_id?: string; user_email?: string };
  additional_info?: { items?: { id?: string }[] };
}

/** Consulta la API de Mercado Pago para verificar el pago. */
async function getPaymentFromMP(paymentId: string): Promise<MPPayment | null> {
  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    if (!res.ok) {
      console.error("[webhook] MP API error:", res.status, await res.text());
      return null;
    }
    return res.json() as Promise<MPPayment>;
  } catch (err) {
    console.error("[webhook] fetch error:", err);
    return null;
  }
}

/** Activa el plan en Supabase para el usuario dado. */
async function activatePlan(userEmail: string, planId: PlanId, mpPaymentId: string) {
  const supabase = getSupabase();

  // Buscar el userId por email
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("email", userEmail)
    .single();

  if (!user?.id) {
    console.error("[webhook] Usuario no encontrado para email:", userEmail);
    return;
  }

  const durationDays = PLAN_DURATION_DAYS[planId];
  const activatedAt  = new Date().toISOString();
  const expiresAt    = durationDays
    ? new Date(Date.now() + durationDays * 86_400_000).toISOString()
    : null;

  // Upsert: si ya tiene suscripción la actualiza, si no la crea
  const { error } = await supabase
    .from("user_subscriptions")
    .upsert(
      {
        user_id:         user.id,
        plan_id:         planId,
        status:          "active",
        mp_payment_id:   mpPaymentId,
        activated_at:    activatedAt,
        expires_at:      expiresAt,
        updated_at:      activatedAt,
      },
      { onConflict: "user_id" },
    );

  if (error) {
    console.error("[webhook] Error activando plan:", error.message);
  } else {
    console.log(`[webhook] ✅ Plan "${planId}" activado para ${userEmail} (pago ${mpPaymentId})`);
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // MP puede enviar distintos tipos de notificaciones; solo nos interesan pagos
  if (body.type !== "payment") {
    return NextResponse.json({ received: true });
  }

  const paymentId = String(body.data?.id ?? "");
  if (!paymentId) {
    return NextResponse.json({ error: "Missing payment id" }, { status: 400 });
  }

  // Verificar el pago directamente en la API de Mercado Pago
  const payment = await getPaymentFromMP(paymentId);
  if (!payment) {
    return NextResponse.json({ error: "Could not fetch payment" }, { status: 502 });
  }

  // Solo procesar pagos aprobados
  if (payment.status !== "approved") {
    console.log(`[webhook] Pago ${paymentId} con estado "${payment.status}" — ignorado`);
    return NextResponse.json({ received: true, status: payment.status });
  }

  // El planId viene en metadata (lo envía el microservicio Spring Boot al crear la preferencia)
  // o en el primer item del additional_info
  const planId = (
    payment.metadata?.plan_id ??
    payment.additional_info?.items?.[0]?.id ??
    ""
  ) as PlanId;

  const userEmail = payment.metadata?.user_email ?? payment.payer?.email ?? "";

  if (!planId || !userEmail) {
    console.error("[webhook] Pago aprobado pero sin planId o email:", { planId, userEmail, paymentId });
    return NextResponse.json({ error: "Missing plan or email in payment metadata" }, { status: 422 });
  }

  await activatePlan(userEmail, planId, paymentId);

  return NextResponse.json({ received: true, activated: true });
}
