import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Archive,
  ArrowRight,
  AudioLines,
  Download,
  Eye,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Image,
  PackageCheck,
  Search,
  SlidersHorizontal,
  Video,
} from 'lucide-react';

import Link from '../components/PortalLink';

import BrandLoader from '../components/BrandLoader';

import {
  openProjectFile,
} from '../lib/projectOperations';

import {
  fileCanPreview,
  fileMatchesFilter,
  formatLibraryFileSize,
  getFileKind,
  getFileRoleInfo,
  getMyFileLibrary,
  groupFilesByProject,
  sortLibraryFiles,
  totalLibrarySize,
} from '../lib/fileLibrary';

const filters = [
  {
    id:
      'all',

    label:
      'All files',
  },
  {
    id:
      'deliverable',

    label:
      'Deliverables',
  },
  {
    id:
      'reference',

    label:
      'My references',
  },
  {
    id:
      'asset',

    label:
      'Project assets',
  },
];

function formatDate(
  value,
) {
  if (!value) {
    return 'Date unavailable';
  }

  return new Intl.DateTimeFormat(
    'en-NG',
    {
      day:
        'numeric',

      month:
        'short',

      year:
        'numeric',
    },
  ).format(
    new Date(value),
  );
}

function serviceName(
  value,
) {
  if (!value) {
    return 'Creative project';
  }

  return value
    .replaceAll(
      '-',
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

function FileKindIcon({
  file,
  size = 20,
}) {
  const kind =
    getFileKind(
      file,
    );

  if (
    kind.key ===
    'image'
  ) {
    return (
      <FileImage
        size={size}
      />
    );
  }

  if (
    kind.key ===
    'pdf' ||
    kind.key ===
    'document'
  ) {
    return (
      <FileText
        size={size}
      />
    );
  }

  if (
    kind.key ===
    'spreadsheet'
  ) {
    return (
      <FileSpreadsheet
        size={size}
      />
    );
  }

  if (
    kind.key ===
    'archive'
  ) {
    return (
      <Archive
        size={size}
      />
    );
  }

  if (
    kind.key ===
    'video'
  ) {
    return (
      <Video
        size={size}
      />
    );
  }

  if (
    kind.key ===
    'audio'
  ) {
    return (
      <AudioLines
        size={size}
      />
    );
  }

  return (
    <File
      size={size}
    />
  );
}

export default function DashboardFiles() {
  const [
    files,
    setFiles,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    search,
    setSearch,
  ] =
    useState('');

  const [
    filter,
    setFilter,
  ] =
    useState('all');

  const [
    sort,
    setSort,
  ] =
    useState('newest');

  const [
    busy,
    setBusy,
  ] =
    useState('');

  const [
    error,
    setError,
  ] =
    useState('');

  useEffect(() => {
    document.title =
      'Files | Posho Creative';

    const load =
      async () => {
        try {
          setError('');

          const rows =
            await getMyFileLibrary();

          setFiles(
            rows,
          );
        } catch (
          loadError
        ) {
          console.error(
            loadError,
          );

          setError(
            'Your project files could not be loaded.',
          );
        } finally {
          setLoading(
            false,
          );
        }
      };

    load();
  }, []);

  const metrics =
    useMemo(
      () => ({
        total:
          files.length,

        deliverables:
          files.filter(
            (
              file,
            ) =>
              file.file_role ===
              'deliverable',
          ).length,

        references:
          files.filter(
            (
              file,
            ) =>
              file.file_role ===
              'customer_reference',
          ).length,

        storage:
          totalLibrarySize(
            files,
          ),
      }),
      [
        files,
      ],
    );

  const latestDeliverable =
    useMemo(
      () =>
        files
          .filter(
            (
              file,
            ) =>
              file.file_role ===
              'deliverable',
          )
          .sort(
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
          )[0] ||
        null,
      [
        files,
      ],
    );

  const visibleFiles =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      const rows =
        files.filter(
          (
            file,
          ) => {
            const searchable =
              [
                file
                  .original_name,

                file
                  .mime_type,

                file
                  .file_role,

                file
                  .orders
                  ?.reference,

                file
                  .orders
                  ?.project_title,

                file
                  .orders
                  ?.service_slug,
              ]
                .filter(
                  Boolean,
                )
                .join(' ')
                .toLowerCase();

            const matchesSearch =
              !query ||
              searchable.includes(
                query,
              );

            return (
              matchesSearch &&
              fileMatchesFilter(
                file,
                filter,
              )
            );
          },
        );

      return sortLibraryFiles(
        rows,
        sort,
      );
    }, [
      files,
      search,
      filter,
      sort,
    ]);

  const projectGroups =
    useMemo(
      () =>
        groupFilesByProject(
          visibleFiles,
        ),
      [
        visibleFiles,
      ],
    );

  const handleFile =
    async (
      file,
      mode,
    ) => {
      const key =
        `${file.id}-${mode}`;

      try {
        setBusy(
          key,
        );

        setError('');

        await openProjectFile(
          file,
          {
            download:
              mode ===
              'download',
          },
        );
      } catch (
        fileError
      ) {
        console.error(
          fileError,
        );

        setError(
          mode ===
          'download'
            ? 'This file could not be prepared for download. Please try again.'
            : 'This file could not be opened securely. Please try again.',
        );
      } finally {
        setBusy('');
      }
    };

  if (loading) {
    return (
      <div className="workspace-loading-panel">
        <BrandLoader
          label="Loading your project library..."
        />
      </div>
    );
  }

  const metricCards = [
    {
      label:
        'Files',

      value:
        metrics.total,

      icon:
        FolderKanban,

      type:
        'files',
    },
    {
      label:
        'Deliverables',

      value:
        metrics.deliverables,

      icon:
        PackageCheck,

      type:
        'deliverables',
    },
    {
      label:
        'Your references',

      value:
        metrics.references,

      icon:
        Image,

      type:
        'references',
    },
    {
      label:
        'Library size',

      value:
        formatLibraryFileSize(
          metrics.storage,
        ),

      icon:
        Archive,

      type:
        'storage',
    },
  ];

  return (
    <div className="workspace-view workspace-files-v3 page-reveal">
      <div className="workspace-view-heading workspace-view-heading-v3 workspace-files-heading">
        <div>
          <span className="workspace-kicker">
            FILES
          </span>

          <h2>
            Your complete project library.
          </h2>

          <p>
            Access references, project assets and files delivered by Posho Creative from one secure place.
          </p>
        </div>

        <div className="workspace-files-security">
          <FolderKanban
            size={16}
          />

          Project library
        </div>
      </div>

      <div className="workspace-file-metrics">
        {metricCards.map(
          (
            metric,
          ) => {
            const Icon =
              metric.icon;

            return (
              <article
                key={
                  metric.label
                }
                className={`workspace-file-metric workspace-file-metric-${metric.type}`}
              >
                <div>
                  <Icon
                    size={18}
                  />
                </div>

                <span>
                  {metric.label}
                </span>

                <strong>
                  {metric.value}
                </strong>
              </article>
            );
          },
        )}
      </div>

      {latestDeliverable && (
        <section className="workspace-latest-delivery">
          <div className="workspace-latest-delivery-icon">
            <PackageCheck
              size={24}
            />
          </div>

          <div className="workspace-latest-delivery-copy">
            <span>
              LATEST DELIVERY
            </span>

            <h3>
              {latestDeliverable.original_name}
            </h3>

            <p>
              {latestDeliverable
                .orders
                ?.project_title ||
                'Posho Creative project'}

              {' · '}

              {latestDeliverable
                .orders
                ?.reference}
            </p>
          </div>

          <div className="workspace-latest-delivery-actions">
            {fileCanPreview(
              latestDeliverable,
            ) && (
              <button
                type="button"
                onClick={() =>
                  handleFile(
                    latestDeliverable,
                    'preview',
                  )
                }
                disabled={
                  busy ===
                  `${latestDeliverable.id}-preview`
                }
              >
                <Eye
                  size={15}
                />

                {busy ===
                `${latestDeliverable.id}-preview`
                  ? 'Opening...'
                  : 'View'}
              </button>
            )}

            <button
              type="button"
              className="primary"
              onClick={() =>
                handleFile(
                  latestDeliverable,
                  'download',
                )
              }
              disabled={
                busy ===
                `${latestDeliverable.id}-download`
              }
            >
              <Download
                size={15}
              />

              {busy ===
              `${latestDeliverable.id}-download`
                ? 'Preparing...'
                : 'Download'}
            </button>
          </div>
        </section>
      )}

      <section className="workspace-file-controls">
        <div className="workspace-file-search">
          <Search
            size={17}
          />

          <input
            type="search"
            value={
              search
            }
            onChange={(
              event,
            ) =>
              setSearch(
                event
                  .target
                  .value,
              )
            }
            placeholder="Search file, project or reference..."
          />
        </div>

        <label className="workspace-file-sort">
          <SlidersHorizontal
            size={15}
          />

          <select
            value={
              sort
            }
            onChange={(
              event,
            ) =>
              setSort(
                event
                  .target
                  .value,
              )
            }
          >
            <option value="newest">
              Newest first
            </option>

            <option value="oldest">
              Oldest first
            </option>

            <option value="name">
              File name
            </option>

            <option value="project">
              Project
            </option>
          </select>
        </label>
      </section>

      <div className="workspace-file-filters">
        {filters.map(
          (
            item,
          ) => (
            <button
              type="button"
              key={
                item.id
              }
              className={
                filter ===
                item.id
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setFilter(
                  item.id,
                )
              }
            >
              {item.label}
            </button>
          ),
        )}
      </div>

      {error && (
        <div className="workspace-alert">
          {error}
        </div>
      )}

      {projectGroups.length ===
      0 ? (
        <section className="workspace-panel workspace-files-empty">
          <div>
            <FileText
              size={25}
            />
          </div>

          <h3>
            {files.length ===
            0
              ? 'No project files yet.'
              : 'No files match this view.'}
          </h3>

          <p>
            {files.length ===
            0
              ? 'References and project deliverables will appear here as your work progresses.'
              : 'Try another search term or file category.'}
          </p>

          {files.length ===
            0 && (
            <Link
              to="/dashboard/orders"
              className="button button-primary"
            >
              View projects

              <ArrowRight
                size={16}
              />
            </Link>
          )}
        </section>
      ) : (
        <div className="workspace-file-projects">
          {projectGroups.map(
            (
              project,
              projectIndex,
            ) => (
              <section
                key={
                  project.reference
                }
                className="workspace-file-project-group stagger-item"
                style={{
                  '--stagger-index':
                    projectIndex,
                }}
              >
                <div className="workspace-file-project-heading">
                  <div>
                    <small>
                      {project.reference}
                    </small>

                    <h3>
                      {project.projectTitle}
                    </h3>

                    <p>
                      {serviceName(
                        project.serviceSlug,
                      )}
                    </p>
                  </div>

                  <div className="workspace-file-project-heading-actions">
                    <span>
                      {project.files.length}
                      {' '}
                      {project.files.length ===
                      1
                        ? 'file'
                        : 'files'}
                    </span>

                    {project.reference !==
                      'PROJECT' && (
                      <Link
                        to={`/dashboard/orders/${project.reference}`}
                      >
                        Open project

                        <ArrowRight
                          size={14}
                        />
                      </Link>
                    )}
                  </div>
                </div>

                {project.progressLabel && (
                  <div className="workspace-file-project-progress">
                    <div>
                      <span>
                        {project.progressLabel}
                      </span>

                      <strong>
                        {project.progressPercent}%
                      </strong>
                    </div>

                    <div className="workspace-file-project-progress-track">
                      <div
                        style={{
                          width:
                            `${Math.min(
                              100,
                              Math.max(
                                0,
                                project.progressPercent,
                              ),
                            )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="workspace-file-list-v3">
                  {project.files.map(
                    (
                      file,
                    ) => {
                      const role =
                        getFileRoleInfo(
                          file.file_role,
                        );

                      const kind =
                        getFileKind(
                          file,
                        );

                      const previewKey =
                        `${file.id}-preview`;

                      const downloadKey =
                        `${file.id}-download`;

                      return (
                        <article
                          key={
                            file.id
                          }
                          className={`workspace-file-row-v3 workspace-file-row-${role.key}`}
                        >
                          <div
                            className={`workspace-file-kind workspace-file-kind-${kind.key}`}
                          >
                            <FileKindIcon
                              file={
                                file
                              }
                              size={
                                20
                              }
                            />
                          </div>

                          <div className="workspace-file-main-v3">
                            <div className="workspace-file-title-row">
                              <strong>
                                {file.original_name}
                              </strong>

                              <span
                                className={`workspace-file-role workspace-file-role-${role.key}`}
                              >
                                {role.label}
                              </span>
                            </div>

                            <div className="workspace-file-meta-v3">
                              <span>
                                {kind.label}
                              </span>

                              <span>
                                {formatLibraryFileSize(
                                  file.size_bytes,
                                )}
                              </span>

                              <span>
                                {formatDate(
                                  file.uploaded_at ||
                                    file.created_at,
                                )}
                              </span>
                            </div>

                            <small>
                              {role.description}
                            </small>
                          </div>

                          <div className="workspace-file-actions-v3">
                            {fileCanPreview(
                              file,
                            ) && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleFile(
                                    file,
                                    'preview',
                                  )
                                }
                                disabled={
                                  busy ===
                                  previewKey
                                }
                              >
                                <Eye
                                  size={15}
                                />

                                {busy ===
                                previewKey
                                  ? 'Opening...'
                                  : 'View'}
                              </button>
                            )}

                            <button
                              type="button"
                              className="download"
                              onClick={() =>
                                handleFile(
                                  file,
                                  'download',
                                )
                              }
                              disabled={
                                busy ===
                                downloadKey
                              }
                            >
                              <Download
                                size={15}
                              />

                              {busy ===
                              downloadKey
                                ? 'Preparing...'
                                : 'Download'}
                            </button>
                          </div>
                        </article>
                      );
                    },
                  )}
                </div>
              </section>
            ),
          )}
        </div>
      )}
    </div>
  );
}
