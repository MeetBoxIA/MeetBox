/**
 * src/lib/plans.ts
 *
 * Fuente de verdad de los límites por plan.
 * Cualquier API route importa `getUserPlan` y `PLAN_LIMITS` de aquí.
 *
 * Planes disponibles:
 *   free        → gratis, límites bajos
 *   plan_sala   → $23.99/mes, límites medios
 *   plan_empresa → $184.99/mes, ilimitado
 */

import { getSupabase } from "@/lib/supabase";

// ── Tipos ────────────────────────────────────────────────────────────────────

export type PlanId = "free" | "plan_sala" | "plan_empresa";

export interface PlanLimits {
  rooms: number;              // workspaces que puede crear
  conversationsMetty: number; // conversaciones de IA (Meety)
  messagesPerConversation: number; // mensajes IA por conversación
  notebooks: number;          // cuadernos en MeetBook
  membersPerRoom: number;     // miembros por workspace
}

// -1 = ilimitado
export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    rooms:                   2,
    conversationsMetty:      3,
    messagesPerConversation: 5,
    notebooks:               2,
    membersPerRoom:          3,
  },
  plan_sala: {
    rooms:                   10,
    conversationsMetty:      20,
    messagesPerConversation: 50,
    notebooks:               15,
    membersPerRoom:          10,
  },
  plan_empresa: {
    rooms:                   -1,
    conversationsMetty:      -1,
    messagesPerConversation: -1,
    notebooks:               -1,
    membersPerRoom:          -1,
  },
};

export const PLAN_NAMES: Record<PlanId, string> = {
  free:          "Plan Gratuito",
  plan_sala:     "Por Sala",
  plan_empresa:  "Empresa",
};

// ── Helper principal ─────────────────────────────────────────────────────────

/**
 * Devuelve el plan activo del usuario.
 * Llama a la función SQL `get_user_plan` que maneja expiración.
 */
export async function getUserPlan(userId: string): Promise<PlanId> {
  const { data, error } = await getSupabase().rpc("get_user_plan", {
    p_user_id: userId,
  });

  if (error) {
    // Si la función aún no existe en la DB, cae a free de forma segura
    console.error("[plans] get_user_plan error:", error.message);
    return "free";
  }

  const plan = data as string;
  if (plan === "plan_sala" || plan === "plan_empresa") return plan;
  return "free";
}

/**
 * Retorna los límites del plan activo del usuario.
 */
export async function getUserLimits(userId: string): Promise<PlanLimits> {
  const plan = await getUserPlan(userId);
  return PLAN_LIMITS[plan];
}

/**
 * Verifica si el usuario puede crear más recursos del tipo dado.
 * Retorna { allowed: true } o { allowed: false, limit, current, plan }
 */
export async function checkLimit(
  userId: string,
  resource: keyof PlanLimits,
  currentCount: number,
): Promise<{ allowed: true } | { allowed: false; limit: number; current: number; plan: PlanId }> {
  const plan   = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  const limit  = limits[resource];

  // -1 = ilimitado
  if (limit === -1 || currentCount < limit) return { allowed: true };

  return { allowed: false, limit, current: currentCount, plan };
}

/** Mensaje de error estándar cuando se alcanza un límite. */
export function limitErrorMessage(
  resource: keyof PlanLimits,
  limit: number,
  plan: PlanId,
): string {
  const resourceLabels: Record<keyof PlanLimits, string> = {
    rooms:                   "espacios de trabajo",
    conversationsMetty:      "conversaciones de IA",
    messagesPerConversation: "mensajes de IA en esta conversación",
    notebooks:               "cuadernos",
    membersPerRoom:          "miembros en este workspace",
  };

  const label = resourceLabels[resource];
  const planName = PLAN_NAMES[plan];

  if (plan === "free") {
    return `Has alcanzado el límite de ${limit} ${label} en el plan gratuito. Mejora tu plan para continuar.`;
  }
  return `Has alcanzado el límite de ${limit} ${label} en el plan ${planName}.`;
}
