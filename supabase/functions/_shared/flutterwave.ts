let cachedToken = '';

let tokenExpiresAt = 0;

function getCredentials() {
  const clientId =
    (
      Deno.env.get(
        'CLIENT_ID',
      ) || ''
    ).trim();

  const clientSecret =
    (
      Deno.env.get(
        'CLIENT_SECRET',
      ) || ''
    ).trim();

  if (
    !clientId ||
    !clientSecret
  ) {
    throw new Error(
      'Flutterwave credentials are not configured.',
    );
  }

  return {
    clientId,
    clientSecret,
  };
}

export function getFlutterwaveBaseUrl() {
  const mode =
    (
      Deno.env.get(
        'FLUTTERWAVE_MODE',
      ) ||
      'production'
    )
      .trim()
      .toLowerCase();

  if (
    mode ===
    'sandbox'
  ) {
    return 'https://developersandbox-api.flutterwave.com';
  }

  return 'https://f4bexperience.flutterwave.com';
}

export async function getFlutterwaveToken() {
  const now =
    Date.now();

  if (
    cachedToken &&
    tokenExpiresAt >
      now + 60_000
  ) {
    return cachedToken;
  }

  const {
    clientId,
    clientSecret,
  } =
    getCredentials();

  const body =
    new URLSearchParams({
      client_id:
        clientId,

      client_secret:
        clientSecret,

      grant_type:
        'client_credentials',
    });

  const response =
    await fetch(
      'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token',
      {
        method:
          'POST',

        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded',
        },

        body,
      },
    );

  const result =
    await response.json();

  if (
    !response.ok ||
    !result?.access_token
  ) {
    console.error(
      'Flutterwave authentication failed:',
      result,
    );

    throw new Error(
      'Flutterwave authentication failed.',
    );
  }

  cachedToken =
    result.access_token;

  tokenExpiresAt =
    now +
    Number(
      result.expires_in ||
        600,
    ) *
      1000;

  return cachedToken;
}

export async function flutterwaveRequest(
  path: string,
  init: RequestInit = {},
) {
  const token =
    await getFlutterwaveToken();

  const headers =
    new Headers(
      init.headers ||
        {},
    );

  headers.set(
    'Authorization',
    `Bearer ${token}`,
  );

  headers.set(
    'Accept',
    'application/json',
  );

  if (
    init.body &&
    !headers.has(
      'Content-Type',
    )
  ) {
    headers.set(
      'Content-Type',
      'application/json',
    );
  }

  if (
    !headers.has(
      'X-Trace-Id',
    )
  ) {
    headers.set(
      'X-Trace-Id',
      crypto.randomUUID(),
    );
  }

  const response =
    await fetch(
      `${getFlutterwaveBaseUrl()}${path}`,
      {
        ...init,
        headers,
      },
    );

  const text =
    await response.text();

  let result: any = {};

  try {
    result =
      text
        ? JSON.parse(text)
        : {};
  } catch {
    result = {
      message: text,
    };
  }

  if (
    !response.ok ||
    result?.status ===
      'failed'
  ) {
    console.error(
      'Flutterwave API error:',
      result,
    );

    throw new Error(
      result?.error
        ?.message ||
        result?.message ||
        'Flutterwave could not process the request.',
    );
  }

  return result;
}