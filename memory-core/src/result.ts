import type { ProtocolError, ProtocolErrorCode, ProtocolResult } from './types';

/** Wrap a value in a successful ProtocolResult. */
export function ok<T>(value: T): ProtocolResult<T> {
  return { ok: true, value };
}

/** Wrap an error in a failed ProtocolResult. */
export function err<T = never>(
  code: ProtocolErrorCode,
  message: string,
  detail?: Record<string, unknown>,
): ProtocolResult<T> {
  const error: ProtocolError = detail ? { code, message, detail } : { code, message };
  return { ok: false, error };
}

/** Type guard narrowing a result to its success branch. */
export function isOk<T>(r: ProtocolResult<T>): r is { ok: true; value: T } {
  return r.ok;
}
