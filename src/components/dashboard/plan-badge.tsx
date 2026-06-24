/**
 * PlanBadge — muestra el plan activo del usuario y el uso de recursos.
 *
 * Se renderiza en el sidebar (dashboard-shell.tsx).
 * Consume GET /api/payments/plan.
 *
 * Uso:
 *   import { PlanBadge } from "@/components/dashboard/plan-badge";
 *   <PlanBadge onUpgrade={() => setView("plans")} />
 */
"use client";

import * as React from "react";
import { Zap, Crown, Sparkles } from "lucide-react";
import type { PlanId, PlanLimits } from "@/lib/plans";

interface PlanData {
  plan:     PlanId;
  planName: string;
  limits:   PlanLimits;
  usage: {
    rooms:              number;
    conversationsMetty: number;
    notebooks:          number;
  };
}

// ── Estilos por plan ─────────────────────────────────────────────────────────
const PLAN_STYLE: Record<PlanId, { bg: string; text: string; icon: React.ReactNode; border: string }> = {
  free:         { bg: "rgba(255,255,255,0.06)", text: "#9ca3af",   border: "rgba(255,255,255,0.1)", icon: <Sparkles size={12} /> },
  plan_sala:    { bg: "rgba(99,102,241,0.15)",  text: "#a5b4fc",   border: "rgba(99,102,241,0.4)", icon: <Zap size={12} /> },
  plan_empresa: { bg: "rgba(234,179,8,0.15)",   text: "#fde68a",   border: "rgba(234,179,8,0.4)", icon: <Crown size={12} /> },
};

// ── Barra de uso ─────────────────────────────────────────────────────────────
function UsageBar({ label, current, limit }: { label: string; current: number; limit: number }) {
  if (limit === -1) return null; // ilimitado → no mostrar barra
  const pct = Math.min((current / limit) * 100, 100);
  const isNearLimit = pct >= 80;

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#9ca3af", marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ color: isNearLimit ? "#f87171" : "#9ca3af" }}>{current}/{limit}</span>
      </div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 99 }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          borderRadius: 99,
          background: isNearLimit ? "#ef4444" : "rgba(99,102,241,0.7)",
          transition: "width 0.3s ease",
        }} />
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function PlanBadge({ onUpgrade }: { onUpgrade?: () => void }) {
  const [data,    setData]    = React.useState<PlanData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/payments/plan")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return null;

  const style = PLAN_STYLE[data.plan];

  return (
    <div style={{
      margin: "8px 12px",
      padding: "10px 12px",
      borderRadius: 10,
      background: style.bg,
      border: `1px solid ${style.border}`,
    }}>
      {/* Nombre del plan */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ color: style.text, display: "flex" }}>{style.icon}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: style.text, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          {data.planName}
        </span>
      </div>

      {/* Barras de uso (solo para free y plan_sala) */}
      {data.plan !== "plan_empresa" && (
        <>
          <UsageBar label="Workspaces"   current={data.usage.rooms}              limit={data.limits.rooms} />
          <UsageBar label="Chats IA"     current={data.usage.conversationsMetty} limit={data.limits.conversationsMetty} />
          <UsageBar label="Cuadernos"    current={data.usage.notebooks}          limit={data.limits.notebooks} />
        </>
      )}

      {/* Botón de upgrade (solo para free) */}
      {data.plan === "free" && onUpgrade && (
        <button
          onClick={onUpgrade}
          style={{
            marginTop: 8,
            width: "100%",
            padding: "5px 0",
            borderRadius: 6,
            border: "none",
            background: "rgba(99,102,241,0.8)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: "0.03em",
          }}
        >
          ⚡ Mejorar plan
        </button>
      )}
    </div>
  );
}
