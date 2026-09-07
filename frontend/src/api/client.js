import { API_BASE_URL } from "@/config";

/**
 * Normalised API failure. `status` is 0 for network/timeout errors so callers
 * can distinguish "backend unreachable" from "backend said no".
 */
export class ApiError extends Error {
  constructor(message, { status = 0, detail = null, cause = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.cause = cause;
  }

  get isOffline() {
    return this.status === 0;
  }
}

/** FastAPI returns `detail` as a string, or a list of validation objects. */
function readDetail(body) {
  if (!body || typeof body !== "object") return null;
  const { detail } = body;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => d?.msg).filter(Boolean).join("; ") || null;
  }
  return null;
}

/**
 * The check-in request runs three ML models plus a Gemini call server-side,
 * so it needs a far longer budget than the dashboard reads.
 */
const DEFAULT_TIMEOUT_MS = 15_000;

export async function request(
  path,
  { method = "GET", body, query, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) {
  const url = new URL(`${API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
  // Honour a caller-supplied signal alongside our timeout.
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort, { once: true });

  const init = { method, signal: controller.signal };
  if (body instanceof FormData) {
    // Let the browser set multipart/form-data with its own boundary.
    init.body = body;
  } else if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    throw new ApiError(
      signal?.aborted ? "Request cancelled." : "Could not reach the server.",
      { status: 0, cause },
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(readDetail(payload) || `Request failed (${response.status}).`, {
      status: response.status,
      detail: payload,
    });
  }

  return payload;
}

export const get = (path, options) => request(path, { ...options, method: "GET" });
export const post = (path, body, options) => request(path, { ...options, method: "POST", body });
