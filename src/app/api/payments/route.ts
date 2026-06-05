import { NextResponse } from "next/server";

import { auth } from "@/../auth";

// POST /api/payments
// Recibe el plan seleccionado y llama al microservicio Spring Boot
export async function POST(request: Request) {
  
  // Verificamos que el usuario esté autenticado
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Llamamos al microservicio Spring Boot
    const response = await fetch("http://localhost:8080/api/payments/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: body.title,
        quantity: 1,
        unitPrice: body.unitPrice,
        // Usamos el email del usuario autenticado
        payerEmail: session.user.email,
        planId: body.planId,
      }),
    });

    const data = await response.json();

    if (data.status === "success") {
      // Retornamos la URL de pago al frontend
      return NextResponse.json({ initPoint: data.initPoint });
    } else {
      return NextResponse.json({ error: data.message }, { status: 400 });
    }

  } catch (error) {
    console.error("Error conectando con el servicio de pagos:", error);
    return NextResponse.json(
      { error: "Error conectando con el servicio de pagos" },
      { status: 500 }
    );
  }
}