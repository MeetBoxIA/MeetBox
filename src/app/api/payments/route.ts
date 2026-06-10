import { NextResponse } from "next/server";

import { auth } from "@/../auth";

// Base URL of the Spring Boot payments microservice (overridable via env).
const PAYMENTS_SERVICE_URL = process.env.PAYMENTS_SERVICE_URL ?? "http://localhost:8080";
// Abort the upstream call if the microservice/Mercado Pago hangs, so the user
// doesn't wait ~80s for a failure.
const UPSTREAM_TIMEOUT_MS = 20_000;

// POST /api/payments
// Receives the selected plan and proxies it to the Spring Boot microservice,
// which creates the Mercado Pago preference and returns its init_point.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(`${PAYMENTS_SERVICE_URL}/api/payments/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        title:      body.title,
        quantity:   1,
        unitPrice:  body.unitPrice,
        payerEmail: session.user.email,
        planId:     body.planId,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (data.status === "success" && data.initPoint) {
      return NextResponse.json({ initPoint: data.initPoint });
    }

    // Surface the real Mercado Pago error so it's visible in the UI and logs,
    // instead of a generic 400.
    console.error("Payments service error:", { status: data.status, message: data.message });
    return NextResponse.json(
      { error: data.message ?? "El servicio de pagos rechazó la solicitud." },
      { status: 400 },
    );
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error("Error conectando con el servicio de pagos:", error);
    return NextResponse.json(
      {
        error: aborted
          ? "El servicio de pagos no respondió a tiempo. Verifica el microservicio y el token de Mercado Pago."
          : "No se pudo conectar con el servicio de pagos. ¿Está corriendo en el puerto 8080?",
      },
      { status: aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
