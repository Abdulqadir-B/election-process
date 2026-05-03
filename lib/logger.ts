/**
 * lib/logger.ts
 *
 * Shared Google Cloud Logging utility for all API routes.
 *
 * On Cloud Run, the service account automatically has the necessary permissions
 * to write to Cloud Logging — no additional credentials are required.
 *
 * When running locally (no GCP_PROJECT_ID set), all logs fall back to
 * structured console output so development is unaffected.
 */

import { Logging } from '@google-cloud/logging';

// The GCP project ID is injected by Cloud Run as an env var.
// Falls back to undefined in local dev — triggers console fallback below.
const projectId = process.env.GCP_PROJECT_ID;
const LOG_NAME = 'election-assistant';

// Lazily initialise the Cloud Logging client only on GCP
let cloudLog: ReturnType<InstanceType<typeof Logging>['log']> | null = null;

if (projectId) {
  const logging = new Logging({ projectId });
  cloudLog = logging.log(LOG_NAME);
}

type Severity = 'DEFAULT' | 'INFO' | 'WARNING' | 'ERROR';

interface LogPayload {
  message: string;
  [key: string]: unknown;
}

/**
 * Write a structured log entry to Cloud Logging (on GCP) or console (locally).
 *
 * @param severity - GCP log severity level
 * @param payload  - Structured data to log; must include a `message` field
 */
async function writeLog(severity: Severity, payload: LogPayload): Promise<void> {
  if (cloudLog) {
    try {
      const metadata = {
        resource: { type: 'cloud_run_revision' },
        severity,
      };
      const entry = cloudLog.entry(metadata, payload);
      await cloudLog.write(entry);
    } catch {
      // Never let logging failures crash the request — fall back to console
      console.error('[CloudLogger] Failed to write log, falling back to console:', payload);
    }
  } else {
    // Local dev: emit a structured JSON line to console
    const label = severity === 'ERROR' ? 'error' : severity === 'WARNING' ? 'warn' : 'log';
    console[label](`[${severity}]`, JSON.stringify(payload));
  }
}

// ── Public helpers ───────────────────────────────────────────────────────────

export const logger = {
  /**
   * Log an informational event (e.g. request received, model selected).
   */
  info(payload: LogPayload): void {
    void writeLog('INFO', payload);
  },

  /**
   * Log a non-critical warning (e.g. rate limit triggered, model fallback).
   */
  warn(payload: LogPayload): void {
    void writeLog('WARNING', payload);
  },

  /**
   * Log an error with optional error metadata.
   */
  error(payload: LogPayload & { errorMessage?: string }): void {
    void writeLog('ERROR', payload);
  },
};
