import { withSupabase } from 'npm:@supabase/server@^1';

type ConfirmPayload = {
  orderId: string;
  fileIds: string[];
};

export default {
  fetch: withSupabase(
    {
      auth: 'user',
    },

    async (req, ctx) => {
      if (req.method !== 'POST') {
        return Response.json(
          {
            success: false,
            message:
              'Method not allowed.',
          },
          {
            status: 405,
          },
        );
      }

      try {
        const userId =
          ctx.userClaims?.id;

        if (!userId) {
          return Response.json(
            {
              success: false,
              message:
                'Authentication required.',
            },
            {
              status: 401,
            },
          );
        }

        const body =
          (await req.json()) as ConfirmPayload;

        const orderId =
          typeof body.orderId ===
          'string'
            ? body.orderId.trim()
            : '';

        const fileIds =
          Array.isArray(body.fileIds)
            ? body.fileIds.filter(
                (value) =>
                  typeof value ===
                    'string' &&
                  value.trim(),
              )
            : [];

        if (!orderId) {
          return Response.json(
            {
              success: false,
              message:
                'Order ID is required.',
            },
            {
              status: 400,
            },
          );
        }

        const {
          data: ownedOrder,
          error: orderError,
        } =
          await ctx.supabase
            .from('orders')
            .select('id')
            .eq('id', orderId)
            .maybeSingle();

        if (
          orderError ||
          !ownedOrder
        ) {
          return Response.json(
            {
              success: false,
              message:
                'The project could not be found.',
            },
            {
              status: 404,
            },
          );
        }

        if (fileIds.length === 0) {
          return Response.json({
            success: true,
            confirmed: 0,
          });
        }

        const {
          data: fileRecords,
          error: filesError,
        } =
          await ctx.supabaseAdmin
            .from('order_files')
            .select(
              `
                id,
                order_id,
                storage_path,
                upload_status
              `,
            )
            .eq(
              'order_id',
              orderId,
            )
            .in(
              'id',
              fileIds,
            );

        if (filesError) {
          throw filesError;
        }

        const uploadedIds: string[] =
          [];

        for (
          const file of
          fileRecords || []
        ) {
          const {
            data: exists,
            error: existsError,
          } =
            await ctx.supabaseAdmin
              .storage
              .from(
                'project-references',
              )
              .exists(
                file.storage_path,
              );

          if (
            !existsError &&
            exists === true
          ) {
            uploadedIds.push(
              file.id,
            );
          }
        }

        if (
          uploadedIds.length > 0
        ) {
          const {
            error: updateError,
          } =
            await ctx.supabaseAdmin
              .from('order_files')
              .update({
                upload_status:
                  'uploaded',

                uploaded_at:
                  new Date()
                    .toISOString(),
              })
              .eq(
                'order_id',
                orderId,
              )
              .in(
                'id',
                uploadedIds,
              );

          if (updateError) {
            throw updateError;
          }
        }

        await ctx.supabaseAdmin
          .from('orders')
          .update({
            last_customer_activity_at:
              new Date()
                .toISOString(),
          })
          .eq('id', orderId);

        return Response.json({
          success: true,
          confirmed:
            uploadedIds.length,
        });
      } catch (error) {
        console.error(
          'confirm-order-files error:',
          error,
        );

        return Response.json(
          {
            success: false,

            message:
              error instanceof Error
                ? error.message
                : 'Unable to confirm uploaded files.',
          },
          {
            status: 500,
          },
        );
      }
    },
  ),
};