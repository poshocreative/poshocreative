import {
  withSupabase,
} from 'npm:@supabase/server@^1';

const MAX_ATTEMPTS = 5;

const LOCK_MINUTES = 15;

const ACCESS_HOURS = 8;

async function digest(
  value: string,
) {
  const bytes =
    new TextEncoder()
      .encode(value);

  const hash =
    await crypto.subtle.digest(
      'SHA-256',
      bytes,
    );

  return new Uint8Array(
    hash,
  );
}

async function secureEqual(
  first: string,
  second: string,
) {
  const firstHash =
    await digest(first);

  const secondHash =
    await digest(second);

  if (
    firstHash.length !==
    secondHash.length
  ) {
    return false;
  }

  let difference = 0;

  for (
    let index = 0;
    index < firstHash.length;
    index += 1
  ) {
    difference |=
      firstHash[index] ^
      secondHash[index];
  }

  return difference === 0;
}

function json(
  body: Record<
    string,
    unknown
  >,
  status = 200,
) {
  return Response.json(
    body,
    {
      status,
    },
  );
}

export default {
  fetch: withSupabase(
    {
      auth: 'user',
    },

    async (
      req,
      ctx,
    ) => {
      if (
        req.method !==
        'POST'
      ) {
        return json(
          {
            success: false,
            message:
              'Method not allowed.',
          },
          405,
        );
      }

      try {
        const userId =
          ctx.userClaims?.id;

        const email =
          (
            ctx.userClaims
              ?.email ||
            ''
          )
            .trim()
            .toLowerCase();

        const sessionId =
          ctx.jwtClaims
            ?.session_id;

        if (
          !userId ||
          !email ||
          !sessionId
        ) {
          return json(
            {
              success: false,
              message:
                'A valid authenticated session is required.',
            },
            401,
          );
        }

        const configuredAdminEmail =
          (
            Deno.env.get(
              'POSHO_ADMIN_EMAIL',
            ) ||
            'poshocreative@gmail.com'
          )
            .trim()
            .toLowerCase();

        const configuredAccessCode =
          (
            Deno.env.get(
              'POSHO_ADMIN_ACCESS_CODE',
            ) ||
            ''
          ).trim();

        if (
          !configuredAccessCode
        ) {
          console.error(
            'POSHO_ADMIN_ACCESS_CODE is missing.',
          );

          return json(
            {
              success: false,
              message:
                'Administrative access is not configured yet.',
            },
            500,
          );
        }

        if (
          email !==
          configuredAdminEmail
        ) {
          return json(
            {
              success: false,
              message:
                'This account is not authorised for administrative access.',
            },
            403,
          );
        }

        const {
          data:
            adminProfile,
          error:
            adminProfileError,
        } =
          await ctx
            .supabaseAdmin
            .from(
              'admin_profiles',
            )
            .select(`
              user_id,
              role,
              active
            `)
            .eq(
              'user_id',
              userId,
            )
            .maybeSingle();

        if (
          adminProfileError
        ) {
          throw adminProfileError;
        }

        if (
          !adminProfile ||
          !adminProfile.active
        ) {
          return json(
            {
              success: false,
              message:
                'This account is not authorised for administrative access.',
            },
            403,
          );
        }

        const {
          data:
            securityRecord,
          error:
            securityError,
        } =
          await ctx
            .supabaseAdmin
            .from(
              'admin_access_security',
            )
            .select(`
              failed_attempts,
              locked_until
            `)
            .eq(
              'user_id',
              userId,
            )
            .maybeSingle();

        if (
          securityError
        ) {
          throw securityError;
        }

        if (
          securityRecord
            ?.locked_until
        ) {
          const lockedUntil =
            new Date(
              securityRecord
                .locked_until,
            );

          if (
            lockedUntil >
            new Date()
          ) {
            return json(
              {
                success:
                  false,

                locked:
                  true,

                message:
                  'Too many incorrect access attempts. Administrative access is temporarily locked.',

                lockedUntil:
                  lockedUntil
                    .toISOString(),
              },
              429,
            );
          }
        }

        const body =
          await req.json();

        const suppliedCode =
          typeof body?.code ===
          'string'
            ? body.code.trim()
            : '';

        if (
          !suppliedCode
        ) {
          return json(
            {
              success: false,
              message:
                'Enter the administrative access code.',
            },
            400,
          );
        }

        const correct =
          await secureEqual(
            suppliedCode,
            configuredAccessCode,
          );

        if (!correct) {
          const currentAttempts =
            securityRecord
              ?.failed_attempts ||
            0;

          const nextAttempts =
            currentAttempts +
            1;

          const shouldLock =
            nextAttempts >=
            MAX_ATTEMPTS;

          const lockedUntil =
            shouldLock
              ? new Date(
                  Date.now() +
                    LOCK_MINUTES *
                      60 *
                      1000,
                )
                  .toISOString()
              : null;

          await ctx
            .supabaseAdmin
            .from(
              'admin_access_security',
            )
            .upsert(
              {
                user_id:
                  userId,

                failed_attempts:
                  shouldLock
                    ? 0
                    : nextAttempts,

                last_failed_at:
                  new Date()
                    .toISOString(),

                locked_until:
                  lockedUntil,
              },
              {
                onConflict:
                  'user_id',
              },
            );

          if (
            shouldLock
          ) {
            return json(
              {
                success:
                  false,

                locked:
                  true,

                message:
                  'Too many incorrect access attempts. Administrative access has been temporarily locked.',

                lockedUntil,
              },
              429,
            );
          }

          return json(
            {
              success:
                false,

              message:
                'The administrative access code is incorrect.',

              attemptsRemaining:
                MAX_ATTEMPTS -
                nextAttempts,
            },
            401,
          );
        }

        const verifiedAt =
          new Date();

        const expiresAt =
          new Date(
            verifiedAt.getTime() +
              ACCESS_HOURS *
                60 *
                60 *
                1000,
          );

        const {
          error:
            accessError,
        } =
          await ctx
            .supabaseAdmin
            .from(
              'admin_access_sessions',
            )
            .upsert(
              {
                user_id:
                  userId,

                session_id:
                  sessionId,

                verified_at:
                  verifiedAt
                    .toISOString(),

                expires_at:
                  expiresAt
                    .toISOString(),
              },
              {
                onConflict:
                  'user_id',
              },
            );

        if (
          accessError
        ) {
          throw accessError;
        }

        await ctx
          .supabaseAdmin
          .from(
            'admin_access_security',
          )
          .upsert(
            {
              user_id:
                userId,

              failed_attempts:
                0,

              locked_until:
                null,

              last_failed_at:
                null,
            },
            {
              onConflict:
                'user_id',
            },
          );

        return json({
          success: true,

          role:
            adminProfile.role,

          expiresAt:
            expiresAt
              .toISOString(),
        });
      } catch (error) {
        console.error(
          'verify-admin-access error:',
          error,
        );

        return json(
          {
            success: false,

            message:
              'Administrative access could not be verified.',
          },
          500,
        );
      }
    },
  ),
};