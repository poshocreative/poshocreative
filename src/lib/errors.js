import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

/** Single consolidated function-error parser (replaces 5 copies). */
export async function toUserError(error, fallbackMessage) {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();

      return new Error(body?.message || fallbackMessage);
    } catch {
      return new Error(fallbackMessage);
    }
  }

  if (
    error instanceof FunctionsFetchError ||
    error instanceof FunctionsRelayError
  ) {
    return new Error(
      'The service could not be reached. No change was saved. Please try again shortly.',
    );
  }

  return new Error(error?.message || fallbackMessage);
}

export function isMissingTableError(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();

  return (
    ['42P01', '42703', '42883', 'PGRST202', 'PGRST205'].includes(code) ||
    message.includes('schema cache')
  );
}

export function requiredId(value, name = 'Project') {
  const clean = String(value || '').trim();

  if (!clean) {
    throw new Error(`${name} could not be identified.`);
  }

  return clean;
}
