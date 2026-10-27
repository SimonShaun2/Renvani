import { env } from "@fsm/config";

type QboSyncSentryContext = {
  companyId: string;
  failureId?: string;
  entityKind?: string;
  localKey?: string;
  operation?: string;
  errorCode?: string;
};

function parseSentryDsn(dsn: string): { host: string; projectId: string; publicKey: string } | null {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, "");
    const publicKey = url.username;

    if (!projectId || !publicKey) {
      return null;
    }

    return {
      host: url.host,
      projectId,
      publicKey
    };
  } catch {
    return null;
  }
}

/** Best-effort Sentry alert for QBO sync failures (no SDK dependency until STACK-04). */
export async function alertQboSyncFailure(
  errorMessage: string,
  context: QboSyncSentryContext
): Promise<void> {
  const dsn = env.SENTRY_DSN?.trim();

  if (!dsn) {
    return;
  }

  const parsed = parseSentryDsn(dsn);

  if (!parsed) {
    return;
  }

  const envelope = {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: new Date().toISOString(),
    platform: "node",
    level: "error",
    logger: "qbo-sync",
    message: errorMessage,
    tags: {
      subsystem: "qbo-sync",
      sandbox_only: "true"
    },
    extra: context
  };

  const body = JSON.stringify(envelope);
  const storeUrl = `https://${parsed.host}/api/${parsed.projectId}/store/?sentry_version=7&sentry_key=${parsed.publicKey}`;

  try {
    await fetch(storeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${parsed.publicKey}`
      },
      body
    });
  } catch {
    // Never block sync flows on observability failures.
  }
}
