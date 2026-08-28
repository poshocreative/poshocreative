import { withSupabase } from 'npm:@supabase/server@^1';

type ConfirmPayload = {
  action?: 'prepare' | 'confirm';
  orderId: string;
  fileIds?: string[];
  files?: Array<{
    name: string;
    size: number;
    type?: string;
  }>;
};

const MAX_FILES_PER_UPLOAD = 6;
const MAX_PROJECT_FILES = 30;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const allowedMimeTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function clean(value: unknown, maxLength: number) {
  return typeof value === 'string'
    ? value.trim().slice(0, maxLength)
    : '';
}

function safeFilename(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '') || 'project-file';
}

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

        const action =
          body.action === 'prepare'
            ? 'prepare'
            : 'confirm';

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

        const submittedFiles =
          Array.isArray(body.files)
            ? body.files
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
            .select('id, status, reference, customer_id, project_title')
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

        if (ownedOrder.status === 'cancelled') {
          return Response.json(
            {
              success: false,
              message:
                'Files cannot be added to a cancelled project.',
            },
            {
              status: 409,
            },
          );
        }

        if (action === 'prepare') {
          if (
            submittedFiles.length === 0 ||
            submittedFiles.length > MAX_FILES_PER_UPLOAD
          ) {
            return Response.json(
              {
                success: false,
                message:
                  `Select between 1 and ${MAX_FILES_PER_UPLOAD} files.`,
              },
              {
                status: 400,
              },
            );
          }

          for (const file of submittedFiles) {
            if (
              !file ||
              typeof file.name !== 'string' ||
              typeof file.size !== 'number' ||
              file.size <= 0 ||
              file.size > MAX_FILE_SIZE
            ) {
              return Response.json(
                {
                  success: false,
                  message:
                    'Each selected file must be valid and no larger than 10 MB.',
                },
                {
                  status: 400,
                },
              );
            }

            if (
              file.type &&
              !allowedMimeTypes.has(file.type)
            ) {
              return Response.json(
                {
                  success: false,
                  message:
                    `Unsupported file type: ${clean(file.name, 255)}`,
                },
                {
                  status: 400,
                },
              );
            }
          }

          const {
            count: currentFileCount,
            error: countError,
          } = await ctx.supabaseAdmin
            .from('order_files')
            .select('id', {
              count: 'exact',
              head: true,
            })
            .eq('order_id', orderId);

          if (countError) {
            throw countError;
          }

          if (
            Number(currentFileCount || 0) +
              submittedFiles.length >
            MAX_PROJECT_FILES
          ) {
            return Response.json(
              {
                success: false,
                message:
                  `A project can contain up to ${MAX_PROJECT_FILES} files.`,
              },
              {
                status: 409,
              },
            );
          }

          const uploads: Array<{
            fileId: string;
            clientIndex: number;
            path: string;
            token: string;
          }> = [];
          const preparedIds: string[] = [];

          try {
            for (
              let index = 0;
              index < submittedFiles.length;
              index += 1
            ) {
              const file = submittedFiles[index];
              const storagePath =
                `${userId}/${orderId}/${crypto.randomUUID()}-${safeFilename(file.name)}`;

              const {
                data: fileRecord,
                error: fileError,
              } = await ctx.supabaseAdmin
                .from('order_files')
                .insert({
                  order_id: orderId,
                  bucket_name: 'project-references',
                  storage_path: storagePath,
                  original_name: clean(file.name, 255),
                  mime_type: file.type || null,
                  size_bytes: file.size,
                  upload_status: 'pending',
                  file_role: 'customer_reference',
                })
                .select('id')
                .single();

              if (fileError || !fileRecord) {
                throw fileError || new Error('Unable to prepare project file.');
              }

              preparedIds.push(fileRecord.id);

              const {
                data: signedUpload,
                error: uploadError,
              } = await ctx.supabaseAdmin.storage
                .from('project-references')
                .createSignedUploadUrl(storagePath);

              if (uploadError || !signedUpload) {
                throw uploadError || new Error('Unable to prepare secure file upload.');
              }

              uploads.push({
                fileId: fileRecord.id,
                clientIndex: index,
                path: signedUpload.path,
                token: signedUpload.token,
              });
            }
          } catch (prepareError) {
            if (preparedIds.length > 0) {
              await ctx.supabaseAdmin
                .from('order_files')
                .delete()
                .in('id', preparedIds);
            }

            throw prepareError;
          }

          return Response.json({
            success: true,
            uploads,
          });
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
                original_name,
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

        const newlyUploadedIds: string[] =
          [];

        const missingPendingIds: string[] =
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

            if (file.upload_status !== 'uploaded') {
              newlyUploadedIds.push(file.id);
            }
          } else if (file.upload_status !== 'uploaded') {
            missingPendingIds.push(file.id);
          }
        }

        if (missingPendingIds.length > 0) {
          await ctx.supabaseAdmin
            .from('order_files')
            .delete()
            .eq('order_id', orderId)
            .in('id', missingPendingIds);
        }

        if (newlyUploadedIds.length > 0) {
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
                newlyUploadedIds,
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

        if (newlyUploadedIds.length > 0) {
          await ctx.supabaseAdmin
            .from('notification_events')
            .insert({
              order_id: orderId,
              customer_id: ownedOrder.customer_id,
              channel: 'internal',
              event_type: 'customer_files_added',
              status: 'pending',
              payload: {
                reference: ownedOrder.reference,
                project_title: ownedOrder.project_title,
                file_count: newlyUploadedIds.length,
                message:
                  `${newlyUploadedIds.length} new project file${newlyUploadedIds.length === 1 ? '' : 's'} uploaded by the customer.`,
              },
            });
        }

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
