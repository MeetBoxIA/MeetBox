// Tipos compartidos entre el renderer y el preload.
// No importar desde el preload directamente — contextos separados.

export interface AudioSource {
  id:   string
  name: string
}

export interface ConnectionData {
  token:        string                 // short MBOX exchange code
  accessToken?: string                 // long-lived bearer token for /api/desktop/*
  apiUrl?:      string                 // backend base URL used at connect time
  user:         { id: string; name: string; email: string; avatar: string | null }
  connectedAt:  string
}

// Result of uploading a recording to the backend pipeline.
export interface UploadResult {
  ok:      boolean
  jobId?:  string
  error?:  string
}

// Live status of a processing job.
export interface JobStatus {
  job_id:     string
  status:     'uploaded' | 'queued' | 'transcribing' | 'analyzing'
            | 'matching_calendar' | 'creating_actions' | 'completed' | 'failed'
  progress:   number
  session_id: string | null
  error:      string | null
}
