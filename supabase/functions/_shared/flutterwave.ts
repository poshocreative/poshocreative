let cachedToken =
  '';

let tokenExpiresAt =
  0;

type FlutterwaveMode =
  | 'sandbox'
  | 'production';

export class PaymentGatewayError extends Error {
  code: string;

  technicalMessage: string;

  statusCode: number;

  constructor(
    code: string,
    technicalMessage: string,
    publicMessage:
      string,
    statusCode = 500,
  ) {
    super(
      publicMessage,
    );

    this.name =
      'PaymentGatewayError';

    this.code =
      code;

    this.technicalMessage =
      technicalMessage;

    this.statusCode =
      statusCode;
  }
}

function getVariable(
  ...names: string[]
) {
  for (
    const name of
    names
  ) {
    const value =
      (
        Deno.env.get(
          name,
        ) || ''
      ).trim();

    if (value) {
      return value;
    }
  }

  return '';
}

export function getFlutterwaveMode():
  FlutterwaveMode {
  const value =
    (
      Deno.env.get(
        'FLUTTERWAVE_MODE',
      ) ||
      'production'
    )
      .trim()
      .toLowerCase();

  return value ===
    'sandbox'
    ? 'sandbox'
    : 'production';
}

function getCredentials() {
  const clientId =
    getVariable(
      'FLUTTERWAVE_CLIENT_ID',
      'CLIENT_ID',
    );

  const clientSecret =
    getVariable(
      'FLUTTERWAVE_CLIENT_SECRET',
      'CLIENT_SECRET',
    );

  if (
    !clientId ||
    !clientSecret
  ) {
    throw new PaymentGatewayError(
      'FLW_CONFIG_MISSING',

      'Flutterwave v4 OAuth credentials are missing from the Edge Function environment.',

      'Payments are temporarily unavailable. No charge was made. Please try again shortly.',
      503,
    );
  }

  /*
   * Flutterwave v3 secret keys commonly begin
   * with FLWSECK. They are not OAuth v4
   * client secrets.
   */
  if (
    /^FLWSECK/i.test(
      clientSecret,
    )
  ) {
    throw new PaymentGatewayError(
      'FLW_LEGACY_SECRET',

      'CLIENT_SECRET appears to contain a Flutterwave v3 Secret Key instead of a v4 OAuth Client Secret.',

      'Payments are temporarily unavailable. No charge was made. Please try again shortly.',
      503,
    );
  }

  return {
    clientId,
    clientSecret,
  };
}

export function getFlutterwaveBaseUrl() {
  if (
    getFlutterwaveMode() ===
    'sandbox'
  ) {
    return 'https://developersandbox-api.flutterwave.com';
  }

  return 'https://f4bexperience.flutterwave.com';
}

async function readJson(
  response: Response,
) {
  const text =
    await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(
      text,
    );
  } catch {
    return {
      message:
        text.slice(
          0,
          1000,
        ),
    };
  }
}

export function getPaymentGatewayDiagnostic(
  error: unknown,
) {
  if (
    error instanceof
    PaymentGatewayError
  ) {
    return {
      code:
        error.code,

      technicalMessage:
        error.technicalMessage,

      statusCode:
        error.statusCode,
    };
  }

  if (
    error instanceof
    Error
  ) {
    return {
      code:
        'PAYMENT_PROVIDER_ERROR',

      technicalMessage:
        error.message,

      statusCode:
        500,
    };
  }

  return {
    code:
      'PAYMENT_PROVIDER_ERROR',

    technicalMessage:
      'Unknown payment provider error.',

    statusCode:
      500,
  };
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

  const requestBody =
    new URLSearchParams({
      client_id:
        clientId,

      client_secret:
        clientSecret,

      grant_type:
        'client_credentials',
    });

  let response:
    Response;

  try {
    response =
      await fetch(
        'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token',
        {
          method:
            'POST',

          headers: {
            'Content-Type':
              'application/x-www-form-urlencoded',
          },

          body:
            requestBody,
        },
      );
  } catch (
    networkError
  ) {
    console.error(
      'Flutterwave OAuth network failure:',
      networkError,
    );

    throw new PaymentGatewayError(
      'FLW_AUTH_UNREACHABLE',

      'The Flutterwave identity service could not be reached.',

      'The payment service is temporarily unavailable. No charge was made. Please try again shortly.',
      503,
    );
  }

  const result =
    await readJson(
      response,
    );

  if (
    !response.ok ||
    !result?.access_token
  ) {
    const providerCode =
      result?.error ||
      `HTTP_${response.status}`;

    const providerDescription =
      result
        ?.error_description ||
      result?.message ||
      'OAuth request did not return an access token.';

    /*
     * Do not log the Client Secret.
     * Only a small Client ID suffix is logged
     * to help distinguish configured environments.
     */
    console.error(
      'Flutterwave OAuth credentials rejected:',
      {
        status:
          response.status,

        providerCode,

        providerDescription,

        mode:
          getFlutterwaveMode(),

        clientIdSuffix:
          clientId.slice(
            -6,
          ),
      },
    );

    throw new PaymentGatewayError(
      'FLW_AUTH_REJECTED',

      `Flutterwave OAuth rejected the configured v4 credentials: ${providerCode} — ${providerDescription}`,

      'The payment service is temporarily unavailable. No charge was made. Please try again shortly.',
      502,
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
  init:
    RequestInit = {},
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

  let response:
    Response;

  try {
    response =
      await fetch(
        `${getFlutterwaveBaseUrl()}${path}`,
        {
          ...init,
          headers,
        },
      );
  } catch (
    networkError
  ) {
    console.error(
      'Flutterwave API network failure:',
      {
        path,
        networkError,
      },
    );

    throw new PaymentGatewayError(
      'FLW_API_UNREACHABLE',

      `Flutterwave API could not be reached for ${path}.`,

      'The payment service could not be reached. No charge was made. Please try again shortly.',
      503,
    );
  }

  const result =
    await readJson(
      response,
    );

  if (
    !response.ok ||
    result?.status ===
      'failed'
  ) {
    const providerMessage =
      result?.error
        ?.message ||
      result?.message ||
      `Flutterwave request failed with HTTP ${response.status}.`;

    console.error(
      'Flutterwave API request rejected:',
      {
        path,

        status:
          response.status,

        providerMessage,

        mode:
          getFlutterwaveMode(),
      },
    );

    throw new PaymentGatewayError(
      'FLW_API_REJECTED',

      providerMessage,

      'The payment service could not complete this request. No charge was made. Please try again shortly.',
      response.status ||
        502,
    );
  }

  return result;
}