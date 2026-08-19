import {
  withSupabase,
} from 'npm:@supabase/server@^1';

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

const allowedBudgets =
  new Set([
    'not-sure',
    'under-50k',
    '50k-150k',
    '150k-500k',
    '500k-plus',
  ]);

const allowedTimelines =
  new Set([
    'flexible',
    'one-week',
    'two-four-weeks',
    'one-three-months',
    'specific-date',
  ]);

const allowedContacts =
  new Set([
    'whatsapp',
    'email',
    'phone',
  ]);

const allowedMimeTypes =
  new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]);

const MAX_FILES = 6;

const MAX_FILE_SIZE =
  10 * 1024 * 1024;

function clean(
  value: unknown,
  max: number,
) {
  if (
    typeof value !==
    'string'
  ) {
    return '';
  }

  return value
    .trim()
    .slice(0, max);
}

function safeFilename(
  value: string,
) {
  return (
    value
      .trim()
      .replace(
        /[^a-zA-Z0-9._-]/g,
        '-',
      )
      .replace(
        /-+/g,
        '-',
      )
      .replace(
        /^\.+/,
        '',
      ) ||
    'project-file'
  );
}

function createReference() {
  const date =
    new Date()
      .toISOString()
      .slice(0, 10)
      .replaceAll(
        '-',
        '',
      );

  const random =
    crypto
      .randomUUID()
      .replaceAll(
        '-',
        '',
      )
      .slice(0, 8)
      .toUpperCase();

  return `PC-${date}-${random}`;
}

function responseError(
  message: string,
  status = 400,
) {
  return Response.json(
    {
      success: false,
      message,
    },
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
        return responseError(
          'Method not allowed.',
          405,
        );
      }

      try {
        const userId =
          ctx.userClaims?.id;

        const email =
          clean(
            ctx.userClaims
              ?.email,
            320,
          ).toLowerCase();

        if (
          !userId ||
          !email
        ) {
          return responseError(
            'A verified Posho Creative account is required.',
            401,
          );
        }

        const body =
          (await req.json()) as
            OrderPayload;

        const serviceSlug =
          clean(
            body.serviceSlug,
            100,
          );

        const projectType =
          clean(
            body.projectType,
            120,
          );

        const projectTitle =
          clean(
            body.projectTitle,
            180,
          );

        const projectDescription =
          clean(
            body.projectDescription,
            10000,
          );

        const projectGoal =
          clean(
            body.projectGoal,
            5000,
          );

        const referenceLinks =
          clean(
            body.referenceLinks,
            5000,
          );

        const budget =
          clean(
            body.budget,
            50,
          );

        const timeline =
          clean(
            body.timeline,
            50,
          );

        const deadline =
          clean(
            body.deadline,
            20,
          ) || null;

        const fullName =
          clean(
            body.customer
              ?.fullName,
            180,
          );

        const phone =
          clean(
            body.customer
              ?.phone,
            80,
          );

        const businessName =
          clean(
            body.customer
              ?.businessName,
            180,
          );

        const contactMethod =
          clean(
            body.customer
              ?.preferredContactMethod,
            30,
          );

        if (
          !serviceSlug ||
          !projectType
        ) {
          return responseError(
            'Choose a valid service and project type.',
          );
        }

        if (
          !projectTitle
        ) {
          return responseError(
            'Enter a project title.',
          );
        }

        if (
          projectDescription
            .length < 30
        ) {
          return responseError(
            'Provide a more detailed project description.',
          );
        }

        if (
          !projectGoal
        ) {
          return responseError(
            'Tell us what you want the project to achieve.',
          );
        }

        if (
          !allowedBudgets.has(
            budget,
          )
        ) {
          return responseError(
            'Choose a valid budget range.',
          );
        }

        if (
          !allowedTimelines.has(
            timeline,
          )
        ) {
          return responseError(
            'Choose a valid project timeline.',
          );
        }

        if (
          timeline ===
            'specific-date' &&
          !deadline
        ) {
          return responseError(
            'Provide your required deadline.',
          );
        }

        if (
          !fullName ||
          !phone
        ) {
          return responseError(
            'Your name and phone number are required.',
          );
        }

        if (
          !allowedContacts.has(
            contactMethod,
          )
        ) {
          return responseError(
            'Choose a valid contact method.',
          );
        }

        const {
          data: catalogItem,
          error: catalogError,
        } =
          await ctx
            .supabaseAdmin
            .from(
              'service_catalog',
            )
            .select(`
              id,
              service_slug,
              project_type,
              title,
              pricing_type,
              price_kobo,
              currency,
              active
            `)
            .eq(
              'service_slug',
              serviceSlug,
            )
            .eq(
              'project_type',
              projectType,
            )
            .eq(
              'active',
              true,
            )
            .maybeSingle();

        if (
          catalogError
        ) {
          throw catalogError;
        }

        if (
          !catalogItem
        ) {
          return responseError(
            'That Posho Creative service is not currently available for ordering.',
          );
        }

        const priceKobo =
          catalogItem
            .price_kobo ===
          null
            ? null
            : Number(
                catalogItem
                  .price_kobo,
              );

        const immediatePayment =
          (
            catalogItem
              .pricing_type ===
              'fixed' ||
            catalogItem
              .pricing_type ===
              'monthly'
          ) &&
          priceKobo !== null &&
          priceKobo > 0;

        const requiresQuote =
          !immediatePayment;

        const submittedFiles =
          Array.isArray(
            body.files,
          )
            ? body.files
            : [];

        if (
          submittedFiles.length >
          MAX_FILES
        ) {
          return responseError(
            `A maximum of ${MAX_FILES} files is allowed.`,
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
            return responseError(
              'One or more selected files are invalid.',
            );
          }

          if (
            file.size <= 0 ||
            file.size >
              MAX_FILE_SIZE
          ) {
            return responseError(
              'Each project file must be 10 MB or smaller.',
            );
          }

          if (
            file.type &&
            !allowedMimeTypes.has(
              file.type,
            )
          ) {
            return responseError(
              `Unsupported file type: ${file.name}`,
            );
          }
        }

        let {
          data: customer,
          error: customerError,
        } =
          await ctx
            .supabaseAdmin
            .from(
              'customers',
            )
            .select(`
              id,
              user_id,
              full_name,
              email,
              phone,
              business_name,
              preferred_contact_method
            `)
            .eq(
              'user_id',
              userId,
            )
            .maybeSingle();

        if (
          customerError
        ) {
          throw customerError;
        }

        if (!customer) {
          const {
            data:
              emailCustomer,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'customers',
              )
              .select(`
                id,
                user_id,
                full_name,
                email,
                phone,
                business_name,
                preferred_contact_method
              `)
              .eq(
                'normalized_email',
                email,
              )
              .maybeSingle();

          customer =
            emailCustomer;
        }

        if (customer) {
          const {
            data:
              updatedCustomer,
            error:
              updateCustomerError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'customers',
              )
              .update({
                user_id:
                  userId,

                full_name:
                  fullName,

                phone,

                business_name:
                  businessName ||
                  null,

                preferred_contact_method:
                  contactMethod,
              })
              .eq(
                'id',
                customer.id,
              )
              .select()
              .single();

          if (
            updateCustomerError
          ) {
            throw updateCustomerError;
          }

          customer =
            updatedCustomer;
        } else {
          const {
            data:
              createdCustomer,
            error:
              createCustomerError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'customers',
              )
              .insert({
                user_id:
                  userId,

                full_name:
                  fullName,

                email,

                phone,

                business_name:
                  businessName ||
                  null,

                preferred_contact_method:
                  contactMethod,
              })
              .select()
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

        let order = null;

        for (
          let attempt = 0;
          attempt < 3;
          attempt += 1
        ) {
          const reference =
            createReference();

          const {
            data,
            error,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'orders',
              )
              .insert({
                reference,

                customer_id:
                  customer.id,

                user_id:
                  userId,

                catalog_item_id:
                  catalogItem.id,

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

                pricing_type:
                  catalogItem
                    .pricing_type,

                service_price_kobo:
                  priceKobo,

                requires_quote:
                  requiresQuote,

                quoted_amount_kobo:
                  immediatePayment
                    ? priceKobo
                    : null,

                status:
                  immediatePayment
                    ? 'awaiting_payment'
                    : 'under_review',

                payment_status:
                  'pending',

                customer_action_required:
                  immediatePayment,

                customer_action_label:
                  immediatePayment
                    ? 'Payment available'
                    : null,

                customer_snapshot: {
                  full_name:
                    fullName,

                  email,

                  phone,

                  business_name:
                    businessName ||
                    null,

                  preferred_contact_method:
                    contactMethod,
                },

                last_customer_activity_at:
                  new Date()
                    .toISOString(),
              })
              .select(`
                id,
                reference,
                status,
                payment_status,
                pricing_type,
                service_price_kobo,
                requires_quote,
                quoted_amount_kobo,
                created_at
              `)
              .single();

          if (!error) {
            order = data;
            break;
          }

          if (
            error.code !==
            '23505'
          ) {
            throw error;
          }
        }

        if (!order) {
          throw new Error(
            'Your project could not be created.',
          );
        }

        const uploads: Array<{
          fileId: string;
          clientIndex: number;
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

            const filename =
              `${crypto.randomUUID()}-${safeFilename(file.name)}`;

            const storagePath =
              `${userId}/${order.id}/${filename}`;

            const {
              data:
                fileRecord,
              error:
                fileRecordError,
            } =
              await ctx
                .supabaseAdmin
                .from(
                  'order_files',
                )
                .insert({
                  order_id:
                    order.id,

                  bucket_name:
                    'project-references',

                  storage_path:
                    storagePath,

                  original_name:
                    clean(
                      file.name,
                      255,
                    ),

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
                  'id',
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
              data:
                signedUpload,
              error:
                uploadError,
            } =
              await ctx
                .supabaseAdmin
                .storage
                .from(
                  'project-references',
                )
                .createSignedUploadUrl(
                  storagePath,
                );

            if (
              uploadError ||
              !signedUpload
            ) {
              throw (
                uploadError ||
                new Error(
                  'Unable to prepare secure file upload.',
                )
              );
            }

            uploads.push({
              fileId:
                fileRecord.id,

              clientIndex:
                index,

              path:
                signedUpload.path,

              token:
                signedUpload.token,
            });
          }
        } catch (
          fileError
        ) {
          await ctx
            .supabaseAdmin
            .from(
              'orders',
            )
            .delete()
            .eq(
              'id',
              order.id,
            );

          throw fileError;
        }

        await ctx
          .supabaseAdmin
          .from(
            'notification_events',
          )
          .insert({
            order_id:
              order.id,

            customer_id:
              customer.id,

            channel:
              'internal',

            event_type:
              'order_created',

            recipient:
              email,

            status:
              'pending',

            payload: {
              reference:
                order.reference,

              project_title:
                projectTitle,

              service_title:
                catalogItem.title,

              requires_quote:
                requiresQuote,

              quoted_amount_kobo:
                order
                  .quoted_amount_kobo,
            },
          });

        return Response.json(
          {
            success: true,

            order,

            uploads,
          },
          {
            status: 201,
          },
        );
      } catch (error) {
        console.error(
          'create-order:',
          error,
        );

        return responseError(
          error instanceof Error
            ? error.message
            : 'Your project could not be created.',
          500,
        );
      }
    },
  ),
};