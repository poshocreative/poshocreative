import {
  useEffect,
  useState,
} from 'react';

import {
  Bell,
  CheckCircle2,
} from 'lucide-react';

import BrandLoader from '../components/BrandLoader';

import {
  getMyNotifications,
} from '../lib/orders';

function getNotificationTitle(
  eventType,
) {
  const titles = {
    order_created:
      'Project received',

    quote_sent:
      'Your quote is ready',

    payment_received:
      'Payment confirmed',

    project_started:
      'Project started',

    project_completed:
      'Project completed',

    status_changed:
      'Project updated',

    file_uploaded:
      'New project file',

    deliverable_ready:
      'New deliverable ready',
  };

  return (
    titles[eventType] ||
    eventType
      ?.replaceAll('_', ' ')
      ?.replace(
        /\b\w/g,
        (character) =>
          character.toUpperCase(),
      ) ||
    'Project update'
  );
}

function formatDate(value) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'en-NG',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(
    new Date(value),
  );
}

export default function DashboardNotifications() {
  const [
    notifications,
    setNotifications,
  ] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  useEffect(() => {
    document.title =
      'Updates | Posho Creative';

    const loadNotifications =
      async () => {
        try {
          setLoading(true);

          const data =
            await getMyNotifications();

          setNotifications(data);
        } catch (loadError) {
          console.error(
            'Unable to load notifications:',
            loadError,
          );

          setError(
            'We could not load your project updates.',
          );
        } finally {
          setLoading(false);
        }
      };

    loadNotifications();
  }, []);

  if (loading) {
    return (
      <div className="workspace-loading-panel page-reveal">
        <BrandLoader
          label="Loading your updates..."
        />
      </div>
    );
  }

  return (
    <div className="workspace-view page-reveal">
      <div className="workspace-view-heading">
        <div>
          <span className="workspace-kicker">
            UPDATES
          </span>

          <h2>
            Stay connected to every project.
          </h2>
        </div>

        <span className="workspace-count-pill">
          {notifications.length}{' '}
          {notifications.length === 1
            ? 'update'
            : 'updates'}
        </span>
      </div>

      {error && (
        <div className="workspace-alert">
          {error}
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="workspace-empty workspace-panel">
          <div className="workspace-empty-icon">
            <CheckCircle2 size={27} />
          </div>

          <h3>
            You're all caught up.
          </h3>

          <p>
            Important project, payment and
            delivery updates from Posho
            Creative will appear here.
          </p>
        </div>
      ) : (
        <div className="workspace-notification-list">
          {notifications.map(
            (
              notification,
              index,
            ) => (
              <article
                key={notification.id}
                className="workspace-notification stagger-item"
                style={{
                  '--stagger-index':
                    index,
                }}
              >
                <div className="workspace-notification-icon">
                  <Bell size={18} />
                </div>

                <div className="workspace-notification-content">
                  <div className="workspace-notification-title-row">
                    <h3>
                      {getNotificationTitle(
                        notification.event_type,
                      )}
                    </h3>

                    {!notification.read_at && (
                      <span className="workspace-notification-unread">
                        New
                      </span>
                    )}
                  </div>

                  <p>
                    {notification.payload
                      ?.message ||
                      notification.payload
                        ?.project_title ||
                      'There is a new update on your Posho Creative account.'}
                  </p>

                  <time>
                    {formatDate(
                      notification.created_at,
                    )}
                  </time>
                </div>
              </article>
            ),
          )}
        </div>
      )}
    </div>
  );
}