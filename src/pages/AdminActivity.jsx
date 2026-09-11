import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import BrandLoader from '../components/BrandLoader';
import OpsInbox from '../components/OpsInbox';
import PageHeader from '../components/ui/PageHeader';
import Tabs from '../components/ui/Tabs';
import {
  EmptyState,
  ErrorBlock,
} from '../components/ui/StateBlocks';

import {
  getActivityFeed,
} from '../lib/operations';

import {
  getNotificationTitle,
} from '../lib/notificationCenter';

export default function AdminActivity() {
  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    feed,
    setFeed,
  ] =
    useState([]);

  const [
    filter,
    setFilter,
  ] =
    useState('all');

  const load =
    useCallback(
      async () => {
        try {
          setError('');
          setLoading(
            true,
          );

          setFeed(
            await getActivityFeed({
              limit: 150,
            }),
          );
        } catch (loadError) {
          setError(
            loadError.message ||
              'Activity could not be loaded.',
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [],
    );

  useEffect(() => {
    document.title =
      'Activity | Posho Creative Management';

    load();
  }, [
    load,
  ]);

  const counts =
    useMemo(() => {
      const map = {
        all: feed.length,
        admin: 0,
        notification: 0,
        sales: 0,
      };

      for (const item of feed) {
        if (
          map[
            item.kind
          ] !==
          undefined
        ) {
          map[
            item.kind
          ] += 1;
        }
      }

      return map;
    }, [
      feed,
    ]);

  const visible =
    filter ===
    'all'
      ? feed
      : feed.filter(
          (
            item,
          ) =>
            item.kind ===
            filter,
        );

  if (loading) {
    return (
      <BrandLoader label="Loading activity…" />
    );
  }

  return (
    <div className="admin-view page-reveal">
      <PageHeader
        kicker="Intelligence"
        title="Activity"
        description="Every important operation in one feed — Management actions, customer notifications and sales events."
      />

      {error && (
        <ErrorBlock
          message={
            error
          }
          onRetry={
            load
          }
        />
      )}

      <OpsInbox />

      <Tabs
        tabs={[
          {
            key: 'all',
            label: 'All',
            count:
              counts.all,
          },
          {
            key: 'admin',
            label: 'Management',
            count:
              counts.admin,
          },
          {
            key: 'notification',
            label: 'Notifications',
            count:
              counts.notification,
          },
          {
            key: 'sales',
            label: 'Sales',
            count:
              counts.sales,
          },
        ]}
        active={
          filter
        }
        onChange={
          setFilter
        }
        label="Activity filters"
      />

      {visible.length ===
      0 ? (
        <EmptyState
          title="No activity here yet"
          body="Approvals, payments, automations and sales events appear in this feed."
        />
      ) : (
        <div className="posho-timeline">
          {visible.map(
            (
              item,
              index,
            ) => (
              <div
                key={`${item.kind}-${item.at}-${index}`}
                className="posho-timeline-item"
              >
                <span
                  className="posho-timeline-dot"
                  aria-hidden="true"
                />

                <div className="posho-timeline-body">
                  <strong>
                    {item.kind ===
                    'notification'
                      ? getNotificationTitle(
                          {
                            event_type:
                              item.title,
                          },
                        )
                      : item.title}
                  </strong>

                  {item.detail && (
                    <p className="posho-long-value">
                      {String(
                        item.detail,
                      ).slice(
                        0,
                        300,
                      )}
                    </p>
                  )}

                  <time>
                    {new Date(
                      item.at,
                    ).toLocaleString(
                      'en-NG',
                    )}{' '}
                    ·{' '}
                    {item.kind ===
                    'admin'
                      ? 'Management'
                      : item.kind ===
                          'sales'
                        ? 'Sales'
                        : 'Notification'}
                  </time>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
