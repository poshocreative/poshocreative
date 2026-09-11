import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';


import Icon from '../components/ui/Icon';
import BrandLoader from '../components/BrandLoader';
import PageHeader from '../components/ui/PageHeader';
import Tabs from '../components/ui/Tabs';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  EmptyState,
  ErrorBlock,
} from '../components/ui/StateBlocks';

import {
  useToast,
} from '../components/ui/Toast';

import {
  useEscapeClose,
} from '../components/ui/useEscapeClose';

import {
  getAdminCatalog,
  updateCatalogItem,
} from '../lib/admin';

import {
  getServicesHub,
  runSalesAction,
} from '../lib/sales';

import {
  formatNaira,
} from '../lib/reports';

const PRICING_MODELS = [
  'fixed',
  'starting_at',
  'monthly',
  'custom',
];

const PACKAGE_MODELS = [
  'fixed',
  'starting_from',
  'custom_quote',
  'hourly',
  'retainer',
  'subscription',
  'package',
];

const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'date',
  'select',
  'multi_select',
  'radio',
  'checkbox',
  'url',
  'email',
  'file',
];

function pretty(
  value,
) {
  return String(
    value ||
      '',
  ).replaceAll(
    '_',
    ' ',
  );
}

export default function AdminServices() {
  const toast =
    useToast();

  const [
    tab,
    setTab,
  ] =
    useState(
      'catalog',
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
    catalog,
    setCatalog,
  ] =
    useState([]);

  const [
    packages,
    setPackages,
  ] =
    useState([]);

  const [
    intake,
    setIntake,
  ] =
    useState([]);

  const [
    templates,
    setTemplates,
  ] =
    useState([]);

  const [
    serviceFilter,
    setServiceFilter,
  ] =
    useState('all');

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    serviceForm,
    setServiceForm,
  ] =
    useState(null);

  const [
    packageForm,
    setPackageForm,
  ] =
    useState(null);

  const [
    deleting,
    setDeleting,
  ] =
    useState(null);

  const [
    intakeDraft,
    setIntakeDraft,
  ] =
    useState([]);

  const [
    intakeDirty,
    setIntakeDirty,
  ] =
    useState(false);

  const [
    templateDraft,
    setTemplateDraft,
  ] =
    useState([]);

  const [
    templateDirty,
    setTemplateDirty,
  ] =
    useState(false);

  useEscapeClose(
    Boolean(
      serviceForm,
    ) && !busy,
    () =>
      setServiceForm(
        null,
      ),
  );

  useEscapeClose(
    Boolean(
      packageForm,
    ) && !busy,
    () =>
      setPackageForm(
        null,
      ),
  );

  const load =
    useCallback(
      async () => {
        try {
          setError('');
          setLoading(
            true,
          );

          const [
            catalogRows,
            hub,
          ] =
            await Promise.all([
              getAdminCatalog(),
              getServicesHub(),
            ]);

          setCatalog(
            catalogRows,
          );
          setPackages(
            hub.packages,
          );
          setIntake(
            hub.intakeFields,
          );
          setTemplates(
            hub.milestoneTemplates,
          );
        } catch (loadError) {
          setError(
            loadError.message ||
              'Services could not be loaded.',
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
      'Services | Posho Creative Management';

    load();
  }, [
    load,
  ]);

  const services = useMemo(
    () => {
      const map =
        new Map();

      for (const item of catalog) {
        if (
          !map.has(
            item.service_slug,
          )
        ) {
          map.set(
            item.service_slug,
            {
              slug: item.service_slug,
              title: pretty(
                item.service_slug,
              ),
              types: [],
            },
          );
        }

        map
          .get(
            item.service_slug,
          )
          .types.push(
            item,
          );
      }

      return [...map.values()];
    },
    [
      catalog,
    ],
  );

  useEffect(() => {
    if (
      serviceFilter !==
        'all' &&
      !services.some(
        (
          service,
        ) =>
          service.slug ===
          serviceFilter,
      )
    ) {
      setServiceFilter(
        'all',
      );
    }
  }, [
    services,
    serviceFilter,
  ]);

  const activeService =
    serviceFilter === 'all'
      ? null
      : serviceFilter;

  useEffect(() => {
    setIntakeDraft(
      intake
        .filter(
          (
            field,
          ) =>
            !activeService ||
            field.service_slug ===
              activeService,
        )
        .map(
          (
            field,
          ) => ({
            field_key:
              field.field_key,
            label:
              field.label,
            field_type:
              field.field_type,
            required:
              field.required,
            options: (
              field.options ||
              []
            ).join(
              '\n',
            ),
          }),
        ),
    );
    setIntakeDirty(
      false,
    );
  }, [
    intake,
    activeService,
  ]);

  useEffect(() => {
    setTemplateDraft(
      templates
        .filter(
          (
            template,
          ) =>
            !activeService ||
            template.service_slug ===
              activeService,
        )
        .map(
          (
            template,
          ) => ({
            title:
              template.title,
            description:
              template.description ||
              '',
            default_duration_days:
              String(
                template.default_duration_days ??
                  7,
              ),
          }),
        ),
    );
    setTemplateDirty(
      false,
    );
  }, [
    templates,
    activeService,
  ]);

  const saveService = async (
    event,
  ) => {
    event.preventDefault();

    try {
      setBusy(
        true,
      );

      if (
        serviceForm.id
      ) {
        await updateCatalogItem(
          serviceForm.id,
          {
            title:
              serviceForm.title.trim(),
            description:
              serviceForm.description.trim() ||
              null,
            pricing_type:
              serviceForm.pricing_type,
            price_kobo:
              serviceForm.pricing_type ===
              'custom'
                ? null
                : Math.round(
                    Number(
                      serviceForm.price ||
                        0,
                    ) * 100,
                  ),
            active:
              serviceForm.active,
            sort_order:
              Math.round(
                Number(
                  serviceForm.sort_order ||
                    0,
                ),
              ),
          },
        );
      } else {
        await runSalesAction({
          action:
            'service_save',
          service_slug:
            serviceForm.service_slug.trim(),
          project_type:
            serviceForm.project_type.trim() ||
            'general',
          title:
            serviceForm.title.trim(),
          description:
            serviceForm.description.trim(),
          pricing_type:
            serviceForm.pricing_type,
          price_kobo:
            Math.round(
              Number(
                serviceForm.price ||
                  0,
              ) * 100,
            ),
          active:
            serviceForm.active,
          sort_order:
            Math.round(
              Number(
                serviceForm.sort_order ||
                  0,
              ),
            ),
        });
      }

      toast.success(
        'Service saved.',
      );
      setServiceForm(
        null,
      );
      await load();
    } catch (saveError) {
      toast.error(
        saveError.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  const savePackage = async (
    event,
  ) => {
    event.preventDefault();

    try {
      setBusy(
        true,
      );

      await runSalesAction({
        action:
          'package_save',
        id:
          packageForm.id ||
          undefined,
        service_slug:
          packageForm.service_slug,
        name:
          packageForm.name.trim(),
        tagline:
          packageForm.tagline.trim(),
        features:
          packageForm.features
            .split(
              '\n',
            )
            .map(
              (
                line,
              ) =>
                line.trim(),
            )
            .filter(
              Boolean,
            ),
        price_kobo:
          packageForm.price ===
            '' ||
          packageForm.price ===
            null
            ? null
            : Math.round(
                Number(
                  packageForm.price,
                ) * 100,
              ),
        pricing_model:
          packageForm.pricing_model,
        active:
          packageForm.active,
        sort_order:
          Math.round(
            Number(
              packageForm.sort_order ||
                0,
            ),
          ),
      });

      toast.success(
        'Package saved.',
      );
      setPackageForm(
        null,
      );
      await load();
    } catch (packageError) {
      toast.error(
        packageError.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  const saveIntake = async () => {
    if (!activeService) {
      toast.error(
        'Choose a service first.',
      );

      return;
    }

    try {
      setBusy(
        true,
      );

      await runSalesAction({
        action:
          'intake_save',
        service_slug:
          activeService,
        fields: intakeDraft
          .filter(
            (
              field,
            ) =>
              field.label.trim(),
          )
          .map(
            (
              field,
            ) => ({
              field_key:
                field.field_key.trim() ||
                field.label
                  .trim()
                  .toLowerCase()
                  .replace(
                    /[^a-z0-9_]/g,
                    '_',
                  ),
              label:
                field.label.trim(),
              field_type:
                field.field_type,
              required:
                field.required,
              options:
                String(
                  field.options ||
                    '',
                )
                  .split(
                    '\n',
                  )
                  .map(
                    (
                      option,
                    ) =>
                      option.trim(),
                  )
                  .filter(
                    Boolean,
                  ),
            }),
        ),
      });

      toast.success(
        'Intake form saved.',
      );
      setIntakeDirty(
        false,
      );
      await load();
    } catch (intakeError) {
      toast.error(
        intakeError.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  const saveTemplates = async () => {
    if (!activeService) {
      toast.error(
        'Choose a service first.',
      );

      return;
    }

    try {
      setBusy(
        true,
      );

      await runSalesAction({
        action:
          'milestone_template_save',
        service_slug:
          activeService,
        templates:
          templateDraft
            .filter(
              (
                template,
              ) =>
                template.title.trim(),
            )
            .map(
              (
                template,
              ) => ({
                title:
                  template.title.trim(),
                description:
                  template.description.trim(),
                default_duration_days:
                  template.default_duration_days,
              }),
            ),
      });

      toast.success(
        'Milestone template saved.',
      );
      setTemplateDirty(
        false,
      );
      await load();
    } catch (templateError) {
      toast.error(
        templateError.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  if (loading) {
    return (
      <BrandLoader label="Loading services…" />
    );
  }

  const visiblePackages =
    packages.filter(
      (
        item,
      ) =>
        !activeService ||
        item.service_slug ===
          activeService,
    );

  return (
    <div className="admin-view page-reveal">
      <PageHeader
        kicker="Services hub"
        title="Define Posho once"
        description="Catalog, packages, intake forms and milestone templates. No hard-coded services in order flows."
        actions={
          tab ===
            'catalog' && (
            <button
              type="button"
              className="button button-primary"
              onClick={() =>
                setServiceForm({
                  id: '',
                  service_slug: '',
                  project_type: '',
                  title: '',
                  description: '',
                  pricing_type:
                    'custom',
                  price: '',
                  active: true,
                  sort_order: '0',
                })
              }
            >
              <Icon name="add"                 size={17}
              />
              New service entry
            </button>
          )
        }
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
            Service
          </span>

          <select
            value={
              serviceFilter
            }
            onChange={(
              event,
            ) =>
              setServiceFilter(
                event.target
                  .value,
              )
            }
            aria-label="Filter by service"
          >
            <option value="all">
              All services
            </option>

            {services.map(
              (
                service,
              ) => (
                <option
                  key={
                    service.slug
                  }
                  value={
                    service.slug
                  }
                >
                  {
                    service.title
                  }
                </option>
              ),
            )}
          </select>
        </label>
      </div>

      <Tabs
        tabs={[
          {
            key: 'catalog',
            label: 'Catalog',
          },
          {
            key: 'packages',
            label: 'Packages',
          },
          {
            key: 'intake',
            label: 'Intake forms',
          },
          {
            key: 'templates',
            label: 'Milestones',
          },
        ]}
        active={
          tab
        }
        onChange={
          setTab
        }
        label="Services sections"
      />

      {tab ===
        'catalog' && (
        <div className="admin-data-card">
          {catalog
            .filter(
              (
                item,
              ) =>
                !activeService ||
                item.service_slug ===
                  activeService,
            )
            .map(
              (
                item,
              ) => (
                <article
                  key={
                    item.id
                  }
                  className="admin-data-row"
                >
                  <div>
                    <small className="posho-long-value">
                      {
                        item.service_slug
                      }{' '}
                      ·{' '}
                      {
                        item.project_type
                      }
                    </small>

                    <strong>
                      {
                        item.title
                      }
                    </strong>

                    <span>
                      {item.pricing_type ===
                      'custom'
                        ? 'Custom quote'
                        : `${pretty(item.pricing_type)} · ${formatNaira(item.price_kobo)}`}
                      {!item.active &&
                        ' · Inactive'}
                    </span>
                  </div>

                  <div className="finance-review-actions">
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() =>
                        setServiceForm({
                          id: item.id,
                          service_slug:
                            item.service_slug,
                          project_type:
                            item.project_type,
                          title:
                            item.title,
                          description:
                            item.description ||
                            '',
                          pricing_type:
                            item.pricing_type,
                          price:
                            item.price_kobo !=
                            null
                              ? String(
                                  Number(
                                    item.price_kobo,
                                  ) /
                                    100,
                                )
                              : '',
                          active:
                            item.active,
                          sort_order:
                            String(
                              item.sort_order ??
                                0,
                            ),
                        })
                      }
                    >
                      Edit
                    </button>
                  </div>
                </article>
              ),
            )}
        </div>
      )}

      {tab ===
        'packages' && (
        <>
          <div className="finance-review-actions">
            <button
              type="button"
              className="button button-primary"
              disabled={
                !activeService &&
                services.length >
                  0
              }
              title={
                !activeService &&
                services.length >
                  0
                  ? 'Choose a service first'
                  : undefined
              }
              onClick={() =>
                setPackageForm({
                  id: '',
                  service_slug:
                    activeService ||
                    services[0]
                      ?.slug ||
                    '',
                  name: '',
                  tagline: '',
                  features: '',
                  price: '',
                  pricing_model:
                    'package',
                  active: true,
                  sort_order:
                    '0',
                })
              }
            >
              <Icon name="add"                 size={17}
              />
              New package
            </button>
          </div>

          {visiblePackages.length ===
          0 ? (
            <EmptyState
              title="No packages yet"
              body="Starter, Business and Custom tiers become clean quote line items."
            />
          ) : (
            <div className="admin-data-card">
              {visiblePackages.map(
                (
                  item,
                ) => (
                  <article
                    key={
                      item.id
                    }
                    className="admin-data-row"
                  >
                    <div>
                      <small>
                        {
                          item.service_slug
                        }{' '}
                        ·{' '}
                        {pretty(
                          item.pricing_model,
                        )}
                      </small>

                      <strong>
                        {
                          item.name
                        }
                      </strong>

                      <span>
                        {item.price_kobo !=
                        null
                          ? formatNaira(
                              item.price_kobo,
                            )
                          : 'Priced on quote'}
                        {!item.active &&
                          ' · Inactive'}
                      </span>

                      {(item.features ||
                        [])
                        .length >
                        0 && (
                        <span className="posho-long-value">
                          {(
                            item.features ||
                            []
                          ).join(
                            ' · ',
                          )}
                        </span>
                      )}
                    </div>

                    <div className="finance-review-actions">
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() =>
                          setPackageForm({
                            id: item.id,
                            service_slug:
                              item.service_slug,
                            name: item.name,
                            tagline:
                              item.tagline ||
                              '',
                            features: (
                              item.features ||
                              []
                            ).join(
                              '\n',
                            ),
                            price:
                              item.price_kobo !=
                              null
                                ? String(
                                    Number(
                                      item.price_kobo,
                                    ) /
                                      100,
                                  )
                                : '',
                            pricing_model:
                              item.pricing_model,
                            active:
                              item.active,
                            sort_order:
                              String(
                                item.sort_order ??
                                  0,
                              ),
                          })
                        }
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="button button-secondary"
                        aria-label={`Delete ${item.name}`}
                        onClick={() =>
                          setDeleting({
                            kind: 'package',
                            id: item.id,
                            label:
                              item.name,
                          })
                        }
                      >
                        <Icon name="delete"                           size={15}
                        />
                      </button>
                    </div>
                  </article>
                ),
              )}
            </div>
          )}
        </>
      )}

      {tab ===
        'intake' && (
        <>
          {!activeService ? (
            <EmptyState
              title="Choose a service"
              body="Select a service above to design its intake form."
            />
          ) : (
            <>
              {intakeDraft.map(
                (
                  field,
                  index,
                ) => (
                  <div
                    key={
                      index
                    }
                    className="posho-form-grid"
                    style={{
                      borderTop:
                        '1px solid var(--posho-line)',
                      paddingTop: 12,
                      marginTop: 12,
                    }}
                  >
                    <div className="posho-grid-duo">
                      <label>
                        <span>
                          Label
                        </span>

                        <input
                          value={
                            field.label
                          }
                          onChange={(
                            event,
                          ) => {
                            setIntakeDraft(
                              (
                                current,
                              ) =>
                                current.map(
                                  (
                                    row,
                                    position,
                                  ) =>
                                    position ===
                                    index
                                      ? {
                                          ...row,
                                          label:
                                            event
                                              .target
                                              .value,
                                        }
                                      : row,
                                ),
                            );
                            setIntakeDirty(
                              true,
                            );
                          }}
                          maxLength={120}
                        />
                      </label>

                      <label>
                        <span>
                          Type
                        </span>

                        <select
                          value={
                            field.field_type
                          }
                          onChange={(
                            event,
                          ) => {
                            setIntakeDraft(
                              (
                                current,
                              ) =>
                                current.map(
                                  (
                                    row,
                                    position,
                                  ) =>
                                    position ===
                                    index
                                      ? {
                                          ...row,
                                          field_type:
                                            event
                                              .target
                                              .value,
                                        }
                                      : row,
                                ),
                            );
                            setIntakeDirty(
                              true,
                            );
                          }}
                        >
                          {FIELD_TYPES.map(
                            (
                              type,
                            ) => (
                              <option
                                key={
                                  type
                                }
                                value={
                                  type
                                }
                              >
                                {type.replaceAll(
                                  '_',
                                  ' ',
                                )}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </div>

                    <label>
                      <span>
                        Options (one per line,
                        for choice fields)
                      </span>

                      <textarea
                        value={
                          field.options
                        }
                        onChange={(
                          event,
                        ) => {
                          setIntakeDraft(
                            (
                              current,
                            ) =>
                              current.map(
                                (
                                  row,
                                  position,
                                ) =>
                                  position ===
                                  index
                                    ? {
                                        ...row,
                                        options:
                                          event
                                            .target
                                            .value,
                                      }
                                    : row,
                              ),
                          );
                          setIntakeDirty(
                            true,
                          );
                        }}
                      />
                    </label>

                    <div
                      className="finance-review-actions"
                    >
                      <label className="finance-checkbox-row">
                        <input
                          type="checkbox"
                          checked={
                            field.required
                          }
                          onChange={(
                            event,
                          ) => {
                            setIntakeDraft(
                              (
                                current,
                              ) =>
                                current.map(
                                  (
                                    row,
                                    position,
                                  ) =>
                                    position ===
                                    index
                                      ? {
                                          ...row,
                                          required:
                                            event
                                              .target
                                              .checked,
                                        }
                                      : row,
                                ),
                            );
                            setIntakeDirty(
                              true,
                            );
                          }}
                        />

                        <span>
                          Required
                        </span>
                      </label>

                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => {
                          setIntakeDraft(
                            (
                              current,
                            ) =>
                              current.filter(
                                (
                                  _,
                                  position,
                                ) =>
                                  position !==
                                  index,
                              ),
                          );
                          setIntakeDirty(
                            true,
                          );
                        }}
                      >
                        <Icon name="delete"                           size={15}
                        />
                        Remove
                      </button>
                    </div>
                  </div>
                ),
              )}

              <div className="finance-review-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    setIntakeDraft(
                      (
                        current,
                      ) => [
                        ...current,
                        {
                          field_key: '',
                          label: '',
                          field_type:
                            'text',
                          required:
                            false,
                          options:
                            '',
                        },
                      ],
                    );
                    setIntakeDirty(
                      true,
                    );
                  }}
                >
                  <Icon name="add"                     size={17}
                  />
                  Add field
                </button>

                <button
                  type="button"
                  className="button button-primary"
                  disabled={
                    busy ||
                    !intakeDirty
                  }
                  aria-busy={
                    busy
                  }
                  onClick={
                    saveIntake
                  }
                >
                  {busy
                    ? 'Saving…'
                    : 'Save intake form'}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {tab ===
        'templates' && (
        <>
          {!activeService ? (
            <EmptyState
              title="Choose a service"
              body="Select a service above to define its default milestones."
            />
          ) : (
            <>
              {templateDraft.map(
                (
                  template,
                  index,
                ) => (
                  <div
                    key={
                      index
                    }
                    className="posho-form-grid"
                    style={{
                      borderTop:
                        '1px solid var(--posho-line)',
                      paddingTop: 12,
                      marginTop: 12,
                    }}
                  >
                    <label>
                      <span>
                        Milestone{' '}
                        {index +
                          1}
                      </span>

                      <input
                        value={
                          template.title
                        }
                        onChange={(
                          event,
                        ) => {
                          setTemplateDraft(
                            (
                              current,
                            ) =>
                              current.map(
                                (
                                  row,
                                  position,
                                ) =>
                                  position ===
                                  index
                                    ? {
                                        ...row,
                                        title:
                                          event
                                            .target
                                            .value,
                                      }
                                    : row,
                              ),
                          );
                          setTemplateDirty(
                            true,
                          );
                        }}
                        maxLength={160}
                      />
                    </label>

                    <label>
                      <span>
                        Description
                      </span>

                      <input
                        value={
                          template.description
                        }
                        onChange={(
                          event,
                        ) => {
                          setTemplateDraft(
                            (
                              current,
                            ) =>
                              current.map(
                                (
                                  row,
                                  position,
                                ) =>
                                  position ===
                                  index
                                    ? {
                                        ...row,
                                        description:
                                          event
                                            .target
                                            .value,
                                      }
                                    : row,
                              ),
                          );
                          setTemplateDirty(
                            true,
                          );
                        }}
                        maxLength={2000}
                      />
                    </label>

                    <div
                      className="finance-review-actions"
                    >
                      <label>
                        <span>
                          Days
                        </span>

                        <input
                          type="number"
                          min="0"
                          value={
                            template.default_duration_days
                          }
                          onChange={(
                            event,
                          ) => {
                            setTemplateDraft(
                              (
                                current,
                              ) =>
                                current.map(
                                  (
                                    row,
                                    position,
                                  ) =>
                                    position ===
                                    index
                                      ? {
                                          ...row,
                                          default_duration_days:
                                            event
                                              .target
                                              .value,
                                        }
                                      : row,
                                ),
                            );
                            setTemplateDirty(
                              true,
                            );
                          }}
                          style={{
                            width: 100,
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => {
                          setTemplateDraft(
                            (
                              current,
                            ) =>
                              current.filter(
                                (
                                  _,
                                  position,
                                ) =>
                                  position !==
                                  index,
                              ),
                          );
                          setTemplateDirty(
                            true,
                          );
                        }}
                      >
                        <Icon name="delete"                           size={15}
                        />
                        Remove
                      </button>
                    </div>
                  </div>
                ),
              )}

              <div className="finance-review-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    setTemplateDraft(
                      (
                        current,
                      ) => [
                        ...current,
                        {
                          title: '',
                          description:
                            '',
                          default_duration_days:
                            '7',
                        },
                      ],
                    );
                    setTemplateDirty(
                      true,
                    );
                  }}
                >
                  <Icon name="add"                     size={17}
                  />
                  Add milestone
                </button>

                <button
                  type="button"
                  className="button button-primary"
                  disabled={
                    busy ||
                    !templateDirty
                  }
                  aria-busy={
                    busy
                  }
                  onClick={
                    saveTemplates
                  }
                >
                  {busy
                    ? 'Saving…'
                    : 'Save template'}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {serviceForm && (
        <div
          className="posho-modal-backdrop"
          onClick={() =>
            !busy &&
            setServiceForm(
              null,
            )
          }
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Service entry"
            className="posho-modal"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
            onSubmit={
              saveService
            }
          >
            <div className="posho-modal-heading">
              <h3>
                {serviceForm.id
                  ? 'Edit service'
                  : 'New service entry'}
              </h3>

              <button
                type="button"
                onClick={() =>
                  setServiceForm(
                    null,
                  )
                }
                aria-label="Close service form"
                disabled={
                  busy
                }
              >
                <Icon name="close"                   size={19}
                />
              </button>
            </div>

            <div className="posho-form-grid">
              {!serviceForm.id && (
                <>
                  <label>
                    <span>
                      Service slug
                    </span>

                    <input
                      value={
                        serviceForm.service_slug
                      }
                      onChange={(
                        event,
                      ) =>
                        setServiceForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            service_slug:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                      required
                      maxLength={80}
                      placeholder="website-development"
                    />
                  </label>

                  <label>
                    <span>
                      Project type
                    </span>

                    <input
                      value={
                        serviceForm.project_type
                      }
                      onChange={(
                        event,
                      ) =>
                        setServiceForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            project_type:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                      required
                      maxLength={80}
                      placeholder="landing-page"
                    />
                  </label>
                </>
              )}

              <label>
                <span>
                  Title
                </span>

                <input
                  value={
                    serviceForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setServiceForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        title:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  required
                  maxLength={160}
                />
              </label>

              <label>
                <span>
                  Description
                </span>

                <textarea
                  value={
                    serviceForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setServiceForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        description:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  maxLength={2000}
                />
              </label>

              <label>
                <span>
                  Pricing model
                </span>

                <select
                  value={
                    serviceForm.pricing_type
                  }
                  onChange={(
                    event,
                  ) =>
                    setServiceForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        pricing_type:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                >
                  {PRICING_MODELS.map(
                    (
                      model,
                    ) => (
                      <option
                        key={
                          model
                        }
                        value={
                          model
                        }
                      >
                        {pretty(
                          model,
                        )}
                      </option>
                    ),
                  )}
                </select>
              </label>

              {serviceForm.pricing_type !==
                'custom' && (
                <label>
                  <span>
                    Price (₦)
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      serviceForm.price
                    }
                    onChange={(
                      event,
                    ) =>
                      setServiceForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          price:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />
                </label>
              )}

              <label>
                <span>
                  Sort order
                </span>

                <input
                  type="number"
                  step="1"
                  value={
                    serviceForm.sort_order
                  }
                  onChange={(
                    event,
                  ) =>
                    setServiceForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        sort_order:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                />
              </label>

              <label className="finance-checkbox-row">
                <input
                  type="checkbox"
                  checked={
                    serviceForm.active
                  }
                  onChange={(
                    event,
                  ) =>
                    setServiceForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        active:
                          event
                            .target
                            .checked,
                      }),
                    )
                  }
                />

                <span>
                  Active
                </span>
              </label>
            </div>

            <div className="posho-modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setServiceForm(
                    null,
                  )
                }
                disabled={
                  busy
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="button button-primary"
                disabled={
                  busy
                }
                aria-busy={
                  busy
                }
              >
                {busy
                  ? 'Saving…'
                  : 'Save service'}
              </button>
            </div>
          </form>
        </div>
      )}

      {packageForm && (
        <div
          className="posho-modal-backdrop"
          onClick={() =>
            !busy &&
            setPackageForm(
              null,
            )
          }
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Service package"
            className="posho-modal"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
            onSubmit={
              savePackage
            }
          >
            <div className="posho-modal-heading">
              <h3>
                {packageForm.id
                  ? 'Edit package'
                  : 'New package'}
              </h3>

              <button
                type="button"
                onClick={() =>
                  setPackageForm(
                    null,
                  )
                }
                aria-label="Close package form"
                disabled={
                  busy
                }
              >
                <Icon name="close"                   size={19}
                />
              </button>
            </div>

            <div className="posho-form-grid">
              <label>
                <span>
                  Service
                </span>

                <select
                  value={
                    packageForm.service_slug
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        service_slug:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                >
                  {services.map(
                    (
                      service,
                    ) => (
                      <option
                        key={
                          service.slug
                        }
                        value={
                          service.slug
                        }
                      >
                        {
                          service.title
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Package name
                </span>

                <input
                  value={
                    packageForm.name
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        name: event
                          .target
                          .value,
                      }),
                    )
                  }
                  required
                  maxLength={160}
                  placeholder="Business"
                />
              </label>

              <label>
                <span>
                  Tagline
                </span>

                <input
                  value={
                    packageForm.tagline
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        tagline:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  maxLength={300}
                />
              </label>

              <label>
                <span>
                  Features (one per
                  line)
                </span>

                <textarea
                  value={
                    packageForm.features
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        features:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Price (₦, empty for
                  custom quote)
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    packageForm.price
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        price:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Pricing model
                </span>

                <select
                  value={
                    packageForm.pricing_model
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        pricing_model:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                >
                  {PACKAGE_MODELS.map(
                    (
                      model,
                    ) => (
                      <option
                        key={
                          model
                        }
                        value={
                          model
                        }
                      >
                        {pretty(
                          model,
                        )}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Sort order
                </span>

                <input
                  type="number"
                  step="1"
                  value={
                    packageForm.sort_order
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        sort_order:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                />
              </label>

              <label className="finance-checkbox-row">
                <input
                  type="checkbox"
                  checked={
                    packageForm.active
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        active:
                          event
                            .target
                            .checked,
                      }),
                    )
                  }
                />

                <span>
                  Active
                </span>
              </label>
            </div>

            <div className="posho-modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setPackageForm(
                    null,
                  )
                }
                disabled={
                  busy
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="button button-primary"
                disabled={
                  busy
                }
                aria-busy={
                  busy
                }
              >
                {busy
                  ? 'Saving…'
                  : 'Save package'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(
          deleting,
        )}
        title="Delete package"
        description={
          deleting
            ? `Delete the "${deleting.label}" package? Quotes already issued are unaffected.`
            : ''
        }
        confirmLabel="Delete"
        busy={
          busy
        }
        busyLabel="Deleting…"
        onClose={() =>
          !busy &&
          setDeleting(
            null,
          )
        }
        onConfirm={async () => {
          try {
            setBusy(
              true,
            );

            await runSalesAction({
              action:
                'package_delete',
              id: deleting.id,
            });

            toast.success(
              'Package deleted.',
            );
            setDeleting(
              null,
            );
            await load();
          } catch (deleteError) {
            toast.error(
              deleteError.message,
            );
          } finally {
            setBusy(
              false,
            );
          }
        }}
      />
    </div>
  );
}
