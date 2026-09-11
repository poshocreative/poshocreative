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
    group: 'Go to',
    label: 'Overview',
    keywords: 'home dashboard overview',
    suffix: '',
  },
  {
    group: 'Go to',
    label: 'Projects',
    keywords: 'projects orders list',
    suffix: 'orders',
  },
  {
    group: 'Go to',
    label: 'Work board',
    keywords: 'tasks board kanban work',
    suffix: 'work',
  },
  {
    group: 'Go to',
    label: 'Clients',
    keywords: 'clients customers crm',
    suffix: 'customers',
  },
  {
    group: 'Go to',
    label: 'Sales pipeline',
    keywords: 'sales leads pipeline crm',
    suffix: 'sales',
    capability: 'sales.manage',
  },
  {
    group: 'Go to',
    label: 'Finance',
    keywords: 'finance money revenue cash',
    suffix: 'finance',
    capability: 'finance.manage',
  },
  {
    group: 'Go to',
    label: 'Reports',
    keywords: 'reports analytics export',
    suffix: 'reports',
    capability: 'reports.view',
  },
  {
    group: 'Go to',
    label: 'Service requests',
    keywords: 'requests queue support maintenance',
    suffix: 'requests',
    capability: 'requests.manage',
  },
  {
    group: 'Go to',
    label: 'Services hub',
    keywords: 'services packages pricing catalog',
    suffix: 'services',
    capability: 'services.manage',
  },
  {
    group: 'Go to',
    label: 'Team',
    keywords: 'team members capacity planner',
    suffix: 'team',
    capability: 'team.manage',
  },
  {
    group: 'Go to',
    label: 'Automations',
    keywords: 'automations rules workflow',
    suffix: 'automations',
    capability: 'automations.manage',
  },
  {
    group: 'Go to',
    label: 'Activity',
    keywords: 'activity feed audit log',
    suffix: 'activity',
    capability: 'reports.view',
  },
  {
    group: 'Go to',
    label: 'Settings',
    keywords: 'settings configuration flags sop',
    suffix: 'settings',
    capability: 'settings.manage',
  },
  {
    group: 'Go to',
    label: 'Payments',
    keywords: 'payments transactions flutterwave',
    suffix: 'payments',
    capability: 'finance.manage',
  },
  {
    group: 'Go to',
    label: 'Quotes',
    keywords: 'quotes quotations',
    suffix: 'quotes',
    capability: 'finance.manage',
  },
  {
    group: 'Create',
    label: 'New lead',
    keywords: 'create new lead inquiry',
    suffix: 'sales',
    capability: 'sales.manage',
  },
  {
    group: 'Create',
    label: 'New service request',
    keywords: 'create new request support maintenance',
    suffix: 'requests',
    capability: 'requests.manage',
  },
  {
    group: 'Create',
    label: 'New proposal',
    keywords: 'create proposal quote commercial',
    suffix: 'sales',
    capability: 'sales.manage',
  },
];

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
              `${command.label} ${command.keywords}`
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
            command.keywords
              .split(
                ' ',
              )
              .slice(
                0,
                3,
              )
              .join(
                ' · ',
              ),
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
            'Projects',
          label:
            project.project_title,
          detail:
            project.reference,
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
            'Clients',
          label:
            client.full_name ||
            client.email,
          detail:
            client.business_name ||
            client.email,
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
            'Finance',
          label:
            item.kind ===
            'payment'
              ? item.provider_reference
              : `Quote ${String(item.id).slice(0, 8)}`,
          detail:
            item.kind ===
            'payment'
              ? item.status
              : item.status,
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
            'Requests',
          label:
            request.title,
          detail:
            request.reference,
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
            'Leads',
          label:
            lead.company ||
            lead.name,
          detail:
            lead.reference,
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
                placeholder="Search projects, clients, payments, requests, leads — or type a destination…"
                aria-label="Search or type a command"
                role="combobox"
                aria-expanded="true"
                aria-controls="posho-palette-list"
                aria-activedescendant={`posho-palette-item-${activeIndex}`}
              />
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
                <p className="posho-palette-hint">
                  Searching…
                </p>
              )}

              {!searching &&
                flatItems.length ===
                  0 && (
                  <p className="posho-palette-hint">
                    No matches. Try a project reference,
                    client name, or payment reference.
                  </p>
                )}

              {flatItems.map(
                (
                  item,
                  index,
                ) => (
                  <button
                    key={`${item.kind}-${item.label}-${index}`}
                    id={`posho-palette-item-${index}`}
                    role="option"
                    aria-selected={
                      index ===
                      activeIndex
                    }
                    data-active={
                      index ===
                      activeIndex
                    }
                    type="button"
                    className={
                      index ===
                      activeIndex
                        ? 'active'
                        : ''
                    }
                    onClick={() =>
                      item.run()
                    }
                    onMouseEnter={() =>
                      setActiveIndex(
                        index,
                      )
                    }
                  >
                    <span className="posho-palette-group">
                      {
                        item.group
                      }
                    </span>

                    <strong>
                      {
                        item.label
                      }
                    </strong>

                    {item.detail && (
                      <small>
                        {
                          item.detail
                        }
                      </small>
                    )}
                  </button>
                ),
              )}
            </div>

            <p className="posho-palette-hint">
              ↑ ↓ to move · Enter to open · Esc to
              close
            </p>
          </div>
        </div>
      )}
    </>
  );
}
