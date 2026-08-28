import {
  supabase,
} from './supabase';

export async function getMyActivityNotifications() {
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
        order_id,
        event_type,
        payload,
        read_at,
        created_at,
        orders (
          reference,
          project_title,
          service_slug,
          status,
          progress_percent,
          progress_label
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

export async function getUnreadNotificationCount() {
  const {
    count,
    error,
  } =
    await supabase
      .from(
        'notification_events',
      )
      .select(
        'id',
        {
          count:
            'exact',

          head:
            true,
        },
      )
      .is(
        'read_at',
        null,
      );

  if (error) {
    throw error;
  }

  return Number(
    count ||
      0,
  );
}

export async function markActivityNotificationRead(
  notificationId,
) {
  if (!notificationId) {
    throw new Error(
      'A valid notification is required.',
    );
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'mark_my_notification_read',
      {
        p_notification_id:
          notificationId,
      },
    );

  if (error) {
    throw new Error(
      error.message ||
        'This update could not be marked as read.',
    );
  }

  return data;
}

export async function markAllActivityNotificationsRead() {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      'mark_all_my_notifications_read',
    );

  if (error) {
    throw new Error(
      error.message ||
        'Your updates could not be marked as read.',
    );
  }

  return data;
}

export function humanizeNotificationValue(
  value,
) {
  if (!value) {
    return '';
  }

  return String(
    value,
  )
    .replaceAll(
      '_',
      ' ',
    )
    .replace(
      /\b\w/g,
      (
        character,
      ) =>
        character
          .toUpperCase(),
    );
}

export function getNotificationCategory(
  eventType,
) {
  const event =
    String(
      eventType ||
        '',
    ).toLowerCase();

  if (
    event.includes(
      'payment',
    ) ||
    event.includes(
      'quote',
    )
  ) {
    return {
      key:
        'payment',

      label:
        'Payment',
    };
  }

  if (
    event.includes(
      'file',
    ) ||
    event.includes(
      'deliverable',
    )
  ) {
    return {
      key:
        'file',

      label:
        'File',
    };
  }

  if (
    event.includes(
      'progress',
    ) ||
    event ===
      'project_update' ||
    event ===
      'status_changed' ||
    event ===
      'project_started' ||
    event ===
      'project_completed'
  ) {
    return {
      key:
        'progress',

      label:
        'Progress',
    };
  }

  if (
    event.includes(
      'order',
    ) ||
    event.includes(
      'project',
    )
  ) {
    return {
      key:
        'project',

      label:
        'Project',
    };
  }

  return {
    key:
      'account',

    label:
      'Account',
  };
}

export function getNotificationTitle(
  notification,
) {
  const eventType =
    notification
      ?.event_type;

  const titles = {
    order_created:
      'Project request received',

    order_approved:
      'Project approved',

    order_declined:
      'Project request declined',

    quote_sent:
      'Quote ready for payment',

    payment_received:
      'Payment confirmed',

    payment_failed:
      'Payment unsuccessful',

    part_payment_requested:
      'Part-payment request submitted',

    part_payment_approved:
      'Part-payment approved',

    part_payment_declined:
      'Part-payment request declined',

    project_started:
      'Project work started',

    project_completed:
      'Project completed',

    status_changed:
      'Project status updated',

    project_update:
      'New project update',

    project_progress_updated:
      'Project progress updated',

    file_uploaded:
      'New project file',

    deliverable_ready:
      'New deliverable ready',
  };

  return (
    titles[
      eventType
    ] ||
    humanizeNotificationValue(
      eventType,
    ) ||
    'Account update'
  );
}

export function getNotificationMessage(
  notification,
) {
  const payload =
    notification
      ?.payload ||
    {};

  const order =
    notification
      ?.orders ||
    {};

  if (
    notification?.event_type ===
    'part_payment_requested'
  ) {
    return payload.requested_amount_kobo
      ? `Your request to pay ${new Intl.NumberFormat('en-NG', {
          style: 'currency',
          currency: 'NGN',
          maximumFractionDigits: 2,
        }).format(Number(payload.requested_amount_kobo) / 100)} has been sent to Management.`
      : 'Your part-payment request has been sent to Management for review.';
  }

  if (
    notification?.event_type ===
    'part_payment_approved'
  ) {
    const amount = payload.approved_amount_kobo
      ? new Intl.NumberFormat('en-NG', {
          style: 'currency',
          currency: 'NGN',
          maximumFractionDigits: 2,
        }).format(Number(payload.approved_amount_kobo) / 100)
      : 'your requested installment';

    const note =
      typeof payload.message === 'string' && payload.message.trim()
        ? ` Management note: ${payload.message.trim()}`
        : '';

    return `Management approved ${amount}. Secure payment is now available in your workspace.${note}`;
  }

  if (
    notification?.event_type ===
    'part_payment_declined'
  ) {
    return payload.reason
      ? `Management declined this request: ${payload.reason}`
      : 'Management declined this part-payment request. Open your payment workspace for details.';
  }

  if (
    typeof payload
      .message ===
      'string' &&
    payload
      .message
      .trim()
  ) {
    return payload
      .message
      .trim();
  }

  if (
    typeof payload
      .reason ===
      'string' &&
    payload
      .reason
      .trim()
  ) {
    return payload
      .reason
      .trim();
  }

  if (
    notification
      ?.event_type ===
    'project_progress_updated'
  ) {
    const percent =
      payload
        .progress_percent ??
      order
        .progress_percent ??
      0;

    const milestone =
      payload
        .progress_label ||
      order
        .progress_label ||
      'Project progress';

    return `${milestone} is now ${percent}% complete.`;
  }

  if (
    notification
      ?.event_type ===
    'order_approved'
  ) {
    return payload
      .payment_ready
      ? 'Your project has been approved and is ready for payment.'
      : 'Your project request has been approved. We are preparing the next step.';
  }

  if (
    notification
      ?.event_type ===
    'order_declined'
  ) {
    return 'Posho Creative has completed its review of this project request.';
  }

  if (
    notification
      ?.event_type ===
    'quote_sent'
  ) {
    return 'Your project quotation is ready for review and payment.';
  }

  if (
    notification
      ?.event_type ===
    'payment_received'
  ) {
    return 'Your payment has been successfully confirmed.';
  }

  if (
    notification
      ?.event_type ===
    'status_changed'
  ) {
    return payload.status
      ? `Your project status is now ${humanizeNotificationValue(
          payload.status,
        )}.`
      : 'The status of your project has been updated.';
  }

  if (
    notification
      ?.event_type ===
    'deliverable_ready'
  ) {
    return 'A new completed file is ready in your project library.';
  }

  if (
    notification
      ?.event_type ===
    'file_uploaded'
  ) {
    return 'A new file has been added to your project library.';
  }

  return (
    payload
      .project_title ||
    order
      .project_title ||
    'There is a new update on your Posho Creative account.'
  );
}

export function getNotificationDestination(
  notification,
) {
  const category =
    getNotificationCategory(
      notification
        ?.event_type,
    );

  const reference =
    notification
      ?.orders
      ?.reference ||
    notification
      ?.payload
      ?.reference;

  if (
    category.key ===
    'payment'
  ) {
    return {
      path:
        '/dashboard/payments',

      label:
        'View payments',
    };
  }

  if (
    category.key ===
    'file'
  ) {
    return {
      path:
        '/dashboard/files',

      label:
        'View files',
    };
  }

  if (
    reference
  ) {
    return {
      path:
        `/dashboard/orders/${reference}`,

      label:
        'Open project',
    };
  }

  if (
    category.key ===
      'project' ||
    category.key ===
      'progress'
  ) {
    return {
      path:
        '/dashboard/orders',

      label:
        'View projects',
    };
  }

  return {
    path:
      '/dashboard',

    label:
      'Open workspace',
  };
}

export function notificationMatchesFilter(
  notification,
  filter,
) {
  if (
    filter ===
    'all'
  ) {
    return true;
  }

  if (
    filter ===
    'unread'
  ) {
    return (
      !notification
        .read_at
    );
  }

  return (
    getNotificationCategory(
      notification
        .event_type,
    ).key ===
    filter
  );
}

export function getNotificationSearchText(
  notification,
) {
  return [
    notification
      ?.event_type,

    notification
      ?.orders
      ?.reference,

    notification
      ?.orders
      ?.project_title,

    notification
      ?.orders
      ?.service_slug,

    notification
      ?.payload
      ?.project_title,

    notification
      ?.payload
      ?.reference,

    notification
      ?.payload
      ?.message,

    notification
      ?.payload
      ?.reason,

    getNotificationTitle(
      notification,
    ),

    getNotificationMessage(
      notification,
    ),
  ]
    .filter(
      Boolean,
    )
    .join(' ')
    .toLowerCase();
}
