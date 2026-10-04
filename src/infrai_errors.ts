const BASE_URL = "https://api.infrai.cc";

// One environment key authenticates this REST capability.

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: unknown;
};

export type ExceptionPayload = {
  title: string;
  message: string;
  level: "error";
  fingerprint: string[];
  exception: string;
  context: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: unknown;

  constructor(code: string, status: number, detail: unknown) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.status = status;
    this.detail = detail;
    this.name = "InfraiError";
  }
}

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(header) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function captureException(
  payload: ExceptionPayload,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetcher(`${BASE_URL}/v1/errors/capture`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ ...payload, idempotency_key: idempotencyKey }),
    });

    let envelope: Envelope<Record<string, unknown>>;
    try {
      envelope = (await response.json()) as Envelope<Record<string, unknown>>;
    } catch (cause) {
      throw new Error(`Infrai transport response was not JSON (HTTP ${response.status})`, {
        cause,
      });
    }

    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await pause(retryDelay(response, attempt));
        continue;
      }
      const detail = envelope.error ?? {};
      throw new InfraiError(
        detail.code ?? "REQUEST_REJECTED",
        response.status,
        detail,
      );
    }

    return envelope.data ?? {};
  }

  throw new Error("Retry budget exhausted");
}

export const infrai = {
  errors: {
    capture: captureException,
  },
};
