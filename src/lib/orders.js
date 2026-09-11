import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

import {
  supabase,
} from './supabase';

async function readableFunctionError(
  error,
  fallback,
) {
  if (
    error instanceof
    FunctionsHttpError
  ) {
    try {
      const response =
        await error.context
          .json();

      return new Error(
        response?.message ||
          fallback,
      );
    } catch {
      return new Error(
        fallback,
      );
    }
  }

  if (
    error instanceof
      FunctionsRelayError ||
    error instanceof
      FunctionsFetchError
  ) {
    return new Error(
      'We could not reach Posho Creative at the moment. Check your connection and try again.',
    );
  }

  return new Error(
    error?.message ||
      fallback,
  );
}

export async function createProjectOrder({
  form,
  files,
  onStageChange,
}) {
  onStageChange?.(
    'Preparing your project request...',
  );

  const {
    data,
    error,
  } =
    await supabase.functions
      .invoke(
        'create-order',
        {
          body: {
            serviceSlug:
              form.service,

            projectType:
              form.projectType,

            projectTitle:
              form.projectTitle,

            projectDescription:
              form.projectDescription,

            projectGoal:
              form.projectGoal,

            referenceLinks:
              form.referenceLinks,

            serviceDetails: {
              platform:
                form.platform ||
                null,

              profileUrl:
                form.profileUrl ||
                null,

              quantity:
                form.serviceQuantity
                  ? Number(
                      form.serviceQuantity,
                    )
                  : null,

              instructions:
                form.serviceInstructions ||
                null,

              adDurationDays:
                form.adDurationDays
                  ? Number(
                      form.adDurationDays,
                    )
                  : null,

              adBudgetKobo:
                form.adBudgetNgn
                  ? Math.round(
                      Number(
                        form.adBudgetNgn,
                      ) *
                        100,
                    )
                  : null,

              adAudience:
                form.adAudience ||
                null,

              adDestinationUrl:
                form.adDestinationUrl ||
                null,
            },

            budget:
              form.budget,

            timeline:
              form.timeline,

            deadline:
              form.deadline ||
              null,

            customer: {
              fullName:
                form.fullName,

              phone:
                form.phone,

              businessName:
                form.businessName,

              preferredContactMethod:
                form.contactMethod,
            },

            files:
              files.map(
                (file) => ({
                  name:
                    file.name,

                  size:
                    file.size,

                  type:
                    file.type,
                }),
              ),
          },
        },
      );

  if (error) {
    throw await readableFunctionError(
      error,
      'Your project request could not be submitted.',
    );
  }

  if (
    !data?.success ||
    !data?.order
  ) {
    throw new Error(
      data?.message ||
        'Your project request could not be submitted.',
    );
  }

  const uploads =
    Array.isArray(
      data.uploads,
    )
      ? data.uploads
      : [];

  const uploadedFileIds =
    [];

  for (
    let index = 0;
    index <
    uploads.length;
    index += 1
  ) {
    const upload =
      uploads[index];

    const source =
      files[
        upload.clientIndex
      ];

    if (!source) {
      continue;
    }

    onStageChange?.(
      `Uploading reference ${index + 1} of ${uploads.length}...`,
    );

    const {
      error:
        uploadError,
    } =
      await supabase
        .storage
        .from(
          'project-references',
        )
        .uploadToSignedUrl(
          upload.path,
          upload.token,
          source,
          {
            contentType:
              source.type ||
              undefined,
          },
        );

    if (uploadError) {
      throw new Error(
        `Your request was created, but "${source.name}" could not be uploaded. Please contact Posho Creative with your project reference.`,
      );
    }

    uploadedFileIds.push(
      upload.fileId,
    );
  }

  if (
    uploadedFileIds.length
  ) {
    onStageChange?.(
      'Finalising your project request...',
    );

    await supabase.functions
      .invoke(
        'confirm-order-files',
        {
          body: {
            orderId:
              data.order.id,

            fileIds:
              uploadedFileIds,
          },
        },
      );
  }

  localStorage.removeItem(
    'poshoCreativeOrderDraft',
  );

  onStageChange?.(
    'Project request submitted.',
  );

  return data.order;
}

export async function uploadProjectFiles({
  orderId,
  files,
  onStageChange,
}) {
  if (!orderId) {
    throw new Error('A valid project is required.');
  }

  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('Select at least one project file.');
  }

  onStageChange?.('Preparing secure uploads...');

  const {
    data: prepared,
    error: prepareError,
  } = await supabase.functions.invoke(
    'confirm-order-files',
    {
      body: {
        action: 'prepare',
        orderId,
        files: files.map((file) => ({
          name: file.name,
          size: file.size,
          type: file.type,
        })),
      },
    },
  );

  if (prepareError) {
    throw await readableFunctionError(
      prepareError,
      'The project files could not be prepared.',
    );
  }

  const uploads =
    Array.isArray(prepared?.uploads)
      ? prepared.uploads
      : [];

  if (!prepared?.success || uploads.length !== files.length) {
    throw new Error(
      prepared?.message ||
        'The secure upload details were incomplete.',
    );
  }

  const uploadedIds = [];
  const failedFiles = [];

  for (let index = 0; index < uploads.length; index += 1) {
    const upload = uploads[index];
    const file = files[upload.clientIndex];

    if (!file) {
      continue;
    }

    onStageChange?.(`Uploading ${index + 1} of ${uploads.length}...`);

    const {
      error: uploadError,
    } = await supabase.storage
      .from('project-references')
      .uploadToSignedUrl(
        upload.path,
        upload.token,
        file,
        {
          contentType: file.type || undefined,
        },
      );

    if (uploadError) {
      failedFiles.push(file);
    } else {
      uploadedIds.push(upload.fileId);
    }
  }

  let confirmed = 0;

  if (uploadedIds.length > 0) {
    onStageChange?.('Confirming uploaded files...');

    const {
      data: confirmation,
      error: confirmationError,
    } = await supabase.functions.invoke(
      'confirm-order-files',
      {
        body: {
          action: 'confirm',
          orderId,
          fileIds: uploads.map((upload) => upload.fileId),
        },
      },
    );

    if (confirmationError) {
      throw await readableFunctionError(
        confirmationError,
        'The uploaded files could not be confirmed.',
      );
    }

    confirmed = Number(confirmation?.confirmed || 0);
  }

  onStageChange?.('Upload complete.');

  return {
    confirmed,
    failedFiles,
  };
}

export async function getMyOrders() {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'orders',
      )
      .select(`
        id,
        reference,
        service_slug,
        project_type,
        project_title,
        project_description,
        project_goal,
        service_details,
        budget,
        timeline,
        deadline,
        status,
        payment_status,
        review_decision,
        reviewed_at,
        decline_reason,
        pricing_type,
        service_price_kobo,
        requires_quote,
        quoted_amount_kobo,
        paid_amount_kobo,
        base_project_price_kobo,
        progress_percent,
        progress_label,
        archived_at,
        customer_action_required,
        customer_action_label,
        submitted_at,
        created_at,
        updated_at
      `)
      .order(
        'created_at',
        {
          ascending:
            false,
        },
      );

  if (error) {
    // Older environments without the newer finance columns fall back
    // to the base select instead of failing the whole workspace.
    if (String(error.code) === '42703' || String(error.message || '').includes('column')) {
      const fallback = await supabase
        .from('orders')
        .select(`
          id,
          reference,
          service_slug,
          project_type,
          project_title,
          project_description,
          project_goal,
          service_details,
          budget,
          timeline,
          deadline,
          status,
          payment_status,
          review_decision,
          reviewed_at,
          decline_reason,
          pricing_type,
          service_price_kobo,
          requires_quote,
          quoted_amount_kobo,
          paid_amount_kobo,
          customer_action_required,
          customer_action_label,
          submitted_at,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false });

      if (fallback.error) {
        throw fallback.error;
      }

      return (fallback.data || []).filter((order) => !order.archived_at);
    }

    throw error;
  }

  // Archived projects are hidden from the client workspace.
  // Filtered client-side so this works before and after the
  // archive columns exist in the database.
  return (data || []).filter((order) => !order.archived_at);
}

export async function getOrderByReference(
  reference,
) {
  const fullSelect = `
        id,
        reference,
        service_slug,
        project_type,
        project_title,
        project_description,
        project_goal,
        reference_links,
        service_details,
        budget,
        timeline,
        deadline,
        status,
        payment_status,
        review_decision,
        reviewed_at,
        decline_reason,
        pricing_type,
        service_price_kobo,
        requires_quote,
        quoted_amount_kobo,
        paid_amount_kobo,
        base_project_price_kobo,
        progress_percent,
        progress_label,
        progress_message,
        progress_updated_at,
        project_phase,
        delivered_at,
        completed_at,
        archived_at,
        customer_action_required,
        customer_action_label,
        current_quote_id,
        submitted_at,
        created_at,
        updated_at
      `;

  const legacySelect = `
        id,
        reference,
        service_slug,
        project_type,
        project_title,
        project_description,
        project_goal,
        reference_links,
        service_details,
        budget,
        timeline,
        deadline,
        status,
        payment_status,
        review_decision,
        reviewed_at,
        decline_reason,
        pricing_type,
        service_price_kobo,
        requires_quote,
        quoted_amount_kobo,
        paid_amount_kobo,
        customer_action_required,
        customer_action_label,
        current_quote_id,
        submitted_at,
        created_at,
        updated_at
      `;

  let order;

  const attempt =
    await supabase
      .from(
        'orders',
      )
      .select(
        fullSelect,
      )
      .eq(
        'reference',
        reference,
      )
      .maybeSingle();

  if (attempt.error) {
    const message = String(attempt.error.message || '');

    if (attempt.error.code === '42703' || message.includes('column')) {
      const fallback =
        await supabase
          .from(
            'orders',
          )
          .select(
            legacySelect,
          )
          .eq(
            'reference',
            reference,
          )
          .maybeSingle();

      if (fallback.error) {
        throw fallback.error;
      }

      order = fallback.data;
    } else {
      throw attempt.error;
    }
  } else {
    order = attempt.data;
  }

  if (!order) {
    return null;
  }

  if (order.archived_at) {
    return null;
  }

  const [
    files,
    history,
    notes,
    payments,
    quotes,
    costs,
    progressUpdates,
    partRequests,
    notifications,
  ] =
    await Promise.all([
      supabase
        .from(
          'order_files',
        )
        .select(`
          id,
          storage_path,
          original_name,
          mime_type,
          size_bytes,
          upload_status,
          file_role,
          uploaded_at,
          created_at
        `)
        .eq(
          'order_id',
          order.id,
        )
        .order(
          'created_at',
          {
            ascending:
              true,
          },
        ),

      supabase
        .from(
          'order_status_history',
        )
        .select(`
          id,
          previous_status,
          new_status,
          note,
          created_at
        `)
        .eq(
          'order_id',
          order.id,
        )
        .order(
          'created_at',
          {
            ascending:
              true,
          },
        ),

      supabase
        .from(
          'order_notes',
        )
        .select(`
          id,
          note,
          created_at
        `)
        .eq(
          'order_id',
          order.id,
        )
        .eq(
          'is_internal',
          false,
        )
        .order(
          'created_at',
          {
            ascending:
              false,
          },
        ),

      supabase
        .from(
          'payment_transactions',
        )
        .select(`
          id,
          provider,
          provider_reference,
          amount_kobo,
          base_amount_kobo,
          currency,
          payment_method,
          payment_type,
          payment_scope,
          manual_method,
          manual_reference,
          status,
          verified_at,
          completed_at,
          created_at
        `)
        .eq(
          'order_id',
          order.id,
        )
        .order(
          'created_at',
          {
            ascending:
              false,
          },
        ),

      supabase
        .from(
          'order_quotes',
        )
        .select(`
          id,
          amount_kobo,
          currency,
          status,
          message,
          valid_until,
          sent_at,
          created_at
        `)
        .eq(
          'order_id',
          order.id,
        )
        .order(
          'created_at',
          {
            ascending:
              false,
          },
        ),

      supabase
        .from(
          'project_cost_items',
        )
        .select(`
          id,
          title,
          description,
          amount_kobo,
          status,
          due_at,
          created_at
        `)
        .eq(
          'order_id',
          order.id,
        )
        .order(
          'created_at',
          {
            ascending:
              false,
          },
        ),

      supabase
        .from(
          'project_progress_updates',
        )
        .select(`
          id,
          progress_percent,
          label,
          message,
          created_at
        `)
        .eq(
          'order_id',
          order.id,
        )
        .order(
          'created_at',
          {
            ascending:
              false,
          },
        ),

      supabase
        .from(
          'part_payment_requests',
        )
        .select(`
          id,
          reason,
          requested_amount_kobo,
          status,
          approved_amount_kobo,
          approval_expires_at,
          balance_due_at,
          allow_work_to_start,
          admin_note,
          decline_reason,
          created_at
        `)
        .eq(
          'order_id',
          order.id,
        )
        .order(
          'created_at',
          {
            ascending:
              false,
          },
        ),

      supabase
        .from(
          'notification_events',
        )
        .select(`
          id,
          event_type,
          payload,
          created_at
        `)
        .eq(
          'order_id',
          order.id,
        )
        .order(
          'created_at',
          {
            ascending:
              false,
          },
        )
        .limit(60),
    ]);

  const pick = (result, label) => {
    if (result.error) {
       
      console.error(`Client project ${label} failed:`, result.error);
    }

    return {
      rows: result.data || [],
      error: result.error ? result.error.message : null,
    };
  };

  const filesResult = pick(files, 'files');
  const historyResult = pick(history, 'history');
  const notesResult = pick(notes, 'notes');
  const paymentsResult = pick(payments, 'payments');
  const quotesResult = pick(quotes, 'quotes');
  const costsResult = pick(costs, 'costs');
  const progressResult = pick(progressUpdates, 'progress');
  const partResult = pick(partRequests, 'part-payment requests');
  const notificationsResult = pick(notifications, 'notifications');

  return {
    ...order,

    files: filesResult.rows,

    history: historyResult.rows,

    notes: notesResult.rows,

    payments: paymentsResult.rows,

    quotes: quotesResult.rows,

    costs: costsResult.rows,

    progressUpdates: progressResult.rows,

    partRequests: partResult.rows,

    notificationTrail: notificationsResult.rows,

    loadErrors: {
      files: filesResult.error,
      history: historyResult.error,
      notes: notesResult.error,
      payments: paymentsResult.error,
      quotes: quotesResult.error,
      costs: costsResult.error,
      progress: progressResult.error,
      partRequests: partResult.error,
      notifications: notificationsResult.error,
    },
  };
}

export async function getMyPayments() {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'payment_transactions',
      )
      .select(`
        id,
        order_id,
        provider,
        provider_reference,
        amount_kobo,
        currency,
        payment_method,
        status,
        verified_at,
        created_at,
        orders (
          reference,
          project_title
        )
      `)
      .order(
        'created_at',
        {
          ascending:
            false,
        },
      );

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getPaymentReceipt(
  id,
) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'payment_transactions',
      )
      .select(`
        id,
        provider,
        provider_reference,
        amount_kobo,
        currency,
        payment_method,
        status,
        verified_at,
        created_at,
        orders (
          reference,
          project_title,
          service_slug
        )
      `)
      .eq(
        'id',
        id,
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getMyFiles() {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'order_files',
      )
      .select(`
        id,
        order_id,
        storage_path,
        original_name,
        mime_type,
        size_bytes,
        upload_status,
        file_role,
        uploaded_at,
        created_at,
        orders (
          reference,
          project_title
        )
      `)
      .eq(
        'upload_status',
        'uploaded',
      )
      .order(
        'created_at',
        {
          ascending:
            false,
        },
      );

  if (error) {
    throw error;
  }

  return data || [];
}

export async function downloadProjectFile(
  file,
) {
  const {
    data,
    error,
  } =
    await supabase
      .storage
      .from(
        'project-references',
      )
      .createSignedUrl(
        file.storage_path,
        60,
        {
          download:
            file.original_name,
        },
      );

  if (error) {
    throw error;
  }

  window.location.assign(
    data.signedUrl,
  );
}

export async function getMyNotifications() {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'notification_events',
      )
      .select(`
        id,
        event_type,
        channel,
        status,
        payload,
        read_at,
        created_at,
        order_id
      `)
      .order(
        'created_at',
        {
          ascending:
            false,
        },
      );

  if (error) {
    throw error;
  }

  return data || [];
}

export async function markNotificationRead(
  id,
) {
  const {
    error,
  } =
    await supabase.rpc(
      'mark_my_notification_read',
      {
        p_notification_id:
          id,
      },
    );

  if (error) {
    throw error;
  }
}

export async function updateCustomerProfile({
  userId,
  fullName,
  phone,
  businessName,
  preferredContactMethod,
}) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'customers',
      )
      .update({
        full_name:
          fullName.trim(),

        phone:
          phone.trim(),

        business_name:
          businessName
            .trim() ||
          null,

        preferred_contact_method:
          preferredContactMethod,
      })
      .eq(
        'user_id',
        userId,
      )
      .select()
      .single();

  if (error) {
    throw error;
  }

  await supabase.auth
    .updateUser({
      data: {
        full_name:
          fullName.trim(),

        phone:
          phone.trim(),

        business_name:
          businessName.trim(),
      },
    });

  return data;
}

export function formatOrderStatus(
  value,
) {
  if (!value) {
    return '';
  }

  return value
    .replaceAll(
      '_',
      ' ',
    )
    .replace(
      /\b\w/g,
      (character) =>
        character
          .toUpperCase(),
    );
}

export function formatProjectState(
  order,
) {
  if (
    order
      ?.review_decision ===
    'pending'
  ) {
    return 'Awaiting Review';
  }

  if (
    order
      ?.review_decision ===
    'declined'
  ) {
    return 'Declined';
  }

  return formatOrderStatus(
    order?.status,
  );
}

export function formatMoney(
  amountKobo,
  currency = 'NGN',
) {
  if (
    amountKobo ===
      null ||
    amountKobo ===
      undefined
  ) {
    return 'Not quoted yet';
  }

  return new Intl.NumberFormat(
    'en-NG',
    {
      style:
        'currency',

      currency,

      maximumFractionDigits:
        0,
    },
  ).format(
    Number(
      amountKobo,
    ) / 100,
  );
}
