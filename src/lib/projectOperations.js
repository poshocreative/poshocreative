import {
  supabase,
} from './supabase';

export async function getProjectProgress(
  orderId,
) {
  if (!orderId) {
    throw new Error(
      'A valid project is required.',
    );
  }

  const [
    currentResult,
    historyResult,
  ] =
    await Promise.all([
      supabase
        .from(
          'orders',
        )
        .select(`
          id,
          progress_percent,
          progress_label,
          progress_message,
          progress_updated_at
        `)
        .eq(
          'id',
          orderId,
        )
        .maybeSingle(),

      supabase
        .from(
          'project_progress_updates',
        )
        .select(`
          id,
          order_id,
          progress_percent,
          progress_label,
          message,
          created_at
        `)
        .eq(
          'order_id',
          orderId,
        )
        .order(
          'created_at',
          {
            ascending:
              false,
          },
        ),
    ]);

  if (
    currentResult.error
  ) {
    throw currentResult.error;
  }

  if (
    historyResult.error
  ) {
    throw historyResult.error;
  }

  return {
    current:
      currentResult.data || {
        progress_percent:
          0,

        progress_label:
          'Awaiting project start',

        progress_message:
          null,

        progress_updated_at:
          null,
      },

    updates:
      historyResult.data ||
      [],
  };
}

export async function updateAdminProjectProgress({
  orderId,
  progressPercent,
  progressLabel,
  message,
}) {
  const percent =
    Number(
      progressPercent,
    );

  if (
    !Number.isInteger(
      percent,
    ) ||
    percent < 0 ||
    percent > 100
  ) {
    throw new Error(
      'Progress must be between 0 and 100 percent.',
    );
  }

  const label =
    String(
      progressLabel ||
        '',
    ).trim();

  const updateMessage =
    String(
      message ||
        '',
    ).trim();

  if (
    label.length <
    3
  ) {
    throw new Error(
      'Provide a clear progress milestone.',
    );
  }

  if (
    updateMessage.length <
    10
  ) {
    throw new Error(
      'Provide a clear customer-facing progress update.',
    );
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'admin_update_project_progress',
      {
        p_order_id:
          orderId,

        p_progress_percent:
          percent,

        p_progress_label:
          label,

        p_message:
          updateMessage,
      },
    );

  if (error) {
    throw new Error(
      error.message ||
        'Project progress could not be updated.',
    );
  }

  if (!data?.success) {
    throw new Error(
      data?.message ||
        'Project progress could not be updated.',
    );
  }

  return data;
}

export async function getProjectFileUrl(
  file,
  {
    download = false,
  } = {},
) {
  if (
    !file?.storage_path
  ) {
    throw new Error(
      'This file does not have a valid storage location.',
    );
  }

  const bucket =
    file.bucket_name ||
    'project-references';

  const options =
    download
      ? {
          download:
            file.original_name ||
            'project-file',
        }
      : undefined;

  const {
    data,
    error,
  } =
    await supabase
      .storage
      .from(
        bucket,
      )
      .createSignedUrl(
        file.storage_path,
        300,
        options,
      );

  if (error) {
    throw error;
  }

  if (!data?.signedUrl) {
    throw new Error(
      'A secure file link could not be prepared.',
    );
  }

  return data.signedUrl;
}

export async function openProjectFile(
  file,
  {
    download = false,
  } = {},
) {
  let previewWindow =
    null;

  if (!download) {
    previewWindow =
      window.open(
        '',
        '_blank',
      );
  }

  try {
    const url =
      await getProjectFileUrl(
        file,
        {
          download,
        },
      );

    if (download) {
      window.location.assign(
        url,
      );

      return;
    }

    if (
      previewWindow &&
      !previewWindow.closed
    ) {
      previewWindow.location.href =
        url;

      return;
    }

    window.location.assign(
      url,
    );
  } catch (error) {
    if (
      previewWindow &&
      !previewWindow.closed
    ) {
      previewWindow.close();
    }

    throw error;
  }
}

export function formatFileSize(
  sizeBytes,
) {
  const bytes =
    Number(
      sizeBytes ||
        0,
    );

  if (
    !Number.isFinite(
      bytes,
    ) ||
    bytes <= 0
  ) {
    return '0 KB';
  }

  if (
    bytes <
    1024
  ) {
    return `${bytes} B`;
  }

  const kilobytes =
    bytes /
    1024;

  if (
    kilobytes <
    1024
  ) {
    return `${kilobytes.toFixed(
      kilobytes >= 100
        ? 0
        : 1,
    )} KB`;
  }

  const megabytes =
    kilobytes /
    1024;

  return `${megabytes.toFixed(
    megabytes >= 10
      ? 1
      : 2,
  )} MB`;
}

export function formatFileRole(
  role,
) {
  if (
    role ===
    'customer_reference'
  ) {
    return 'Customer reference';
  }

  if (
    role ===
    'project_asset'
  ) {
    return 'Project asset';
  }

  if (
    role ===
    'deliverable'
  ) {
    return 'Deliverable';
  }

  return 'Project file';
}

export function describeFileType(
  mimeType,
  filename,
) {
  const type =
    String(
      mimeType ||
        '',
    ).toLowerCase();

  if (
    type.startsWith(
      'image/',
    )
  ) {
    return 'Image';
  }

  if (
    type ===
    'application/pdf'
  ) {
    return 'PDF document';
  }

  if (
    type.includes(
      'word',
    )
  ) {
    return 'Word document';
  }

  const extension =
    String(
      filename ||
        '',
    )
      .split('.')
      .pop()
      ?.toUpperCase();

  return extension
    ? `${extension} file`
    : 'Project file';
}