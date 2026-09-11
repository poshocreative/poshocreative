import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import BrandLoader from '../components/BrandLoader';
import PageHeader from '../components/ui/PageHeader';
import MetricCard from '../components/ui/MetricCard';
import Tabs from '../components/ui/Tabs';

import {
  usePermissions,
} from '../lib/permissions';
import {
  ErrorBlock,
} from '../components/ui/StateBlocks';

import {
  useToast,
} from '../components/ui/Toast';

import {
  formatNaira,
  getReportData,
  groupSum,
  monthKey,
  toCsv,
} from '../lib/reports';

function pretty(
  value,
) {
  return String(
    value ||
      'Unspecified',
  ).replaceAll(
    '_',
    ' ',
  );
}

function inRange(
  dateValue,
  from,
  to,
) {
  if (
    !from &&
    !to
  ) {
    return true;
  }

  const time =
    new Date(
      dateValue,
    ).getTime();

  if (
    !Number.isFinite(
      time,
    )
  ) {
    return false;
  }

  if (
    from &&
    time <
      new Date(
        from,
      ).getTime()
  ) {
    return false;
  }

  if (
    to &&
    time >
      new Date(
        `${to}T23:59:59`,
      ).getTime()
  ) {
    return false;
  }

  return true;
}

function ReportTable({
  rows,
  empty,
}) {
  if (
    rows.length ===
    0
  ) {
    return (
      <p className="admin-card-description">
        {empty}
      </p>
    );
  }

  return (
    <div className="posho-report-list">
      {rows.map(
        (
          row,
          index,
        ) => (
          <div
            key={
              row.key ||
              index
            }
            className="posho-report-row"
          >
            <header>
              <span className="posho-long-value">
                {
                  row.label
                }
              </span>

              <strong>
                {
                  row.display
                }
              </strong>
            </header>

            {typeof row.ratio ===
              'number' && (
              <div className="posho-report-bar">
                <span
                  style={{
                    width: `${Math.min(100, Math.max(0, Math.round(row.ratio * 100)))}%`,
                  }}
                />
              </div>
            )}

            {row.sub && (
              <small>
                {
                  row.sub
                }
              </small>
            )}
          </div>
        ),
      )}
    </div>
  );
}

export default function AdminReports() {
  const toast =
    useToast();

  const {
    can,
  } =
    usePermissions();

  const showProfitability =
    can(
      'finance.manage',
    );

  const [
    tab,
    setTab,
  ] =
    useState(
      'finance',
    );

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
    data,
    setData,
  ] =
    useState(null);

  const [
    from,
    setFrom,
  ] =
    useState('');

  const [
    to,
    setTo,
  ] =
    useState('');

  const load =
    useCallback(
      async () => {
        try {
          setError('');
          setLoading(
            true,
          );

          setData(
            await getReportData(),
          );
        } catch (loadError) {
          setError(
            loadError.message ||
              'Reports could not be loaded.',
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
      'Reports | Posho Creative Management';

    load();
  }, [
    load,
  ]);

  const finance = useMemo(() => {
    if (!data) {
      return null;
    }

    const payments = data.payments.filter(
      (
        payment,
      ) =>
        payment.status ===
          'successful' &&
        inRange(
          payment.created_at,
          from,
          to,
        ),
    );

    const collected = payments.reduce(
      (
        sum,
        payment,
      ) =>
        sum +
        Number(
          payment.amount_kobo ||
            0,
        ),
      0,
    );

    const byMethod = groupSum(
      payments,
      (
        payment,
      ) =>
        pretty(
          payment.payment_method,
        ),
      (
        payment,
      ) =>
        Number(
          payment.amount_kobo ||
            0,
        ),
    ).map(
      (
        row,
      ) => ({
        key: row.key,
        label: row.key,
        display: formatNaira(
          row.total,
        ),
        ratio:
          collected >
          0
            ? row.total /
              collected
            : 0,
      }),
    );

    const byMonth = groupSum(
      payments,
      (
        payment,
      ) =>
        monthKey(
          payment.created_at,
        ),
      (
        payment,
      ) =>
        Number(
          payment.amount_kobo ||
            0,
        ),
    ).map(
      (
        row,
      ) => ({
        key: row.key,
        label: row.key,
        display: formatNaira(
          row.total,
        ),
        ratio:
          collected >
          0
            ? row.total /
              collected
            : 0,
      }),
    );

    return {
      collected,
      count:
        payments.length,
      byMethod,
      byMonth,
      payments,
    };
  }, [
    data,
    from,
    to,
  ]);

  const projects = useMemo(() => {
    if (!data) {
      return null;
    }

    const rows = data.orders.filter(
      (
        order,
      ) =>
        !order.archived_at &&
        inRange(
          order.created_at,
          from,
          to,
        ),
    );

    const completed = rows.filter(
      (
        order,
      ) =>
        order.status ===
        'completed',
    );

    const withDuration = completed
      .map(
        (
          order,
        ) => {
          const start =
            new Date(
              order.created_at,
            ).getTime();

          const end =
            new Date(
              order.completed_at ||
                order.created_at,
            ).getTime();

          return (
            end -
            start
          );
        },
      )
      .filter(
        (
          ms,
        ) =>
          Number.isFinite(
            ms,
          ) && ms >= 0,
      );

    const avgDays =
      withDuration.length >
      0
        ? Math.round(
            withDuration.reduce(
              (
                a,
                b,
              ) =>
                a +
                b,
              0,
            ) /
              withDuration.length /
              86400000,
          )
        : null;

    const byStatus = groupSum(
      rows,
      (
        order,
      ) =>
        order.review_decision ===
        'pending'
          ? 'Awaiting review'
          : pretty(
              order.status,
            ),
      () => 1,
    ).map(
      (
        row,
      ) => ({
        key: row.key,
        label: row.key,
        display: `${row.total} project${row.total === 1 ? '' : 's'}`,
        ratio:
          rows.length >
          0
            ? row.total /
              rows.length
            : 0,
      }),
    );

    return {
      total:
        rows.length,
      completed:
        completed.length,
      avgDays,
      byStatus,
      rows,
    };
  }, [
    data,
    from,
    to,
  ]);

  const services = useMemo(() => {
    if (!data) {
      return null;
    }

    const rows = data.orders.filter(
      (
        order,
      ) =>
        !order.archived_at &&
        inRange(
          order.created_at,
          from,
          to,
        ),
    );

    const total = rows.reduce(
      (
        sum,
        order,
      ) =>
        sum +
        Number(
          order.quoted_amount_kobo ||
            0,
        ),
      0,
    );

    return groupSum(
      rows,
      (
        order,
      ) =>
        pretty(
          order.service_slug,
        ),
      (
        order,
      ) =>
        Number(
          order.quoted_amount_kobo ||
            0,
        ),
    ).map(
      (
        row,
      ) => {
        const count = rows.filter(
          (
            order,
          ) =>
            pretty(
              order.service_slug,
            ) ===
            row.key,
        ).length;

        return {
          key: row.key,
          label: row.key,
          display: `${formatNaira(row.total)} · ${count} project${count === 1 ? '' : 's'}`,
          sub: `Average ${formatNaira(count > 0 ? Math.round(row.total / count) : 0)} per project`,
          ratio:
            total >
            0
              ? row.total /
                total
              : 0,
        };
      },
    );
  }, [
    data,
    from,
    to,
  ]);

  const clients = useMemo(() => {
    if (!data) {
      return null;
    }

    const byCustomer =
      new Map();

    for (const order of data.orders) {
      if (
        order.archived_at ||
        !inRange(
          order.created_at,
          from,
          to,
        )
      ) {
        continue;
      }

      const id =
        order.customer_id ||
        'unknown';

      if (
        !byCustomer.has(
          id,
        )
      ) {
        byCustomer.set(
          id,
          {
            customer:
              order.customers ||
              {},
            value: 0,
            collected: 0,
            projects: 0,
            completed: 0,
          },
        );
      }

      const entry =
        byCustomer.get(
          id,
        );

      entry.value += Number(
        order.quoted_amount_kobo ||
          0,
      );
      entry.collected += Number(
        order.paid_amount_kobo ||
          0,
      );
      entry.projects += 1;

      if (
        order.status ===
        'completed'
      ) {
        entry.completed += 1;
      }
    }

    return [...byCustomer.values()]
      .sort(
        (
          a,
          b,
        ) =>
          b.value -
          a.value,
      )
      .slice(
        0,
        20,
      )
      .map(
        (
          entry,
          index,
        ) => ({
          key:
            entry.customer
              ?.id ||
            `client-${index}`,
          label:
            entry.customer
              ?.business_name ||
            entry.customer
              ?.full_name ||
            entry.customer
              ?.email ||
            'Unknown client',
          display: `${formatNaira(entry.value)} value · ${formatNaira(entry.collected)} collected`,
          sub: `${entry.projects} project${entry.projects === 1 ? '' : 's'} · ${entry.completed} completed · ${formatNaira(Math.max(entry.value - entry.collected, 0))} outstanding`,
          ratio:
            entry.value >
            0
              ? entry.collected /
                entry.value
              : 0,
        }),
      );
  }, [
    data,
    from,
    to,
  ]);

  const profitability =
    useMemo(() => {
      if (!data) {
        return null;
      }

      const costByOrder =
        new Map();

      for (const cost of data.costs) {
        costByOrder.set(
          cost.order_id,
          (costByOrder.get(
            cost.order_id,
          ) || 0) +
            Number(
              cost.amount_kobo ||
                0,
            ),
        );
      }

      const timeByOrder =
        new Map();

      for (const entry of data.timeEntries) {
        timeByOrder.set(
          entry.order_id,
          (timeByOrder.get(
            entry.order_id,
          ) || 0) +
            Number(
              entry.minutes ||
                0,
            ),
        );
      }

      const rows = data.orders
        .filter(
          (
            order,
          ) =>
            !order.archived_at &&
            Number(
              order.quoted_amount_kobo ||
                0,
            ) > 0 &&
            inRange(
              order.created_at,
              from,
              to,
            ),
        )
        .map(
          (
            order,
          ) => {
            const external =
              costByOrder.get(
                order.id,
              ) || 0;
            const minutes =
              timeByOrder.get(
                order.id,
              ) || 0;
            const collected = Number(
              order.paid_amount_kobo ||
                0,
            );
            const contribution =
              collected -
              external;

            return {
              key: order.id,
              label: `${order.reference} · ${order.project_title}`,
              display: `${formatNaira(contribution)} contribution`,
              sub: `${formatNaira(collected)} collected · ${formatNaira(external)} external costs · ${Math.round(minutes / 60)}h tracked`,
              ratio:
                collected >
                0
                  ? Math.max(
                      0,
                      contribution /
                        collected,
                    )
                  : 0,
            };
          },
        )
        .sort(
          (
            a,
            b,
          ) =>
            b.ratio -
            a.ratio,
        );

      return {
        rows: rows.slice(
          0,
          25,
        ),
      };
    }, [
      data,
      from,
      to,
    ]);

  const capacity = useMemo(() => {
    if (!data) {
      return null;
    }

    const activeMembers =
      data.members.filter(
        (
          member,
        ) =>
          member.status ===
          'active',
      );

    return activeMembers.map(
      (
        member,
      ) => {
        const minutes =
          data.timeEntries
            .filter(
              (
                entry,
              ) =>
                entry.member_id ===
                member.id,
            )
            .reduce(
              (
                sum,
                entry,
              ) =>
                sum +
                Number(
                  entry.minutes ||
                    0,
                ),
              0,
            );

        const openTasks =
          data.tasks.filter(
            (
              task,
            ) =>
              task.assignee_id ===
                member.id &&
              ![
                'done',
                'cancelled',
              ].includes(
                task.status,
              ),
          ).length;

        return {
          key: member.id,
          label:
            member.display_name,
          display: `${Math.round(minutes / 60)}h tracked · ${openTasks} open tasks`,
          sub: `Capacity ${Math.round(Number(member.weekly_capacity_minutes || 0) / 60)}h/week`,
        };
      },
    );
  }, [
    data,
  ]);

  const sales = useMemo(() => {
    if (!data) {
      return null;
    }

    const leads = data.leads.filter(
      (
        lead,
      ) =>
        !lead.archived_at &&
        inRange(
          lead.created_at,
          from,
          to,
        ),
    );

    const won = leads.filter(
      (
        lead,
      ) =>
        lead.stage ===
        'won',
    );

    const wonValue = won.reduce(
      (
        sum,
        lead,
      ) =>
        sum +
        Number(
          lead.expected_value_kobo ||
            0,
        ),
      0,
    );

    const bySource = groupSum(
      leads,
      (
        lead,
      ) =>
        pretty(
          lead.source,
        ),
      () => 1,
    ).map(
      (
        row,
      ) => ({
        key: row.key,
        label: row.key,
        display: `${row.total} lead${row.total === 1 ? '' : 's'}`,
        ratio:
          leads.length >
          0
            ? row.total /
              leads.length
            : 0,
      }),
    );

    const accepted = data.proposals.filter(
      (
        proposal,
      ) =>
        proposal.status ===
        'accepted',
    );

    return {
      leads: leads.length,
      won: won.length,
      wonValue,
      conversion:
        leads.length >
        0
          ? Math.round(
              (won.length /
                leads.length) *
                100,
            )
          : 0,
      bySource,
      proposals:
        data.proposals
          .length,
      accepted:
        accepted.length,
    };
  }, [
    data,
    from,
    to,
  ]);

  const exportCsv = (
    name,
    rows,
  ) => {
    if (
      !toCsv(
        name,
        rows,
      )
    ) {
      toast.info(
        'Nothing to export in this view.',
      );

      return;
    }

    toast.success(
      'Report exported as CSV.',
    );
  };

  if (loading) {
    return (
      <BrandLoader label="Loading reports…" />
    );
  }

  return (
    <div className="admin-view page-reveal">
      <PageHeader
        kicker="Intelligence"
        title="Reports"
        description="Curated operational reports from real data. Booked value and cash collected stay separate."
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

      <div className="posho-search-row">
        <label>
          <span className="posho-section-label">
            From
          </span>

          <input
            type="date"
            value={
              from
            }
            onChange={(
              event,
            ) =>
              setFrom(
                event.target
                  .value,
              )
            }
            aria-label="Report start date"
          />
        </label>

        <label>
          <span className="posho-section-label">
            To
          </span>

          <input
            type="date"
            value={
              to
            }
            onChange={(
              event,
            ) =>
              setTo(
                event.target
                  .value,
              )
            }
            aria-label="Report end date"
          />
        </label>
      </div>

      <Tabs
        tabs={[
          {
            key: 'finance',
            label: 'Finance',
          },
          {
            key: 'projects',
            label: 'Projects',
          },
          {
            key: 'services',
            label: 'Services',
          },
          {
            key: 'clients',
            label: 'Clients',
          },
          ...(showProfitability
            ? [
                {
                  key: 'profitability',
                  label: 'Profitability',
                },
              ]
            : []),
          {
            key: 'capacity',
            label: 'Capacity',
          },
          {
            key: 'sales',
            label: 'Sales',
          },
        ]}
        active={
          tab
        }
        onChange={
          setTab
        }
        label="Report sections"
      />

      {tab ===
        'finance' &&
        finance && (
          <>
            <div className="admin-dashboard-stat-grid">
              <MetricCard
                label="Collected"
                value={formatNaira(
                  finance.collected,
                )}
                detail={`${finance.count} successful payments`}
                tone="green"
              />

              <MetricCard
                label="Methods used"
                value={
                  finance
                    .byMethod
                    .length
                }
                detail="Payment-method distribution below"
              />
            </div>

            <section className="admin-control-card">
              <span className="posho-section-label">
                Payment methods
              </span>

              <ReportTable
                rows={
                  finance.byMethod
                }
                empty="No successful payments in range."
              />

              <div className="finance-review-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() =>
                    exportCsv(
                      'finance-methods.csv',
                      finance.byMethod.map(
                        (
                          row,
                        ) => ({
                          method:
                            row.label,
                          collected_ngn: (
                            finance.collected >
                            0
                              ? (row.ratio *
                                  finance.collected) /
                                100
                              : 0
                          ).toFixed(
                            2,
                          ),
                        }),
                      ),
                    )
                  }
                >
                  Export CSV
                </button>
              </div>
            </section>

            <section className="admin-control-card">
              <span className="posho-section-label">
                Collected by month
              </span>

              <ReportTable
                rows={
                  finance.byMonth
                }
                empty="No successful payments in range."
              />
            </section>
          </>
        )}

      {tab ===
        'projects' &&
        projects && (
          <>
            <div className="admin-dashboard-stat-grid">
              <MetricCard
                label="Projects"
                value={
                  projects.total
                }
                detail="In range"
              />

              <MetricCard
                label="Completed"
                value={
                  projects.completed
                }
                detail="Delivered and closed"
                tone="green"
              />

              <MetricCard
                label="Avg completion"
                value={
                  projects.avgDays ===
                  null
                    ? '—'
                    : `${projects.avgDays}d`
                }
                detail="Submission to completion"
              />
            </div>

            <section className="admin-control-card">
              <span className="posho-section-label">
                By status
              </span>

              <ReportTable
                rows={
                  projects.byStatus
                }
                empty="No projects in range."
              />

              <div className="finance-review-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() =>
                    exportCsv(
                      'projects.csv',
                      projects.rows.map(
                        (
                          order,
                        ) => ({
                          reference:
                            order.reference,
                          title:
                            order.project_title,
                          service:
                            order.service_slug,
                          status:
                            order.status,
                          quoted_ngn: (
                            Number(
                              order.quoted_amount_kobo ||
                                0,
                            ) /
                            100
                          ).toFixed(
                            2,
                          ),
                          paid_ngn: (
                            Number(
                              order.paid_amount_kobo ||
                                0,
                            ) /
                            100
                          ).toFixed(
                            2,
                          ),
                          created:
                            order.created_at,
                        }),
                      ),
                    )
                  }
                >
                  Export CSV
                </button>
              </div>
            </section>
          </>
        )}

      {tab ===
        'services' &&
        services && (
          <section className="admin-control-card">
            <span className="posho-section-label">
              Service performance
            </span>

            <ReportTable
              rows={
                services
              }
              empty="No project value in range."
            />
          </section>
        )}

      {tab ===
        'clients' &&
        clients && (
          <section className="admin-control-card">
            <span className="posho-section-label">
              Client performance
            </span>

            <p className="admin-card-description">
              Factual indicators only —
              value, collection and
              completion.
            </p>

            <ReportTable
              rows={
                clients
              }
              empty="No clients in range."
            />

            <div className="finance-review-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  exportCsv(
                    'clients.csv',
                    clients.map(
                      (
                        row,
                      ) => ({
                        client:
                          row.label,
                        detail:
                          row.display,
                        summary:
                          row.sub,
                      }),
                    ),
                  )
                }
              >
                Export CSV
              </button>
            </div>
          </section>
        )}

      {tab ===
        'profitability' &&
        profitability && (
          <section className="admin-control-card">
            <span className="posho-section-label">
              Profitability · management only
            </span>

            <p className="admin-card-description">
              Contribution = collected minus
              external costs. Internal time
              rates are not stored, so labor
              cost uses tracked hours for
              context only.
            </p>

            <ReportTable
              rows={
                profitability.rows
              }
              empty="No valued projects in range."
            />
          </section>
        )}

      {tab ===
        'capacity' &&
        capacity && (
          <section className="admin-control-card">
            <span className="posho-section-label">
              Capacity and time
            </span>

            <ReportTable
              rows={
                capacity
              }
              empty="No active team members."
            />
          </section>
        )}

      {tab ===
        'sales' &&
        sales && (
          <>
            <div className="admin-dashboard-stat-grid">
              <MetricCard
                label="Leads"
                value={
                  sales.leads
                }
                detail="In range"
              />

              <MetricCard
                label="Won"
                value={
                  sales.won
                }
                detail={`${sales.conversion}% conversion`}
                tone="green"
              />

              <MetricCard
                label="Won value"
                value={formatNaira(
                  sales.wonValue,
                )}
                detail="Expected value of wins"
              />

              <MetricCard
                label="Proposals accepted"
                value={`${sales.accepted}/${sales.proposals}`}
                detail="All-time proposals"
              />
            </div>

            <section className="admin-control-card">
              <span className="posho-section-label">
                Leads by source
              </span>

              <ReportTable
                rows={
                  sales.bySource
                }
                empty="No leads in range."
              />

              <div className="finance-review-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() =>
                    exportCsv(
                      'sales-sources.csv',
                      sales.bySource.map(
                        (
                          row,
                        ) => ({
                          source:
                            row.label,
                          leads:
                            Math.round(
                              row.ratio *
                                sales.leads,
                            ),
                        }),
                      ),
                    )
                  }
                >
                  Export CSV
                </button>
              </div>
            </section>
          </>
        )}
    </div>
  );
}
