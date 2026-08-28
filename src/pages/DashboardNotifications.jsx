import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertCircle,
  ArrowRight,
  Bell,
  Check,
  CheckCheck,
  CircleDollarSign,
  Clock3,
  FileText,
  FolderKanban,
  Gauge,
  PackageCheck,
  RefreshCw,
  Search,
} from 'lucide-react';

import {
  useNavigate,
} from 'react-router-dom';

import BrandLoader from '../components/BrandLoader';

import {
  useAuth,
} from '../context/AuthContext';

import {
  formatMoney,
} from '../lib/orders';

import {
  getMyActivityNotifications,
  getNotificationCategory,
  getNotificationDestination,
  getNotificationMessage,
  getNotificationSearchText,
  getNotificationTitle,
  humanizeNotificationValue,
  markActivityNotificationRead,
  markAllActivityNotificationsRead,
  notificationMatchesFilter,
} from '../lib/notificationCenter';

import {
  resolvePortalPath,
} from '../lib/portalSession';

const filters = [
  {
    id:
      'all',

    label:
      'All',
  },
  {
    id:
      'unread',

    label:
      'Unread',
  },
  {
    id:
      'project',

    label:
      'Projects',
  },
  {
    id:
      'progress',

    label:
      'Progress',
  },
  {
    id:
      'payment',

    label:
      'Payments',
  },
  {
    id:
      'file',

    label:
      'Files',
  },
];

function formatDateTime(
  value,
) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'en-NG',
    {
      dateStyle:
        'medium',

      timeStyle:
        'short',
    },
  ).format(
    new Date(value),
  );
}

function formatTime(
  value,
) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'en-NG',
    {
      hour:
        'numeric',

      minute:
        '2-digit',
    },
  ).format(
    new Date(value),
  );
}

function dateKey(
  value,
) {
  const date =
    new Date(value);

  return [
    date.getFullYear(),
    String(
      date.getMonth() +
        1,
    ).padStart(
      2,
      '0',
    ),
    String(
      date.getDate(),
    ).padStart(
      2,
      '0',
    ),
  ].join('-');
}

function getDateGroupLabel(
  value,
) {
  const date =
    new Date(value);

  const today =
    new Date();

  const yesterday =
    new Date();

  yesterday.setDate(
    yesterday.getDate() -
      1,
  );

  if (
    dateKey(
      date,
    ) ===
    dateKey(
      today,
    )
  ) {
    return 'Today';
  }

  if (
    dateKey(
      date,
    ) ===
    dateKey(
      yesterday,
    )
  ) {
    return 'Yesterday';
  }

  return new Intl.DateTimeFormat(
    'en-NG',
    {
      weekday:
        'long',

      day:
        'numeric',

      month:
        'long',

      year:
        'numeric',
    },
  ).format(
    date,
  );
}

function NotificationIcon({
  category,
}) {
  if (
    category ===
    'payment'
  ) {
    return (
      <CircleDollarSign
        size={19}
      />
    );
  }

  if (
    category ===
    'file'
  ) {
    return (
      <PackageCheck
        size={19}
      />
    );
  }

  if (
    category ===
    'progress'
  ) {
    return (
      <Gauge
        size={19}
      />
    );
  }

  if (
    category ===
    'project'
  ) {
    return (
      <FolderKanban
        size={19}
      />
    );
  }

  return (
    <Bell
      size={19}
    />
  );
}

export default function DashboardNotifications() {
  const navigate =
    useNavigate();

  const {
    portalRoutes,
  } = useAuth();

  const [
    notifications,
    setNotifications,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    busyId,
    setBusyId,
  ] =
    useState('');

  const [
    markingAll,
    setMarkingAll,
  ] =
    useState(false);

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
    error,
    setError,
  ] =
    useState('');

  const [
    message,
    setMessage,
  ] =
    useState('');

  const notifyShell =
    useCallback(() => {
      window.dispatchEvent(
        new CustomEvent(
          'posho:notifications-changed',
        ),
      );
    }, []);

  const loadNotifications =
    useCallback(async ({
      showRefresh =
        false,
    } = {}) => {
      try {
        if (
          showRefresh
        ) {
          setRefreshing(
            true,
          );
        }

        setError('');

        const data =
          await getMyActivityNotifications();

        setNotifications(
          data,
        );

        notifyShell();
      } catch (
        loadError
      ) {
        console.error(
          'Unable to load notifications:',
          loadError,
        );

        setError(
          'We could not load your project updates.',
        );
      } finally {
        setLoading(
          false,
        );

        setRefreshing(
          false,
        );
      }
    }, [
      notifyShell,
    ]);

  useEffect(() => {
    document.title =
      'Updates | Posho Creative';

    loadNotifications();
  }, [
    loadNotifications,
  ]);

  const metrics =
    useMemo(() => {
      const unread =
        notifications.filter(
          (
            notification,
          ) =>
            !notification
              .read_at,
        ).length;

      const project =
        notifications.filter(
          (
            notification,
          ) =>
            [
              'project',
              'progress',
            ].includes(
              getNotificationCategory(
                notification
                  .event_type,
              ).key,
            ),
        ).length;

      const payments =
        notifications.filter(
          (
            notification,
          ) =>
            getNotificationCategory(
              notification
                .event_type,
            ).key ===
            'payment',
        ).length;

      const files =
        notifications.filter(
          (
            notification,
          ) =>
            getNotificationCategory(
              notification
                .event_type,
            ).key ===
            'file',
        ).length;

      return {
        total:
          notifications.length,

        unread,

        project,

        payments,

        files,
      };
    }, [
      notifications,
    ]);

  const visibleNotifications =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return notifications.filter(
        (
          notification,
        ) => {
          const matchesSearch =
            !query ||
            getNotificationSearchText(
              notification,
            ).includes(
              query,
            );

          return (
            matchesSearch &&
            notificationMatchesFilter(
              notification,
              filter,
            )
          );
        },
      );
    }, [
      notifications,
      search,
      filter,
    ]);

  const groupedNotifications =
    useMemo(() => {
      const groups =
        [];

      const groupMap =
        new Map();

      for (
        const notification of
        visibleNotifications
      ) {
        const label =
          getDateGroupLabel(
            notification
              .created_at,
          );

        if (
          !groupMap.has(
            label,
          )
        ) {
          const group = {
            label,
            notifications:
              [],
          };

          groupMap.set(
            label,
            group,
          );

          groups.push(
            group,
          );
        }

        groupMap
          .get(
            label,
          )
          .notifications
          .push(
            notification,
          );
      }

      return groups;
    }, [
      visibleNotifications,
    ]);

  const markOneRead =
    async (
      notification,
    ) => {
      if (
        notification
          .read_at
      ) {
        return true;
      }

      try {
        setBusyId(
          notification.id,
        );

        setError('');

        await markActivityNotificationRead(
          notification.id,
        );

        const now =
          new Date()
            .toISOString();

        setNotifications(
          (
            current,
          ) =>
            current.map(
              (
                item,
              ) =>
                item.id ===
                notification.id
                  ? {
                      ...item,
                      read_at:
                        now,
                    }
                  : item,
            ),
        );

        notifyShell();

        return true;
      } catch (
        readError
      ) {
        console.error(
          readError,
        );

        setError(
          readError.message ||
            'This update could not be marked as read.',
        );

        return false;
      } finally {
        setBusyId('');
      }
    };

  const openNotification =
    async (
      notification,
    ) => {
      const success =
        await markOneRead(
          notification,
        );

      if (
        !success &&
        !notification
          .read_at
      ) {
        return;
      }

      const destination =
        getNotificationDestination(
          notification,
        );

      navigate(
        resolvePortalPath(
          destination.path,
          portalRoutes,
        ),
      );
    };

  const markAllRead =
    async () => {
      if (
        metrics.unread ===
        0
      ) {
        return;
      }

      try {
        setMarkingAll(
          true,
        );

        setError('');
        setMessage('');

        const result =
          await markAllActivityNotificationsRead();

        const now =
          new Date()
            .toISOString();

        setNotifications(
          (
            current,
          ) =>
            current.map(
              (
                notification,
              ) => ({
                ...notification,

                read_at:
                  notification
                    .read_at ||
                  now,
              }),
            ),
        );

        setMessage(
          Number(
            result
              ?.updated_count ||
              0,
          ) ===
          1
            ? '1 update marked as read.'
            : `${Number(
                result
                  ?.updated_count ||
                  0,
              )} updates marked as read.`,
        );

        notifyShell();
      } catch (
        markError
      ) {
        console.error(
          markError,
        );

        setError(
          markError.message ||
            'Your updates could not be marked as read.',
        );
      } finally {
        setMarkingAll(
          false,
        );
      }
    };

  if (loading) {
    return (
      <div className="workspace-loading-panel page-reveal">
        <BrandLoader
          label="Loading your updates..."
        />
      </div>
    );
  }

  const metricCards = [
    {
      label:
        'All updates',

      value:
        metrics.total,

      icon:
        Bell,

      type:
        'all',
    },
    {
      label:
        'Unread',

      value:
        metrics.unread,

      icon:
        Clock3,

      type:
        'unread',
    },
    {
      label:
        'Project activity',

      value:
        metrics.project,

      icon:
        Gauge,

      type:
        'project',
    },
    {
      label:
        'Payments & files',

      value:
        metrics.payments +
        metrics.files,

      icon:
        FileText,

      type:
        'commerce',
    },
  ];

  return (
    <div className="workspace-view workspace-updates-v3 page-reveal">
      <div className="workspace-view-heading workspace-view-heading-v3 workspace-updates-heading">
        <div>
          <span className="workspace-kicker">
            UPDATES
          </span>

          <h2>
            Everything happening across your work.
          </h2>

          <p>
            Follow project decisions, progress, payments, files and important account activity from one timeline.
          </p>
        </div>

        <div className="workspace-updates-heading-actions">
          <button
            type="button"
            className="workspace-updates-refresh"
            onClick={() =>
              loadNotifications({
                showRefresh:
                  true,
              })
            }
            disabled={
              refreshing
            }
          >
            <RefreshCw
              size={15}
            />

            {refreshing
              ? 'Refreshing...'
              : 'Refresh'}
          </button>

          {metrics.unread >
            0 && (
            <button
              type="button"
              className="workspace-updates-mark-all"
              onClick={
                markAllRead
              }
              disabled={
                markingAll
              }
            >
              <CheckCheck
                size={16}
              />

              {markingAll
                ? 'Marking...'
                : 'Mark all read'}
            </button>
          )}
        </div>
      </div>

      <div className="workspace-update-metrics">
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
                className={`workspace-update-metric workspace-update-metric-${metric.type}`}
              >
                <div>
                  <Icon
                    size={17}
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

      {metrics.unread >
        0 && (
        <section className="workspace-unread-summary">
          <div>
            <Bell
              size={19}
            />

            <div>
              <span>
                UNREAD ACTIVITY
              </span>

              <strong>
                {metrics.unread ===
                1
                  ? 'You have 1 update waiting.'
                  : `You have ${metrics.unread} updates waiting.`}
              </strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setFilter(
                'unread',
              )
            }
          >
            Show unread

            <ArrowRight
              size={14}
            />
          </button>
        </section>
      )}

      <section className="workspace-update-controls">
        <div className="workspace-update-search">
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
            placeholder="Search project, payment or update..."
          />
        </div>

        <div className="workspace-update-filters">
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

                {item.id ===
                  'unread' &&
                  metrics.unread >
                    0 && (
                    <span>
                      {metrics.unread}
                    </span>
                  )}
              </button>
            ),
          )}
        </div>
      </section>

      {error && (
        <div className="workspace-alert">
          <AlertCircle
            size={16}
          />

          {error}
        </div>
      )}

      {message && (
        <div className="workspace-success-message">
          <Check
            size={16}
          />

          {message}
        </div>
      )}

      {visibleNotifications.length ===
      0 ? (
        <section className="workspace-panel workspace-updates-empty">
          <div>
            <CheckCheck
              size={25}
            />
          </div>

          <h3>
            {notifications.length ===
            0
              ? 'You’re all caught up.'
              : 'No updates match this view.'}
          </h3>

          <p>
            {notifications.length ===
            0
              ? 'Project, payment and delivery activity from Posho Creative will appear here.'
              : 'Try another search term or activity filter.'}
          </p>
        </section>
      ) : (
        <div className="workspace-activity-timeline">
          {groupedNotifications.map(
            (
              group,
            ) => (
              <section
                key={
                  group.label
                }
                className="workspace-activity-day"
              >
                <div className="workspace-activity-day-heading">
                  <span>
                    {group.label}
                  </span>

                  <div />
                </div>

                <div className="workspace-activity-day-list">
                  {group.notifications.map(
                    (
                      notification,
                      index,
                    ) => {
                      const category =
                        getNotificationCategory(
                          notification
                            .event_type,
                        );

                      const destination =
                        getNotificationDestination(
                          notification,
                        );

                      const title =
                        getNotificationTitle(
                          notification,
                        );

                      const body =
                        getNotificationMessage(
                          notification,
                        );

                      const unread =
                        !notification
                          .read_at;

                      const payload =
                        notification
                          .payload ||
                        {};

                      const reference =
                        notification
                          .orders
                          ?.reference ||
                        payload
                          .reference;

                      const projectTitle =
                        notification
                          .orders
                          ?.project_title ||
                        payload
                          .project_title;

                      return (
                        <article
                          key={
                            notification.id
                          }
                          className={[
                            'workspace-activity-card',
                            `workspace-activity-card-${category.key}`,
                            unread
                              ? 'workspace-activity-card-unread'
                              : '',
                            'stagger-item',
                          ]
                            .filter(
                              Boolean,
                            )
                            .join(
                              ' ',
                            )}
                          style={{
                            '--stagger-index':
                              index,
                          }}
                        >
                          <div
                            className={`workspace-activity-icon workspace-activity-icon-${category.key}`}
                          >
                            <NotificationIcon
                              category={
                                category.key
                              }
                            />
                          </div>

                          <div className="workspace-activity-content">
                            <div className="workspace-activity-title-row">
                              <div>
                                <span
                                  className={`workspace-activity-category workspace-activity-category-${category.key}`}
                                >
                                  {category.label}
                                </span>

                                <h3>
                                  {title}
                                </h3>
                              </div>

                              {unread && (
                                <span className="workspace-activity-new">
                                  New
                                </span>
                              )}
                            </div>

                            {projectTitle && (
                              <div className="workspace-activity-project">
                                <FolderKanban
                                  size={13}
                                />

                                <strong>
                                  {projectTitle}
                                </strong>

                                {reference && (
                                  <span>
                                    {reference}
                                  </span>
                                )}
                              </div>
                            )}

                            <p className="workspace-activity-message">
                              {body}
                            </p>

                            <div className="workspace-activity-context">
                              {payload
                                .progress_percent !==
                                undefined &&
                                payload
                                  .progress_percent !==
                                  null && (
                                  <span>
                                    <Gauge
                                      size={12}
                                    />

                                    {payload.progress_percent}%
                                  </span>
                                )}

                              {payload
                                .amount_kobo !==
                                undefined &&
                                payload
                                  .amount_kobo !==
                                  null && (
                                  <span>
                                    <CircleDollarSign
                                      size={12}
                                    />

                                    {formatMoney(
                                      payload.amount_kobo,
                                    )}
                                  </span>
                                )}

                              {payload.status && (
                                <span>
                                  {humanizeNotificationValue(
                                    payload.status,
                                  )}
                                </span>
                              )}
                            </div>

                            <div className="workspace-activity-footer">
                              <div className="workspace-activity-time">
                                <Clock3
                                  size={12}
                                />

                                <span>
                                  {formatTime(
                                    notification.created_at,
                                  )}
                                </span>

                                <span>
                                  {formatDateTime(
                                    notification.created_at,
                                  )}
                                </span>
                              </div>

                              <div className="workspace-activity-actions">
                                {unread && (
                                  <button
                                    type="button"
                                    className="workspace-activity-read"
                                    onClick={() =>
                                      markOneRead(
                                        notification,
                                      )
                                    }
                                    disabled={
                                      busyId ===
                                      notification.id
                                    }
                                  >
                                    <Check
                                      size={14}
                                    />

                                    {busyId ===
                                    notification.id
                                      ? 'Saving...'
                                      : 'Mark read'}
                                  </button>
                                )}

                                <button
                                  type="button"
                                  className="workspace-activity-open"
                                  onClick={() =>
                                    openNotification(
                                      notification,
                                    )
                                  }
                                  disabled={
                                    busyId ===
                                    notification.id
                                  }
                                >
                                  {destination.label}

                                  <ArrowRight
                                    size={14}
                                  />
                                </button>
                              </div>
                            </div>
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
