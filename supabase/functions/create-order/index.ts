import { withSupabase } from 'npm:@supabase/server@^1';

type FileInput = {
  name: string;
  size: number;
  type?: string;
};

type OrderPayload = {
  serviceSlug: string;
  projectType: string;
  projectTitle: string;
  projectDescription: string;
  projectGoal: string;
  referenceLinks?: string;
  budget: string;
  timeline: string;
  deadline?: string | null;

  customer: {
    fullName: string;
    phone: string;
    businessName?: string;
    preferredContactMethod: string;
  };

  files?: FileInput[];
};

const allowedServices = new Set([
  'website-development',
  'graphic-design',
  'social-media-management',
  'advertising',
  'business-services',
  'creative-solutions',
]);

const allowedBudgets = new Set([
  'not-sure',
  'under-50k',
  '50k-150k',
  '150k-500k',
  '500k-plus',
]);

const allowedTimelines = new Set([
  'flexible',
  'one-week',
  'two-four-weeks',
  'one-three-months',
  'specific-date',
]);

const allowedContactMethods = new Set([
  'whatsapp',
  'email',
  'phone',
]);

const allowedMimeTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const maxFileSize = 10 * 1024 * 1024;
const maxFiles = 6;

function cleanText(
  value: unknown,
  maximumLength: number,
) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .trim()
    .slice(0, maximumLength);
}

function safeFilename(filename: string) {
  const cleaned = filename
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '');

  return cleaned || 'project-file';
}

function generateReference() {
  const date = new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll('-', '');

  const random =
    crypto.randomUUID()
      .split('-')[0]
      .toUpperCase();

  return `PC-${date}-${random}`;
}

function badRequest(message: string) {
  return Response.json(
    {
      success: false,
      message,
    },
    {
      status: 400,
    },
  );
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
            message: 'Method not allowed.',
          },
          {
            status: 405,
          },
        );
      }

      try {
        const userId =
          ctx.userClaims?.id;

        const authenticatedEmail =
          cleanText(
            ctx.userClaims?.email,
            320,
          ).toLowerCase();

        if (
          !userId ||
          !authenticatedEmail
        ) {
          return Response.json(
            {
              success: false,
              message:
                'A valid Posho Creative account is required.',
            },
            {
              status: 401,
            },
          );
        }

        const body =
          (await req.json()) as OrderPayload;

        const serviceSlug =
          cleanText(
            body.serviceSlug,
            100,
          );

        const projectType =
          cleanText(
            body.projectType,
            120,
          );

        const projectTitle =
          cleanText(
            body.projectTitle,
            180,
          );

        const projectDescription =
          cleanText(
            body.projectDescription,
            10000,
          );

        const projectGoal =
          cleanText(
            body.projectGoal,
            5000,
          );

        const referenceLinks =
          cleanText(
            body.referenceLinks,
            5000,
          );

        const budget =
          cleanText(
            body.budget,
            50,
          );

        const timeline =
          cleanText(
            body.timeline,
            50,
          );

        const deadline =
          cleanText(
            body.deadline,
            20,
          ) || null;

        const fullName =
          cleanText(
            body.customer?.fullName,
            180,
          );

        const phone =
          cleanText(
            body.customer?.phone,
            80,
          );

        const businessName =
          cleanText(
            body.customer?.businessName,
            180,
          );

        const preferredContactMethod =
          cleanText(
            body.customer
              ?.preferredContactMethod,
            30,
          );

        if (
          !allowedServices.has(
            serviceSlug,
          )
        ) {
          return badRequest(
            'Choose a valid Posho Creative service.',
          );
        }

        if (!projectType) {
          return badRequest(
            'Choose a project type.',
          );
        }

        if (!projectTitle) {
          return badRequest(
            'Enter a project title.',
          );
        }

        if (
          projectDescription.length < 30
        ) {
          return badRequest(
            'Provide a more detailed project description.',
          );
        }

        if (!projectGoal) {
          return badRequest(
            'Tell us what you want the project to achieve.',
          );
        }

        if (
          !allowedBudgets.has(budget)
        ) {
          return badRequest(
            'Choose a valid budget range.',
          );
        }

        if (
          !allowedTimelines.has(
            timeline,
          )
        ) {
          return badRequest(
            'Choose a valid project timeline.',
          );
        }

        if (
          timeline ===
            'specific-date' &&
          !deadline
        ) {
          return badRequest(
            'Provide your required deadline.',
          );
        }

        if (!fullName) {
          return badRequest(
            'Enter your full name.',
          );
        }

        if (!phone) {
          return badRequest(
            'Enter your phone or WhatsApp number.',
          );
        }

        if (
          !allowedContactMethods.has(
            preferredContactMethod,
          )
        ) {
          return badRequest(
            'Choose a valid contact method.',
          );
        }

        const submittedFiles =
          Array.isArray(body.files)
            ? body.files
            : [];

        if (
          submittedFiles.length >
          maxFiles
        ) {
          return badRequest(
            `A maximum of ${maxFiles} files is allowed.`,
          );
        }

        for (
          const file of
          submittedFiles
        ) {
          if (
            !file ||
            typeof file.name !==
              'string' ||
            typeof file.size !==
              'number'
          ) {
            return badRequest(
              'One or more uploaded files are invalid.',
            );
          }

          if (
            file.size <= 0 ||
            file.size > maxFileSize
          ) {
            return badRequest(
              'Each project file must be 10 MB or smaller.',
            );
          }

          if (
            file.type &&
            !allowedMimeTypes.has(
              file.type,
            )
          ) {
            return badRequest(
              `Unsupported file type: ${file.name}`,
            );
          }
        }

        let {
          data: customer,
          error: customerError,
        } =
          await ctx.supabaseAdmin
            .from('customers')
            .select(
              `
                id,
                user_id,
                full_name,
                email,
                phone,
                business_name,
                preferred_contact_method
              `,
            )
            .eq('user_id', userId)
            .maybeSingle();

        if (
          customerError &&
          customerError.code !==
            'PGRST116'
        ) {
          throw customerError;
        }

        if (!customer) {
          const {
            data: emailCustomer,
          } =
            await ctx.supabaseAdmin
              .from('customers')
              .select(
                `
                  id,
                  user_id,
                  full_name,
                  email,
                  phone,
                  business_name,
                  preferred_contact_method
                `,
              )
              .eq(
                'normalized_email',
                authenticatedEmail,
              )
              .maybeSingle();

          customer =
            emailCustomer ?? null;
        }

        if (customer) {
          const {
            data: updatedCustomer,
            error: updateError,
          } =
            await ctx.supabaseAdmin
              .from('customers')
              .update({
                user_id: userId,
                full_name: fullName,
                phone,
                business_name:
                  businessName ||
                  null,
                preferred_contact_method:
                  preferredContactMethod,
              })
              .eq(
                'id',
                customer.id,
              )
              .select(
                `
                  id,
                  user_id,
                  full_name,
                  email,
                  phone,
                  business_name,
                  preferred_contact_method
                `,
              )
              .single();

          if (updateError) {
            throw updateError;
          }

          customer =
            updatedCustomer;
        } else {
          const {
            data: createdCustomer,
            error: createCustomerError,
          } =
            await ctx.supabaseAdmin
              .from('customers')
              .insert({
                user_id: userId,
                full_name: fullName,
                email:
                  authenticatedEmail,
                phone,
                business_name:
                  businessName ||
                  null,
                preferred_contact_method:
                  preferredContactMethod,
              })
              .select(
                `
                  id,
                  user_id,
                  full_name,
                  email,
                  phone,
                  business_name,
                  preferred_contact_method
                `,
              )
              .single();

          if (
            createCustomerError
          ) {
            throw createCustomerError;
          }

          customer =
            createdCustomer;
        }

        if (!customer) {
          throw new Error(
            'Customer profile could not be prepared.',
          );
        }

        let createdOrder:
          | {
              id: string;
              reference: string;
              status: string;
              created_at: string;
            }
          | null = null;

        let lastOrderError:
          | unknown
          | null = null;

        for (
          let attempt = 0;
          attempt < 3;
          attempt += 1
        ) {
          const reference =
            generateReference();

          const {
            data,
            error,
          } =
            await ctx.supabaseAdmin
              .from('orders')
              .insert({
                reference,

                customer_id:
                  customer.id,

                user_id:
                  userId,

                service_slug:
                  serviceSlug,

                project_type:
                  projectType,

                project_title:
                  projectTitle,

                project_description:
                  projectDescription,

                project_goal:
                  projectGoal,

                reference_links:
                  referenceLinks ||
                  null,

                budget,

                timeline,

                deadline,

                status:
                  'new',

                payment_status:
                  'pending',

                customer_snapshot: {
                  full_name:
                    fullName,

                  email:
                    authenticatedEmail,

                  phone,

                  business_name:
                    businessName ||
                    null,

                  preferred_contact_method:
                    preferredContactMethod,
                },

                last_customer_activity_at:
                  new Date()
                    .toISOString(),
              })
              .select(
                `
                  id,
                  reference,
                  status,
                  created_at
                `,
              )
              .single();

          if (!error) {
            createdOrder =
              data;

            break;
          }

          lastOrderError =
            error;

          if (
            error.code !== '23505'
          ) {
            break;
          }
        }

        if (!createdOrder) {
          console.error(
            'Order creation failed:',
            lastOrderError,
          );

          throw new Error(
            'Your order could not be created.',
          );
        }

        const uploads: Array<{
          fileId: string;
          clientIndex: number;
          originalName: string;
          path: string;
          token: string;
        }> = [];

        try {
          for (
            let index = 0;
            index <
            submittedFiles.length;
            index += 1
          ) {
            const file =
              submittedFiles[index];

            const originalName =
              cleanText(
                file.name,
                255,
              );

            const filename =
              `${crypto.randomUUID()}-${safeFilename(originalName)}`;

            const storagePath =
              `${userId}/${createdOrder.id}/${filename}`;

            const {
              data: fileRecord,
              error:
                fileRecordError,
            } =
              await ctx.supabaseAdmin
                .from('order_files')
                .insert({
                  order_id:
                    createdOrder.id,

                  bucket_name:
                    'project-references',

                  storage_path:
                    storagePath,

                  original_name:
                    originalName,

                  mime_type:
                    file.type ||
                    null,

                  size_bytes:
                    file.size,

                  upload_status:
                    'pending',

                  file_role:
                    'customer_reference',
                })
                .select(
                  `
                    id,
                    storage_path
                  `,
                )
                .single();

            if (
              fileRecordError ||
              !fileRecord
            ) {
              throw (
                fileRecordError ||
                new Error(
                  'Unable to prepare project file.',
                )
              );
            }

            const {
              data: signedUpload,
              error:
                signedUploadError,
            } =
              await ctx.supabaseAdmin
                .storage
                .from(
                  'project-references',
                )
                .createSignedUploadUrl(
                  storagePath,
                );

            if (
              signedUploadError ||
              !signedUpload
            ) {
              throw (
                signedUploadError ||
                new Error(
                  'Unable to prepare secure upload.',
                )
              );
            }

            uploads.push({
              fileId:
                fileRecord.id,

              clientIndex:
                index,

              originalName,

              path:
                signedUpload.path,

              token:
                signedUpload.token,
            });
          }
        } catch (filePreparationError) {
          await ctx.supabaseAdmin
            .from('orders')
            .delete()
            .eq(
              'id',
              createdOrder.id,
            );

          throw filePreparationError;
        }

        await ctx.supabaseAdmin
          .from('notification_events')
          .insert({
            order_id:
              createdOrder.id,

            customer_id:
              customer.id,

            channel:
              'internal',

            event_type:
              'order_created',

            recipient:
              authenticatedEmail,

            status:
              'pending',

            payload: {
              reference:
                createdOrder.reference,

              project_title:
                projectTitle,

              service_slug:
                serviceSlug,
            },
          });

        return Response.json(
          {
            success: true,

            order: {
              id:
                createdOrder.id,

              reference:
                createdOrder.reference,

              status:
                createdOrder.status,

              createdAt:
                createdOrder.created_at,
            },

            uploads,
          },
          {
            status: 201,
          },
        );
      } catch (error) {
        console.error(
          'create-order error:',
          error,
        );

        return Response.json(
          {
            success: false,

            message:
              error instanceof Error
                ? error.message
                : 'An unexpected error occurred while creating the project.',
          },
          {
            status: 500,
          },
        );
      }
    },
  ),
};