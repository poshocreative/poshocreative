import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock3,
  FolderKanban,
  RefreshCw,
  UsersRound,
  XCircle,
} from 'lucide-react';

import Link from '../components/PortalLink';

import BrandLoader from '../components/BrandLoader';
import OpsInbox from '../components/OpsInbox';

import {
  getAdminOverview,
} from '../lib/admin';

import {
  getAdminPendingPartPaymentCount,
} from '../lib/projectFinance';

import {
  getMeetings,
} from '../lib/sales';

import {
  getTeam,
} from '../lib/operations';

import {
  getAdminOrders,
} from '../lib/admin';

import {
  buildExecutiveBrief,
} from '../lib/health';

import {
  formatNaira,
} from '../lib/reports';

import {
  formatMoney,
  formatOrderStatus,
} from '../lib/orders';

function displayState(
  order,
) {
  if (
    order
      .review_decision ===
    'pending'
  ) {
    return 'Awaiting Review';
  }

  if (
    order
      .review_decision ===
    'declined'
  ) {
    return 'Declined';
  }

  return formatOrderStatus(
    order.status,
  );
}

export default function AdminDashboard() {
  const [
    overview,
    setOverview,
  ] =
    useState(null);

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
    error,
    setError,
  ] =
    useState('');

  const [
    brief,
    setBrief,
  ] =
    useState(null);

  const [
    weekAhead,
    setWeekAhead,
  ] =
    useState([]);

  const load =
    useCallback(
      async (
        refresh = false,
      ) => {
        try {
          if (refresh) {
            setRefreshing(
              true,
            );
          }

          setError('');

          const [
            data,
            partCount,
            orders,
            meetings,
            team,
          ] =
            await Promise.all([
              getAdminOverview(),
              getAdminPendingPartPaymentCount().catch(() => 0),
              getAdminOrders().catch(() => []),
              getMeetings({
                upcomingOnly: true,
              }).catch(
                () => [],
              ),
              getTeam().catch(
                () => ({
                  members: [],
                  allocations: [],
                }),
              ),
            ]);

          setOverview(
            data,
          );

          const today =
            new Date()
              .toISOString()
              .slice(
                0,
                10,
              );

          const in7 =
            new Date(
              Date.now() +
                7 *
                  86400000,
            )
              .toISOString()
              .slice(
                0,
                10,
              );

          const active = (
            orders ||
            []
          ).filter(
            (
              order,
            ) =>
              !order.archived_at &&
              ![
                'completed',
                'cancelled',
              ].includes(
                order.status,
              ),
          );

          const overdue = active.filter(
            (
              order,
            ) =>
              order.deadline &&
              order.deadline <
                today &&
              Math.max(
                Number(
                  order.quoted_amount_kobo ||
                    0,
                ) -
                  Number(
                    order.paid_amount_kobo ||
                      0,
                  ),
                0,
              ) > 0,
          );

          const deadlineRisk =
            active.filter(
              (
                order,
              ) =>
                order.deadline &&
                order.deadline >=
                  today &&
                order.deadline <=
                  in7,
            );

          const expected7d = active.reduce(
            (
              sum,
              order,
            ) => {
              if (
                !order.deadline ||
                order.deadline >
                  in7
              ) {
                return sum;
              }

              return (
                sum +
                Math.max(
                  Number(
                    order.quoted_amount_kobo ||
                      0,
                  ) -
                    Number(
                      order.paid_amount_kobo ||
                        0,
                    ),
                  0,
                )
              );
            },
            0,
          );

          const nowDate = new Date();
          const monday = new Date(
            Date.UTC(
              nowDate.getUTCFullYear(),
              nowDate.getUTCMonth(),
              nowDate.getUTCDate(),
            ),
          );
          monday.setUTCDate(
            monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7),
          );
          const weekStart = monday
            .toISOString()
            .slice(0, 10);

          const utilizations = (team?.members || [])
            .filter((member) => member.status === 'active')
            .map((member) => {
              const capacity = Number(
                member.weekly_capacity_minutes || 0,
              );

              if (capacity <= 0) return null;

              const allocated = (team?.allocations || [])
                .filter(
                  (allocation) =>
                    allocation.member_id === member.id &&
                    allocation.week_start === weekStart,
                )
                .reduce(
                  (sum, allocation) =>
                    sum + Number(allocation.minutes || 0),
                  0,
                );

              return Math.round((allocated / capacity) * 100);
            })
            .filter((value) => value !== null);

          const avgUtilization =
            utilizations.length > 0
              ? Math.round(
                  utilizations.reduce((a, b) => a + b, 0) /
                    utilizations.length,
                )
              : null;

          setBrief(
            buildExecutiveBrief({
              attentionCount:
                (data?.pendingReview ||
                  0) +
                partCount +
                overdue.length,
              expected7dKobo:
                expected7d,
              overdueCount:
                overdue.length,
              overdueKobo:
                overdue.reduce(
                  (
                    sum,
                    order,
                  ) =>
                    sum +
                    Math.max(
                      Number(
                        order.quoted_amount_kobo ||
                          0,
                      ) -
                        Number(
                          order.paid_amount_kobo ||
                            0,
                        ),
                      0,
                    ),
                  0,
                ),
              deadlineRiskCount:
                deadlineRisk.length,
              pendingApprovals:
                partCount,
              avgUtilization,
            }),
          );

          const week = [];

          for (const order of active) {
            if (
              order.deadline &&
              order.deadline >=
                today &&
              order.deadline <=
                in7
            ) {
              week.push({
                id: `order-${order.id}`,
                date: order.deadline,
                label: `Project due: ${order.project_title}`,
                detail:
                  order.reference,
                to: `orders/${order.reference}`,
              });
            }
          }

          for (const meeting of (
            meetings ||
            []
          ).slice(
            0,
            10,
          )) {
            const day =
              String(
                meeting.scheduled_at ||
                  '',
              ).slice(
                0,
                10,
              );

            if (
              day &&
              day <= in7
            ) {
              week.push({
                id: `meeting-${meeting.id}`,
                date: day,
                label: `Meeting: ${meeting.kind}`,
                detail:
                  meeting.lead
                    ?.company ||
                  meeting.lead
                    ?.name ||
                  '',
                to: 'sales',
              });
            }
          }

          week.sort(
            (
              a,
              b,
            ) =>
              a.date <
              b.date
                ? -1
                : 1,
          );

          setWeekAhead(
            week.slice(
              0,
              8,
            ),
          );
        } catch (
          loadError
        ) {
          console.error(
            loadError,
          );

          setError(
            'The management overview could not be loaded.',
          );
        } finally {
          setLoading(
            false,
          );

          setRefreshing(
            false,
          );
        }
      },
      [],
    );

  useEffect(() => {
    document.title =
      'Management Portal | Posho Creative';

    load();
  }, [
    load,
  ]);

  if (loading) {
    return (
      <BrandLoader
        label="Preparing management overview..."
      />
    );
  }

  return (
    <div className="admin-view admin-dashboard-v2 page-reveal">
      <div className="admin-view-heading admin-dashboard-heading">
        <div>
          <span>
            OPERATIONS
          </span>

          <h1>
            Management
            <br />
            overview.
          </h1>

          <p>
            Review incoming work, monitor active projects and keep commercial activity organised.
          </p>
        </div>

        <button
          type="button"
          className="admin-refresh-button"
          onClick={() =>
            load(true)
          }
          disabled={
            refreshing
          }
        >
          <RefreshCw
            size={17}
            className={
              refreshing
                ? 'admin-spin'
                : ''
            }
          />

          Refresh
        </button>
      </div>

      {error && (
        <div className="admin-error">
          {error}
        </div>
      )}

      <div className="admin-dashboard-stat-grid">
        <article className="admin-dashboard-stat admin-dashboard-stat-priority">
          <div>
            <Clock3
              size={20}
            />
          </div>

          <span>
            Awaiting review
          </span>

          <strong>
            {overview
              ?.pendingReview ||
              0}
          </strong>

          <small>
            New project requests
          </small>
        </article>

        <article className="admin-dashboard-stat">
          <div>
            <FolderKanban
              size={20}
            />
          </div>

          <span>
            Active projects
          </span>

          <strong>
            {overview
              ?.activeProjects ||
              0}
          </strong>

          <small>
            Approved and ongoing
          </small>
        </article>

        <article className="admin-dashboard-stat">
          <div>
            <Banknote
              size={20}
            />
          </div>

          <span>
            Awaiting payment
          </span>

          <strong>
            {overview
              ?.awaitingPayment ||
              0}
          </strong>

          <small>
            Quotes ready for payment
          </small>
        </article>

        <article className="admin-dashboard-stat">
          <div>
            <UsersRound
              size={20}
            />
          </div>

          <span>
            Customers
          </span>

          <strong>
            {overview
              ?.customers ||
              0}
          </strong>

          <small>
            Registered client accounts
          </small>
        </article>

        <article className="admin-dashboard-stat admin-dashboard-stat-money">
          <div>
            <CheckCircle2
              size={20}
            />
          </div>

          <span>
            Confirmed revenue
          </span>

          <strong>
            {formatMoney(
              overview
                ?.revenue ||
                0,
            )}
          </strong>

          <small>
            Successfully verified payments
          </small>
        </article>

        <article className="admin-dashboard-stat admin-dashboard-stat-money">
          <div>
            <Banknote
              size={20}
            />
          </div>

          <span>
            Outstanding
          </span>

          <strong>
            {formatMoney(
              overview
                ?.outstanding ||
                0,
            )}
          </strong>

          <small>
            Approved unpaid balances
          </small>
        </article>
      </div>

      <div className="admin-dashboard-grid">
        <OpsInbox compact />

        <section className="admin-dashboard-panel">
          <div className="admin-dashboard-panel-heading">
            <div>
              <span>
                EXECUTIVE BRIEF
              </span>

              <h2>
                Today
              </h2>
            </div>
          </div>

          {!brief ||
          brief.lines
            .length ===
            0 ? (
            <div className="admin-clean-state">
              <CheckCircle2
                size={24}
              />

              <strong>
                Quiet day
              </strong>

              <span>
                No urgent operational signals right
                now.
              </span>
            </div>
          ) : (
            <div className="admin-dashboard-list">
              {brief.lines.map(
                (
                  line,
                ) => (
                  <div
                    key={
                      line
                    }
                    className="admin-dashboard-list-row"
                  >
                    <div>
                      <strong>
                        {line}
                      </strong>
                    </div>
                  </div>
                ),
              )}

              {brief.expected7dKobo >
                0 && (
                <div className="admin-dashboard-list-row">
                  <div>
                    <small>
                      EXPECTED WITHIN 7
                      DAYS
                    </small>

                    <strong>
                      {formatNaira(
                        brief.expected7dKobo,
                      )}
                    </strong>

                    <span>
                      Forecast from dated
                      balances — not a
                      guarantee
                    </span>
                  </div>
                </div>
              )}

              {brief.avgUtilization !==
                null &&
                brief.avgUtilization !==
                  undefined && (
                  <div className="admin-dashboard-list-row">
                    <div>
                      <small>
                        TEAM UTILIZATION
                        THIS WEEK
                      </small>

                      <strong>
                        {
                          brief.avgUtilization
                        }
                        %
                      </strong>

                      <span>
                        Average across
                        active members
                      </span>
                    </div>
                  </div>
                )}
            </div>
          )}
        </section>

        <section className="admin-dashboard-panel">
          <div className="admin-dashboard-panel-heading">
            <div>
              <span>
                THIS WEEK
              </span>

              <h2>
                Coming up
              </h2>
            </div>

            <Link to="/admin/reports">
              Reports
              <ArrowRight
                size={16}
              />
            </Link>
          </div>

          {weekAhead.length ===
          0 ? (
            <div className="admin-clean-state">
              <strong>
                Nothing scheduled
              </strong>

              <span>
                No deadlines or meetings in
                the next 7 days.
              </span>
            </div>
          ) : (
            <div className="admin-dashboard-list">
              {weekAhead.map(
                (
                  item,
                ) => (
                  <Link
                    key={
                      item.id
                    }
                    to={`/admin/${item.to}`}
                    className="admin-dashboard-list-row"
                  >
                    <div>
                      <small>
                        {
                          item.date
                        }
                      </small>

                      <strong>
                        {
                          item.label
                        }
                      </strong>

                      {item.detail && (
                        <span>
                          {
                            item.detail
                          }
                        </span>
                      )}
                    </div>

                    <ArrowRight
                      size={17}
                    />
                  </Link>
                ),
              )}
            </div>
          )}
        </section>

        <section className="admin-dashboard-panel admin-review-queue">
          <div className="admin-dashboard-panel-heading">
            <div>
              <span>
                REVIEW QUEUE
              </span>

              <h2>
                New project requests
              </h2>
            </div>

            <Link
              to="/admin/orders"
            >
              View all

              <ArrowRight
                size={16}
              />
            </Link>
          </div>

          {overview
            ?.pendingOrders
            ?.length ? (
            <div className="admin-dashboard-list">
              {overview
                .pendingOrders
                .map(
                  (
                    order,
                  ) => (
                    <Link
                      key={
                        order.id
                      }
                      to={`/admin/orders/${order.reference}`}
                      className="admin-dashboard-list-row"
                    >
                      <div>
                        <small>
                          {order.reference}
                        </small>

                        <strong>
                          {order.project_title}
                        </strong>

                        <span>
                          {order
                            .customers
                            ?.full_name ||
                            order
                              .customers
                              ?.email}
                        </span>
                      </div>

                      <span className="admin-decision-pill pending">
                        Review
                      </span>

                      <ArrowRight
                        size={17}
                      />
                    </Link>
                  ),
                )}
            </div>
          ) : (
            <div className="admin-clean-state">
              <CheckCircle2
                size={24}
              />

              <strong>
                Review queue clear
              </strong>

              <span>
                There are no new project requests awaiting a decision.
              </span>
            </div>
          )}
        </section>

        <aside className="admin-dashboard-panel admin-dashboard-summary">
          <div className="admin-dashboard-panel-heading">
            <div>
              <span>
                DECISIONS
              </span>

              <h2>
                Order review
              </h2>
            </div>
          </div>

          <div className="admin-decision-summary-row">
            <div className="decision-icon approved">
              <CheckCircle2
                size={17}
              />
            </div>

            <span>
              Approved
            </span>

            <strong>
              {overview
                ?.approved ||
                0}
            </strong>
          </div>

          <div className="admin-decision-summary-row">
            <div className="decision-icon declined">
              <XCircle
                size={17}
              />
            </div>

            <span>
              Declined
            </span>

            <strong>
              {overview
                ?.declined ||
                0}
            </strong>
          </div>
        </aside>
      </div>

      <section className="admin-dashboard-panel admin-recent-panel">
        <div className="admin-dashboard-panel-heading">
          <div>
            <span>
              RECENT ACTIVITY
            </span>

            <h2>
              Latest projects
            </h2>
          </div>
        </div>

        <div className="admin-dashboard-list">
          {(overview
            ?.recentOrders ||
            []).map(
            (
              order,
            ) => (
              <Link
                key={
                  order.id
                }
                to={`/admin/orders/${order.reference}`}
                className="admin-dashboard-list-row"
              >
                <div>
                  <small>
                    {order.reference}
                  </small>

                  <strong>
                    {order.project_title}
                  </strong>

                  <span>
                    {order.service_slug
                      ?.replaceAll(
                        '-',
                        ' ',
                      )}
                  </span>
                </div>

                <span
                  className={`admin-decision-pill ${order.review_decision}`}
                >
                  {displayState(
                    order,
                  )}
                </span>

                <ArrowRight
                  size={17}
                />
              </Link>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
