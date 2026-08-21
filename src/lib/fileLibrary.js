import {
  supabase,
} from './supabase';

export async function getMyFileLibrary() {
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
        bucket_name,
        storage_path,
        original_name,
        mime_type,
        size_bytes,
        upload_status,
        file_role,
        uploaded_at,
        created_at,
        updated_at,
        orders (
          reference,
          project_title,
          service_slug,
          status,
          progress_percent,
          progress_label,
          updated_at
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

export function getFileRoleInfo(
  role,
) {
  if (
    role ===
    'deliverable'
  ) {
    return {
      key:
        'deliverable',

      label:
        'Deliverable',

      description:
        'Delivered by Posho Creative',
    };
  }

  if (
    role ===
    'project_asset'
  ) {
    return {
      key:
        'asset',

      label:
        'Project asset',

      description:
        'Project working asset',
    };
  }

  return {
    key:
      'reference',

    label:
      'Your reference',

    description:
      'Provided with your project',
  };
}

export function getFileKind(
  file,
) {
  const mimeType =
    String(
      file
        ?.mime_type ||
        '',
    ).toLowerCase();

  const filename =
    String(
      file
        ?.original_name ||
        '',
    ).toLowerCase();

  if (
    mimeType.startsWith(
      'image/',
    )
  ) {
    return {
      key:
        'image',

      label:
        'Image',
    };
  }

  if (
    mimeType ===
      'application/pdf' ||
    filename.endsWith(
      '.pdf',
    )
  ) {
    return {
      key:
        'pdf',

      label:
        'PDF document',
    };
  }

  if (
    mimeType.includes(
      'spreadsheet',
    ) ||
    mimeType.includes(
      'excel',
    ) ||
    filename.endsWith(
      '.xlsx',
    ) ||
    filename.endsWith(
      '.xls',
    ) ||
    filename.endsWith(
      '.csv',
    )
  ) {
    return {
      key:
        'spreadsheet',

      label:
        'Spreadsheet',
    };
  }

  if (
    mimeType.includes(
      'word',
    ) ||
    mimeType.includes(
      'document',
    ) ||
    filename.endsWith(
      '.doc',
    ) ||
    filename.endsWith(
      '.docx',
    )
  ) {
    return {
      key:
        'document',

      label:
        'Document',
    };
  }

  if (
    mimeType.includes(
      'zip',
    ) ||
    mimeType.includes(
      'compressed',
    ) ||
    filename.endsWith(
      '.zip',
    ) ||
    filename.endsWith(
      '.rar',
    ) ||
    filename.endsWith(
      '.7z',
    )
  ) {
    return {
      key:
        'archive',

      label:
        'Archive',
    };
  }

  if (
    mimeType.startsWith(
      'video/',
    )
  ) {
    return {
      key:
        'video',

      label:
        'Video',
    };
  }

  if (
    mimeType.startsWith(
      'audio/',
    )
  ) {
    return {
      key:
        'audio',

      label:
        'Audio',
    };
  }

  return {
    key:
      'file',

    label:
      'File',
  };
}

export function fileCanPreview(
  file,
) {
  const kind =
    getFileKind(
      file,
    );

  return [
    'image',
    'pdf',
    'video',
    'audio',
  ].includes(
    kind.key,
  );
}

export function formatLibraryFileSize(
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

  if (
    megabytes <
    1024
  ) {
    return `${megabytes.toFixed(
      megabytes >= 100
        ? 0
        : megabytes >= 10
          ? 1
          : 2,
    )} MB`;
  }

  const gigabytes =
    megabytes /
    1024;

  return `${gigabytes.toFixed(
    2,
  )} GB`;
}

export function totalLibrarySize(
  files,
) {
  return (
    files ||
    []
  ).reduce(
    (
      total,
      file,
    ) =>
      total +
      Number(
        file
          .size_bytes ||
          0,
      ),
    0,
  );
}

export function fileMatchesFilter(
  file,
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
    'deliverable'
  ) {
    return (
      file
        .file_role ===
      'deliverable'
    );
  }

  if (
    filter ===
    'reference'
  ) {
    return (
      file
        .file_role ===
      'customer_reference'
    );
  }

  if (
    filter ===
    'asset'
  ) {
    return (
      file
        .file_role ===
      'project_asset'
    );
  }

  return true;
}

export function sortLibraryFiles(
  files,
  sort,
) {
  const rows =
    [
      ...files,
    ];

  if (
    sort ===
    'oldest'
  ) {
    return rows.sort(
      (
        first,
        second,
      ) =>
        new Date(
          first.uploaded_at ||
            first.created_at,
        ) -
        new Date(
          second.uploaded_at ||
            second.created_at,
        ),
    );
  }

  if (
    sort ===
    'name'
  ) {
    return rows.sort(
      (
        first,
        second,
      ) =>
        String(
          first.original_name,
        ).localeCompare(
          String(
            second.original_name,
          ),
        ),
    );
  }

  if (
    sort ===
    'project'
  ) {
    return rows.sort(
      (
        first,
        second,
      ) =>
        String(
          first
            .orders
            ?.project_title ||
            '',
        ).localeCompare(
          String(
            second
              .orders
              ?.project_title ||
              '',
          ),
        ),
    );
  }

  return rows.sort(
    (
      first,
      second,
    ) =>
      new Date(
        second.uploaded_at ||
          second.created_at,
      ) -
      new Date(
        first.uploaded_at ||
          first.created_at,
      ),
  );
}

export function groupFilesByProject(
  files,
) {
  const groups =
    new Map();

  for (
    const file of
    files
  ) {
    const projectReference =
      file
        .orders
        ?.reference ||
      file.order_id;

    if (
      !groups.has(
        projectReference,
      )
    ) {
      groups.set(
        projectReference,
        {
          reference:
            file
              .orders
              ?.reference ||
            'PROJECT',

          projectTitle:
            file
              .orders
              ?.project_title ||
            'Posho Creative project',

          serviceSlug:
            file
              .orders
              ?.service_slug ||
            '',

          projectStatus:
            file
              .orders
              ?.status ||
            '',

          progressPercent:
            Number(
              file
                .orders
                ?.progress_percent ||
                0,
            ),

          progressLabel:
            file
              .orders
              ?.progress_label ||
            '',

          files:
            [],
        },
      );
    }

    groups
      .get(
        projectReference,
      )
      .files
      .push(
        file,
      );
  }

  return Array.from(
    groups.values(),
  );
}