import {
  supabase,
} from './supabase';

export async function getAdminProjectWorkspace(
  orderId,
) {
  if (!orderId) {
    throw new Error(
      'A valid project is required.',
    );
  }

  const [
    projectResult,
    filesResult,
    progressResult,
  ] =
    await Promise.all([
      supabase
        .from(
          'orders',
        )
        .select(`
          id,
          reference,
          project_title,
          status,
          payment_status,
          review_decision,
          progress_percent,
          progress_label,
          progress_message,
          progress_updated_at,
          updated_at
        `)
        .eq(
          'id',
          orderId,
        )
        .maybeSingle(),

      supabase
        .from(
          'order_files',
        )
        .select(`
          id,
          order_id,
          bucket_name,
          storage_path,
          original_name,
          mime_type,
          size_bytes,
          upload_status,
          file_role,
          uploaded_at,
          created_at,
          updated_at
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
          created_by,
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
    projectResult.error
  ) {
    console.error(
      'Admin project state:',
      projectResult.error,
    );

    throw new Error(
      'The current project state could not be loaded.',
    );
  }

  if (
    !projectResult.data
  ) {
    throw new Error(
      'The requested project could not be found.',
    );
  }

  /*
   * Do not silently convert file-query errors into
   * "0 files". Admin must know if attachments could
   * not actually be retrieved.
   */
  if (
    filesResult.error
  ) {
    console.error(
      'Admin project files:',
      filesResult.error,
    );

    throw new Error(
      'Project attachments could not be loaded securely.',
    );
  }

  if (
    progressResult.error
  ) {
    console.error(
      'Admin project progress:',
      progressResult.error,
    );

    throw new Error(
      'Project progress history could not be loaded.',
    );
  }

  return {
    current:
      projectResult.data,

    files:
      filesResult.data ||
      [],

    progressHistory:
      progressResult.data ||
      [],
  };
}

export async function getAdminProjectFileUrl(
  file,
  {
    download = false,
  } = {},
) {
  if (
    !file?.storage_path
  ) {
    throw new Error(
      'This attachment does not have a valid storage location.',
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
    console.error(
      'Admin file access:',
      error,
    );

    throw new Error(
      'A secure link for this attachment could not be prepared.',
    );
  }

  if (!data?.signedUrl) {
    throw new Error(
      'A secure link for this attachment could not be prepared.',
    );
  }

  return data.signedUrl;
}

export function canPreviewAdminProjectFile(
  file,
) {
  const type =
    String(
      file?.mime_type ||
        '',
    ).toLowerCase();

  const name =
    String(
      file?.original_name ||
        '',
    ).toLowerCase();

  return (
    type.startsWith(
      'image/',
    ) ||
    type ===
      'application/pdf' ||
    name.endsWith(
      '.pdf',
    )
  );
}