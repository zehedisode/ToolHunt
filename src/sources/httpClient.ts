import type { Result } from "../types/index.js";
import { ok, err } from "../types/index.js";

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Fetch text from a URL with a hard timeout. Any timeout, network error, or
 * non-success status resolves to a structured error result (never throws).
 */
export async function fetchText(
  url: string,
  options: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<Result<string>> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "ToolHunt/0.1 (+https://github.com/toolhunt)",
        ...options.headers,
      },
    });
    if (!response.ok) {
      return err(`Request to ${url} failed with status ${response.status}`);
    }
    const text = await response.text();
    return ok(text);
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? `timed out after ${timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : String(error);
    return err(`Request to ${url} failed: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET JSON from a URL with a hard timeout. Returns parsed JSON on success.
 */
export async function fetchJson<T>(
  url: string,
  options: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<Result<T>> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "ToolHunt/0.1 (+https://github.com/toolhunt)",
        Accept: "application/json",
        ...options.headers,
      },
    });
    if (!response.ok) {
      return err(`Request to ${url} failed with status ${response.status}`);
    }
    const data = (await response.json()) as T;
    return ok(data);
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? `timed out after ${timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : String(error);
    return err(`Request to ${url} failed: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST JSON to a URL with a hard timeout. Returns parsed JSON on success.
 */
export async function postJson<T>(
  url: string,
  body: unknown,
  options: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<Result<T>> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ToolHunt/0.1 (+https://github.com/toolhunt)",
        ...options.headers,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      return err(`Request to ${url} failed with status ${response.status}`);
    }
    const data = (await response.json()) as T;
    return ok(data);
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? `timed out after ${timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : String(error);
    return err(`Request to ${url} failed: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}
