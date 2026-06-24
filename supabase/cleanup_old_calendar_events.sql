-- ─────────────────────────────────────────────────────────────────────────────
-- Limpieza TOTAL de eventos del meetcalendar antiguo
-- Ejecuta esto en Supabase > SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Vista previa — ejecuta esto primero para ver cuántos registros se borrarán:
/*
SELECT COUNT(*) AS total_a_borrar FROM calendar_events;
*/

-- Borrado total de todos los eventos de calendario:
DELETE FROM calendar_events;

-- Si solo quieres borrar los que NO son reuniones de workspace (más conservador):
-- DELETE FROM calendar_events WHERE type != 'meeting' OR room_id IS NULL;
