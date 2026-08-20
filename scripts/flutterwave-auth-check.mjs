import crypto from 'node:crypto';

const TOKEN_URL =
  'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token';

const LIVE_API_URL =
  'https://f4bexperience.flutterwave.com';

function fingerprint(value) {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
}

function hiddenPrompt(label) {
  return new Promise(
    (resolve, reject) => {
      if (
        !process.stdin.isTTY ||
        typeof process.stdin.setRawMode !==
          'function'
      ) {
        reject(
          new Error(
            'This diagnostic must be run directly inside Command Prompt.',
          ),
        );

        return;
      }

      process.stdout.write(
        label,
      );

      process.stdin
        .setRawMode(true);

      process.stdin
        .resume();

      process.stdin
        .setEncoding(
          'utf8',
        );

      let value = '';

      const cleanup = () => {
        process.stdin
          .removeListener(
            'data',
            onData,
          );

        process.stdin
          .setRawMode(false);

        process.stdin
          .pause();
      };

      const onData = (
        key,
      ) => {
        const character =
          String(key);

        if (
          character ===
          '\u0003'
        ) {
          cleanup();

          process.stdout.write(
            '\n',
          );

          process.exit(130);
        }

        if (
          character ===
            '\r' ||
          character ===
            '\n'
        ) {
          cleanup();

          process.stdout.write(
            '\n',
          );

          resolve(
            value.trim(),
          );

          return;
        }

        if (
          character ===
            '\u0008' ||
          character ===
            '\u007f'
        ) {
          if (
            value.length >
            0
          ) {
            value =
              value.slice(
                0,
                -1,
              );

            process.stdout.write(
              '\b \b',
            );
          }

          return;
        }

        value +=
          character;

        process.stdout.write(
          '*',
        );
      };

      process.stdin.on(
        'data',
        onData,
      );
    },
  );
}

async function readBody(
  response,
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
      message: text,
    };
  }
}

async function main() {
  console.log('');
  console.log(
    'Posho Creative — Flutterwave v4 Diagnostic',
  );
  console.log(
    '------------------------------------------',
  );
  console.log('');
  console.log(
    'Your credentials will be masked and are not saved by this script.',
  );
  console.log('');

  const clientId =
    await hiddenPrompt(
      'Paste Flutterwave LIVE v4 Client ID: ',
    );

  const clientSecret =
    await hiddenPrompt(
      'Paste Flutterwave LIVE v4 Client Secret: ',
    );

  if (
    !clientId ||
    !clientSecret
  ) {
    throw new Error(
      'Client ID and Client Secret are required.',
    );
  }

  console.log('');
  console.log(
    'LOCAL CREDENTIAL FINGERPRINTS',
  );

  console.log(
    'Client ID:',
    fingerprint(
      clientId,
    ),
  );

  console.log(
    'Client Secret:',
    fingerprint(
      clientSecret,
    ),
  );

  console.log('');
  console.log(
    'Testing Flutterwave OAuth...',
  );

  const body =
    new URLSearchParams({
      client_id:
        clientId,

      client_secret:
        clientSecret,

      grant_type:
        'client_credentials',
    });

  let response;

  try {
    response =
      await fetch(
        TOKEN_URL,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/x-www-form-urlencoded',
          },

          body,
        },
      );
  } catch (
    networkError
  ) {
    console.error('');
    console.error(
      'OAUTH NETWORK FAILURE',
    );

    console.error(
      networkError.message,
    );

    process.exitCode =
      1;

    return;
  }

  const result =
    await readBody(
      response,
    );

  if (
    !response.ok ||
    !result.access_token
  ) {
    console.error('');
    console.error(
      'OAUTH AUTHENTICATION FAILED',
    );

    console.error(
      'HTTP status:',
      response.status,
    );

    console.error(
      'Provider error:',
      result.error ||
        'Not supplied',
    );

    console.error(
      'Provider description:',
      result
        .error_description ||
        result.message ||
        'Not supplied',
    );

    console.error('');
    console.error(
      'No access token was issued.',
    );

    console.error(
      'This means the failure exists between the current Flutterwave credentials/account and Flutterwave OAuth — not Posho Creative React code.',
    );

    process.exitCode =
      1;

    return;
  }

  console.log('');
  console.log(
    'OAUTH AUTHENTICATION: SUCCESS',
  );

  console.log(
    'Token type:',
    result.token_type ||
      'Bearer',
  );

  console.log(
    'Expires in:',
    `${result.expires_in || 0} seconds`,
  );

  console.log('');
  console.log(
    'Testing Flutterwave production API...',
  );

  let apiResponse;

  try {
    apiResponse =
      await fetch(
        `${LIVE_API_URL}/customers?page=1&size=1`,
        {
          headers: {
            Authorization:
              `Bearer ${result.access_token}`,

            Accept:
              'application/json',

            'Content-Type':
              'application/json',
          },
        },
      );
  } catch (
    networkError
  ) {
    console.error('');
    console.error(
      'PRODUCTION API NETWORK FAILURE',
    );

    console.error(
      networkError.message,
    );

    process.exitCode =
      1;

    return;
  }

  const apiResult =
    await readBody(
      apiResponse,
    );

  if (
    !apiResponse.ok
  ) {
    console.error('');
    console.error(
      'PRODUCTION API TEST FAILED',
    );

    console.error(
      'HTTP status:',
      apiResponse.status,
    );

    console.error(
      'Provider message:',
      apiResult?.error
        ?.message ||
        apiResult?.message ||
        'Not supplied',
    );

    process.exitCode =
      1;

    return;
  }

  console.log('');
  console.log(
    'PRODUCTION API: SUCCESS',
  );

  console.log('');
  console.log(
    'Flutterwave v4 authentication and the production API are working correctly with this credential pair.',
  );

  console.log('');
}

main().catch(
  (error) => {
    console.error('');
    console.error(
      'DIAGNOSTIC ERROR:',
      error.message,
    );

    process.exitCode =
      1;
  },
);