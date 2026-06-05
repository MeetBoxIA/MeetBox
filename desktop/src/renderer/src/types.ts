// Tipos compartidos entre el renderer y el preload.
// No importar desde el preload directamente — contextos separados.

export interface ConnectionData {
  token:       string
  user:        { id: string; name: string; email: string; avatar: string | null }
  connectedAt: string
}
