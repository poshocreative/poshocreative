import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';


import Icon from './ui/Icon';
import {
  useNavigate,
} from 'react-router-dom';

import {
  useAuth,
} from '../context/AuthContext';

import {
  usePermissions,
} from '../lib/permissions';

import {
  globalSearch,
} from '../lib/search';

const COMMANDS = [
  {
    group: 'Navigate',
    label: 'Overview',
    description: 'Dashboard home',
    icon: 'dashboard',
    keywords: 'home dashboard overview',
    suffix: '',
  },
  {
    group: 'Navigate',
    label: 'Projects',
    description: 'Orders and projects',
    icon: 'folder_open',
    keywords: 'projects orders list',
    suffix: 'orders',
  },
  {
    group: 'Navigate',
    label: 'Work board',
    description: 'Tasks and kanban',
    icon: 'view_kanban',
    keywords: 'tasks board kanban work',
    suffix: 'work',
  },
  {
    group: 'Navigate',
    label: 'Clients',
    description: 'Customers and accounts',
    icon: 'people',
    keywords: 'clients customers crm',
    suffix: 'customers',
  },
  {
    group: 'Navigate',
    label: 'Sales pipeline',
    description: 'Leads and deals',
    icon: 'trending_up',
    keywords: 'sales leads pipeline crm',
    suffix: 'sales',
    capability: 'sales.manage',
  },
  {
    group: 'Navigate',
    label: 'Finance',
    description: 'Revenue and money',
    icon: 'account_balance',
    keywords: 'finance money revenue cash',
    suffix: 'finance',
    capability: 'finance.manage',
  },
  {
    group: 'Navigate',
    label: 'Reports',
    description: 'Analytics and exports',
    icon: 'bar_chart',
    keywords: 'reports analytics export',
    suffix: 'reports',
    capability: 'reports.view',
  },
  {
    group: 'Navigate',
    label: 'Service requests',
    description: 'Support queue',
    icon: 'inbox',
    keywords: 'requests queue support maintenance',
    suffix: 'requests',
    capability: 'requests.manage',
  },
  {
    group: 'Navigate',
    label: 'Services',
    description: 'Catalog and pricing',
    icon: 'layers',
    keywords: 'services packages pricing catalog',
    suffix: 'services',
    capability: 'services.manage',
  },
  {
    group: 'Navigate',
    label: 'Team',
    description: 'Members and capacity',
    icon: 'group',
    keywords: 'team members capacity planner',
    suffix: 'team',
    capability: 'team.manage',
  },
  {
    group: 'Navigate',
    label: 'Automations',
    description: 'Rules and workflows',
    icon: 'bolt',
    keywords: 'automations rules workflow',
    suffix: 'automations',
    capability: 'automations.manage',
  },
  {
    group: 'Navigate',
    label: 'Activity',
    description: 'Audit log and feed',
    icon: 'history',
    keywords: 'activity feed audit log',
    suffix: 'activity',
    capability: 'reports.view',
  },
  {
    group: 'Navigate',
    label: 'Settings',
    description: 'Workspace configuration',
    icon: 'settings',
    keywords: 'settings configuration flags sop',
    suffix: 'settings',
    capability: 'settings.manage',
  },
  {
    group: 'Navigate',
    label: 'Payments',
    description: 'Transactions',
    icon: 'payments',
    keywords: 'payments transactions flutterwave',
    suffix: 'payments',
    capability: 'finance.manage',
  },
  {
    group: 'Navigate',
    label: 'Quotes',
    description: 'Quotations',
    icon: 'request_quote',
    keywords: 'quotes quotations',
    suffix: 'quotes',
    capability: 'finance.manage',
  },
  {
    group: 'Create',
    label: 'New lead',
    description: 'Add a sales inquiry',
    icon: 'person_add',
    keywords: 'create new lead inquiry',
    suffix: 'sales',
    capability: 'sales.manage',
  },
  {
    group: 'Create',
    label: 'New service request',
    description: 'Log support work',
    icon: 'add_circle',
    keywords: 'create new request support maintenance',
    suffix: 'requests',
    capability: 'requests.manage',
  },
  {
    group: 'Create',
    label: 'New proposal',
    description: 'Draft a quote',
    icon: 'note_add',
    keywords: 'create proposal quote commercial',
    suffix: 'sales',
    capability: 'sales.manage',
  },
];

const KIND_ICON = {
  command: 'arrow_forward',
  project: 'folder_open',
  client: 'person',
  finance: 'payments',
  request: 'inbox',
  lead: 'person_add',
};

export default function CommandPalette() {
  const navigate =
    useNavigate();

  const {
    adminPath,
  } =
    useAuth();

  const {
    can,
  } =
    usePermissions();

  const [
    open,
    setOpen,
  ] =
    useState(false);

  const [
    query,
    setQuery,
  ] =
    useState('');

  const [
    results,
    setResults,
  ] =
    useState(null);

  const [
    searching,
    setSearching,
  ] =
    useState(false);

  const [
    activeIndex,
    setActiveIndex,
  ] =
    useState(0);

  const inputRef =
    useRef(null);

  const listRef =
    useRef(null);

  useEffect(() => {
    const onKeyDown = (
      event,
    ) => {
      const isModifier =
        event.ctrlKey ||
        event.metaKey;

      if (
        isModifier &&
        event.key.toLowerCase() ===
          'k'
      ) {
        event.preventDefault();
        setOpen(
          (
            current,
          ) => !current,
        );
      }

      if (
        event.key ===
          'Escape' &&
        open
      ) {
        setOpen(
          false,
        );
      }
    };

    window.addEventListener(
      'keydown',
      onKeyDown,
    );

    return () =>
      window.removeEventListener(
        'keydown',
        onKeyDown,
      );
  }, [
    open,
  ]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults(
        null,
      );
      setActiveIndex(
        0,
      );

      return;
    }

    const timer =
      window.setTimeout(
        () =>
          inputRef.current?.focus(),
        30,
      );

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [
    open,
  ]);

  useEffect(() => {
    if (
      !open ||
      query.trim()
        .length < 2
    ) {
      setResults(
        null,
      );
      setSearching(
        false,
      );

      return;
    }

    setSearching(
      true,
    );

    const timer =
      window.setTimeout(
        async () => {
          try {
            setResults(
              await globalSearch(
                query,
              ),
            );
          } catch {
            setResults(
              null,
            );
          } finally {
            setSearching(
              false,
            );
          }
        },
        250,
      );

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [
    query,
    open,
  ]);

  const go = useCallback(
    (
      suffix,
    ) => {
      setOpen(
        false,
      );
      navigate(
        adminPath(
          suffix,
        ),
      );
    },
    [
      navigate,
      adminPath,
    ],
  );

  const flatItems =
    useMemo(() => {
      const needle =
        query
          .trim()
          .toLowerCase();

      const commands =
        COMMANDS.filter(
          (
            command,
          ) =>
            (
              !command.capability ||
              can(
                command.capability,
              )
            ) &&
            (
              !needle ||
              `${command.label} ${command.description} ${command.keywords}`
                .toLowerCase()
                .includes(
                  needle,
                )
            ),
        ).map(
        (
          command,
        ) => ({
          kind: 'command',
          group:
            command.group,
          label:
            command.label,
          detail:
            command.description,
          icon:
            command.icon,
          run: () =>
            go(
              command.suffix,
            ),
        }),
      );

      if (
        !results
      ) {
        return commands;
      }

      const groups = [];

      for (const project of results.projects ||
        []) {
        groups.push({
          kind: 'project',
          group:
            'Results',
          label:
            project.project_title,
          detail:
            `Project · ${project.reference}`,
          icon: 'folder_open',
          run: () =>
            go(
              `orders/${project.reference}`,
            ),
        });
      }

      for (const client of results.clients ||
        []) {
        groups.push({
          kind: 'client',
          group:
            'Results',
          label:
            client.full_name ||
            client.email,
          detail:
            client.business_name ||
            client.email,
          icon: 'person',
          run: () =>
            go(
              'customers',
            ),
        });
      }

      for (const item of results.finance ||
        []) {
        groups.push({
          kind: 'finance',
          group:
            'Results',
          label:
            item.kind ===
            'payment'
              ? `Payment ${item.provider_reference || ''}`.trim()
              : `Quote ${String(item.id).slice(0, 8)}`,
          detail:
            `Finance · ${item.status || ''}`.trim(),
          icon: 'payments',
          run: () =>
            go(
              item.kind ===
              'payment'
                ? 'payments'
                : 'quotes',
            ),
        });
      }

      for (const request of results.requests ||
        []) {
        groups.push({
          kind: 'request',
          group:
            'Results',
          label:
            request.title,
          detail:
            `Request · ${request.reference}`,
          icon: 'inbox',
          run: () =>
            go(
              'requests',
            ),
        });
      }

      for (const lead of results.leads ||
        []) {
        groups.push({
          kind: 'lead',
          group:
            'Results',
          label:
            lead.company ||
            lead.name,
          detail:
            `Lead · ${lead.reference || ''}`.trim(),
          icon: 'person_add',
          run: () =>
            go(
              'sales',
            ),
        });
      }

      return [
        ...commands,
        ...groups,
      ].slice(
        0,
        30,
      );
    }, [
      query,
      results,
      go,
      can,
    ]);

  // Group items for section headers (Navigate / Create / Results).
  const groupedItems = useMemo(() => {
    const groups = [];
    const seen = new Map();

    for (const item of flatItems) {
      if (!seen.has(item.group)) {
        seen.set(item.group, groups.length);
        groups.push({ name: item.group, items: [] });
      }
      groups[seen.get(item.group)].items.push(item);
    }

    // Keep a stable, professional order.
    const order = { Navigate: 0, Create: 1, Results: 2 };
    groups.sort(
      (a, b) =>
        (order[a.name] ?? 99) - (order[b.name] ?? 99),
    );

    // Attach global indexes for keyboard navigation.
    let cursor = 0;
    for (const group of groups) {
      group.items = group.items.map((item) => ({
        ...item,
        globalIndex: cursor++,
      }));
    }

    return groups;
  }, [flatItems]);

  useEffect(() => {
    setActiveIndex(
      0,
    );
  }, [
    flatItems.length,
  ]);

  const onInputKeyDown = (
    event,
  ) => {
    if (
      event.key ===
      'ArrowDown'
    ) {
      event.preventDefault();
      setActiveIndex(
        (
          index,
        ) =>
          Math.min(
            index +
              1,
            flatItems.length -
              1,
          ),
      );
    } else if (
      event.key ===
      'ArrowUp'
    ) {
      event.preventDefault();
      setActiveIndex(
        (
          index,
        ) =>
          Math.max(
            index -
              1,
            0,
          ),
      );
    } else if (
      event.key ===
      'Enter'
    ) {
      event.preventDefault();
      flatItems[
        activeIndex
      ]?.run();
    }
  };

  useEffect(() => {
    listRef.current
      ?.querySelector(
        '[data-active="true"]',
      )
      ?.scrollIntoView({
        block:
          'nearest',
      });
  }, [
    activeIndex,
  ]);

  return (
    <>
      <button
        type="button"
        className="admin-pro-command-trigger"
        onClick={() =>
          setOpen(
            true,
          )
        }
        aria-label="Open command palette (Control K)"
      >
        <Icon name="search"           size={16}
        />

        <span>
          Search or command…
        </span>

        <kbd>
          Ctrl K
        </kbd>
      </button>

      {open && (
        <div
          className="posho-palette-backdrop"
          onClick={() =>
            setOpen(
              false,
            )
          }
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="posho-palette"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
          >
            <div className="posho-palette-input-row">
              <Icon name="search"                 size={18}
              />

              <input
                ref={
                  inputRef
                }
                value={
                  query
                }
                onChange={(
                  event,
                ) =>
                  setQuery(
                    event.target
                      .value,
                  )
                }
                onKeyDown={
                  onInputKeyDown
                }
                placeholder="Search or jump to…"
                aria-label="Search or type a command"
                role="combobox"
                aria-expanded="true"
                aria-controls="posho-palette-list"
                aria-activedescendant={`posho-palette-item-${activeIndex}`}
              />

              <kbd className="posho-palette-esc">esc</kbd>
            </div>

            <div
              id="posho-palette-list"
              role="listbox"
              aria-label="Results"
              className="posho-palette-list"
              ref={
                listRef
              }
            >
              {searching && (
                <p className="posho-palette-empty">
                  Searching…
                </p>
              )}

              {!searching &&
                flatItems.length ===
                  0 && (
                  <div className="posho-palette-empty">
                    <strong>No matches found</strong>
                    <span>
                      Try a project reference, client name, or payment reference.
                    </span>
                  </div>
                )}

              {!searching &&
                groupedItems.map((group) => (
                  <div
                    key={group.name}
                    className="posho-palette-section"
                  >
                    <p className="posho-palette-section-title">
                      {group.name}
                    </p>

                    {group.items.map((item) => {
                      const index = item.globalIndex;
                      const isActive = index === activeIndex;

                      return (
                        <button
                          key={`${item.kind}-${item.label}-${index}`}
                          id={`posho-palette-item-${index}`}
                          role="option"
                          aria-selected={isActive}
                          data-active={isActive}
                          type="button"
                          className={
                            isActive ? 'active' : ''
                          }
                          onClick={() => item.run()}
                          onMouseEnter={() =>
                            setActiveIndex(index)
                          }
                        >
                          <span className="posho-palette-icon">
                            <Icon
                              name={
                                item.icon ||
                                KIND_ICON[item.kind] ||
                                'arrow_forward'
                              }
                              size={17}
                            />
                          </span>

                          <span className="posho-palette-text">
                            <strong>{item.label}</strong>

                            {item.detail && (
                              <small>{item.detail}</small>
                            )}
                          </span>

                          {isActive && (
                            <span
                              className="posho-palette-enter"
                              aria-hidden="true"
                            >
                              ↵
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
            </div>

            <p className="posho-palette-footer">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> navigate
              </span>
              <span>
                <kbd>↵</kbd> open
              </span>
              <span>
                <kbd>esc</kbd> close
              </span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
