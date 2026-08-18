import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from '@supabase/supabase-js';

import { supabase } from './supabase';

async function createReadableFunctionError(
  error,
  fallbackMessage,
) {
  if (
    error instanceof
    FunctionsHttpError
  ) {
    try {
      const response =
        await error.context.json();

      return new Error(
        response?.message ||
          fallbackMessage,
      );
    } catch {
      return new Error(
        fallbackMessage,
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
      'We could not reach the Posho Creative server. Check your connection and try again.',
    );
  }

  return new Error(
    error?.message ||
      fallbackMessage,
  );
}

export async function createProjectOrder({
  form,
  files,
  onStageChange,
}) {
  onStageChange?.(
    'Securing your project request...',
  );

  const payload = {
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

    budget:
      form.budget,

    timeline:
      form.timeline,

    deadline:
      form.deadline || null,

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

    files: files.map(
      (file) => ({
        name:
          file.name,

        size:
          file.size,

        type:
          file.type,
      }),
    ),
  };

  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      'create-order',
      {
        body: payload,
      },
    );

  if (error) {
    throw await createReadableFunctionError(
      error,
      'We could not create your project request.',
    );
  }

  if (
    !data?.success ||
    !data?.order
  ) {
    throw new Error(
      data?.message ||
        'We could not create your project request.',
    );
  }

  const uploads =
    Array.isArray(data.uploads)
      ? data.uploads
      : [];

  const uploadedFileIds = [];

  if (uploads.length > 0) {
    onStageChange?.(
      uploads.length === 1
        ? 'Uploading your reference file securely...'
        : `Uploading ${uploads.length} project files securely...`,
    );

    for (
      let index = 0;
      index < uploads.length;
      index += 1
    ) {
      const upload =
        uploads[index];

      const sourceFile =
        files[
          upload.clientIndex
        ];

      if (!sourceFile) {
        throw new Error(
          'A selected project file could not be prepared for upload.',
        );
      }

      onStageChange?.(
        `Uploading file ${index + 1} of ${uploads.length}...`,
      );

      const {
        error: uploadError,
      } =
        await supabase.storage
          .from(
            'project-references',
          )
          .uploadToSignedUrl(
            upload.path,
            upload.token,
            sourceFile,
            {
              contentType:
                sourceFile.type ||
                undefined,

              cacheControl:
                '3600',
            },
          );

      if (uploadError) {
        throw new Error(
          `We created your project, but "${sourceFile.name}" could not be uploaded. You can add the file again from your dashboard.`,
        );
      }

      uploadedFileIds.push(
        upload.fileId,
      );
    }

    onStageChange?.(
      'Finalising your project workspace...',
    );

    const {
      data: confirmationData,
      error: confirmationError,
    } =
      await supabase.functions.invoke(
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

    if (confirmationError) {
      console.error(
        'File confirmation failed:',
        confirmationError,
      );
    }

    if (
      confirmationData &&
      confirmationData.success ===
        false
    ) {
      console.error(
        'File confirmation response:',
        confirmationData,
      );
    }
  }

  onStageChange?.(
    'Your project workspace is ready.',
  );

  return data.order;
}

export async function getMyOrders() {
  const {
    data,
    error,
  } =
    await supabase
      .from('orders')
      .select(`
        id,
        reference,
        service_slug,
        project_type,
        project_title,
        project_description,
        project_goal,
        budget,
        timeline,
        deadline,
        status,
        payment_status,
        quoted_amount_kobo,
        paid_amount_kobo,
        submitted_at,
        created_at,
        updated_at
      `)
      .order(
        'created_at',
        {
          ascending: false,
        },
      );

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getOrderByReference(
  reference,
) {
  const {
    data: order,
    error: orderError,
  } =
    await supabase
      .from('orders')
      .select(`
        id,
        reference,
        service_slug,
        project_type,
        project_title,
        project_description,
        project_goal,
        reference_links,
        budget,
        timeline,
        deadline,
        status,
        payment_status,
        quoted_amount_kobo,
        paid_amount_kobo,
        submitted_at,
        created_at,
        updated_at
      `)
      .eq(
        'reference',
        reference,
      )
      .maybeSingle();

  if (orderError) {
    throw orderError;
  }

  if (!order) {
    return null;
  }

  const [
    filesResult,
    historyResult,
    notesResult,
    paymentsResult,
  ] = await Promise.all([
    supabase
      .from('order_files')
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
          ascending: true,
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
          ascending: true,
        },
      ),

    supabase
      .from('order_notes')
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
          ascending: false,
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
        currency,
        status,
        verified_at,
        created_at
      `)
      .eq(
        'order_id',
        order.id,
      )
      .order(
        'created_at',
        {
          ascending: false,
        },
      ),
  ]);

  return {
    ...order,

    files:
      filesResult.data || [],

    history:
      historyResult.data || [],

    notes:
      notesResult.data || [],

    payments:
      paymentsResult.data || [],
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
          ascending: false,
        },
      );

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getMyFiles() {
  const {
    data,
    error,
  } =
    await supabase
      .from('order_files')
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
          ascending: false,
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
    await supabase.storage
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

  if (!data?.signedUrl) {
    throw new Error(
      'A secure download link could not be created.',
    );
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
          ascending: false,
        },
      );

  if (error) {
    throw error;
  }

  return data || [];
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
      .from('customers')
      .update({
        full_name:
          fullName.trim(),

        phone:
          phone.trim(),

        business_name:
          businessName.trim() ||
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

  const {
    error: authError,
  } =
    await supabase.auth.updateUser({
      data: {
        full_name:
          fullName.trim(),

        phone:
          phone.trim(),

        business_name:
          businessName.trim(),
      },
    });

  if (authError) {
    console.error(
      'Auth metadata update failed:',
      authError,
    );
  }

  return data;
}

export function formatOrderStatus(
  status,
) {
  if (!status) {
    return '';
  }

  return status
    .replaceAll('_', ' ')
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

export function formatMoney(
  amountKobo,
  currency = 'NGN',
) {
  if (
    amountKobo === null ||
    amountKobo === undefined
  ) {
    return 'Not quoted yet';
  }

  return new Intl.NumberFormat(
    'en-NG',
    {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    },
  ).format(
    Number(amountKobo) /
      100,
  );
}