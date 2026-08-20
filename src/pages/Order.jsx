import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileText,
  LockKeyhole,
  Mail,
  Paperclip,
  Phone,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserRound,
} from 'lucide-react';

import {
  Link,
  useSearchParams,
} from 'react-router-dom';

import {
  useAuth,
} from '../context/AuthContext';

import {
  budgetOptions,
  contactMethods,
  getOrderService,
  orderCatalog,
  timelineOptions,
} from '../data/orderCatalog';

import {
  createProjectOrder,
  formatMoney,
} from '../lib/orders';

import {
  supabase,
} from '../lib/supabase';

const DRAFT_KEY =
  'poshoCreativeOrderDraft';

const steps = [
  {
    id: 1,
    label: 'Service',
  },
  {
    id: 2,
    label: 'Project',
  },
  {
    id: 3,
    label: 'Brief',
  },
  {
    id: 4,
    label: 'Budget',
  },
  {
    id: 5,
    label: 'Contact',
  },
  {
    id: 6,
    label: 'Review',
  },
];

const allowedFileTypes =
  new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]);

function createEmptyForm(
  service = '',
) {
  return {
    service,

    projectType:
      '',

    projectTitle:
      '',

    projectDescription:
      '',

    projectGoal:
      '',

    referenceLinks:
      '',

    budget:
      '',

    timeline:
      '',

    deadline:
      '',

    fullName:
      '',

    email:
      '',

    phone:
      '',

    businessName:
      '',

    contactMethod:
      'whatsapp',

    confirmation:
      false,
  };
}

function formatFileSize(
  bytes,
) {
  if (
    bytes <
    1024
  ) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 *
      1024
  ) {
    return `${(
      bytes /
      1024
    ).toFixed(
      1,
    )} KB`;
  }

  return `${(
    bytes /
    (
      1024 *
      1024
    )
  ).toFixed(
    1,
  )} MB`;
}

function formatCatalogPrice(
  item,
) {
  if (!item) {
    return 'Price confirmed during review';
  }

  if (
    item.pricing_type ===
    'custom'
  ) {
    return 'Custom quote';
  }

  if (
    item.price_kobo ===
      null ||
    item.price_kobo ===
      undefined
  ) {
    return 'Quote required';
  }

  const money =
    formatMoney(
      item.price_kobo,
      item.currency ||
        'NGN',
    );

  if (
    item.pricing_type ===
    'starting_at'
  ) {
    return `From ${money}`;
  }

  if (
    item.pricing_type ===
    'monthly'
  ) {
    return `${money} / month`;
  }

  return money;
}

export default function Order() {
  const {
    user,
    profile,
  } =
    useAuth();

  const [
    searchParams,
    setSearchParams,
  ] =
    useSearchParams();

  const queryService =
    searchParams.get(
      'service',
    ) || '';

  const validQueryService =
    getOrderService(
      queryService,
    )
      ? queryService
      : '';

  const [
    currentStep,
    setCurrentStep,
  ] =
    useState(1);

  const [
    form,
    setForm,
  ] =
    useState(() => {
      const stored =
        localStorage
          .getItem(
            DRAFT_KEY,
          );

      if (stored) {
        try {
          const parsed =
            JSON.parse(
              stored,
            );

          return {
            ...createEmptyForm(
              validQueryService,
            ),

            ...parsed,

            service:
              validQueryService ||
              parsed.service ||
              '',

            confirmation:
              false,
          };
        } catch {
          return createEmptyForm(
            validQueryService,
          );
        }
      }

      return createEmptyForm(
        validQueryService,
      );
    });

  const [
    files,
    setFiles,
  ] =
    useState([]);

  const [
    catalog,
    setCatalog,
  ] =
    useState([]);

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    submissionStage,
    setSubmissionStage,
  ] =
    useState('');

  const [
    submittedOrder,
    setSubmittedOrder,
  ] =
    useState(null);

  const selectedService =
    useMemo(
      () =>
        getOrderService(
          form.service,
        ),

      [
        form.service,
      ],
    );

  const selectedProjectType =
    useMemo(
      () =>
        selectedService
          ?.projectTypes
          ?.find(
            (
              item,
            ) =>
              item.id ===
              form.projectType,
          ),

      [
        selectedService,
        form.projectType,
      ],
    );

  const selectedBudget =
    useMemo(
      () =>
        budgetOptions
          .find(
            (
              item,
            ) =>
              item.id ===
              form.budget,
          ),

      [
        form.budget,
      ],
    );

  const selectedTimeline =
    useMemo(
      () =>
        timelineOptions
          .find(
            (
              item,
            ) =>
              item.id ===
              form.timeline,
          ),

      [
        form.timeline,
      ],
    );

  const selectedContact =
    useMemo(
      () =>
        contactMethods
          .find(
            (
              item,
            ) =>
              item.id ===
              form.contactMethod,
          ),

      [
        form.contactMethod,
      ],
    );

  const catalogMap =
    useMemo(
      () =>
        new Map(
          catalog.map(
            (
              item,
            ) => [
              `${item.service_slug}:${item.project_type}`,
              item,
            ],
          ),
        ),

      [
        catalog,
      ],
    );

  const selectedCatalogItem =
    useMemo(
      () =>
        catalogMap.get(
          `${form.service}:${form.projectType}`,
        ) ||
        null,

      [
        catalogMap,
        form.service,
        form.projectType,
      ],
    );

  useEffect(() => {
    document.title =
      'Start a Project | Posho Creative';

    /*
     * Remove legacy fake submitted orders
     * from the old prototype.
     *
     * Draft data may still stay locally,
     * but submitted orders are now server-only.
     */
    localStorage.removeItem(
      'poshoCreativeLocalOrders',
    );
  }, []);

  useEffect(() => {
    const loadCatalog =
      async () => {
        try {
          const {
            data,
            error:
              catalogError,
          } =
            await supabase
              .from(
                'service_catalog',
              )
              .select(`
                id,
                service_slug,
                project_type,
                title,
                pricing_type,
                price_kobo,
                currency,
                active,
                sort_order
              `)
              .eq(
                'active',
                true,
              )
              .order(
                'sort_order',
                {
                  ascending:
                    true,
                },
              );

          if (
            catalogError
          ) {
            console.warn(
              'Service pricing could not be loaded:',
              catalogError,
            );

            return;
          }

          setCatalog(
            data ||
              [],
          );
        } catch (
          catalogError
        ) {
          console.warn(
            'Service catalogue unavailable:',
            catalogError,
          );
        }
      };

    loadCatalog();
  }, []);

  useEffect(() => {
    setForm(
      (
        current,
      ) => ({
        ...current,

        fullName:
          current.fullName ||
          profile
            ?.full_name ||
          user
            ?.user_metadata
            ?.full_name ||
          '',

        email:
          user?.email ||
          profile?.email ||
          current.email ||
          '',

        phone:
          current.phone ||
          profile?.phone ||
          user
            ?.user_metadata
            ?.phone ||
          '',

        businessName:
          current.businessName ||
          profile
            ?.business_name ||
          user
            ?.user_metadata
            ?.business_name ||
          '',

        contactMethod:
          current.contactMethod ||
          profile
            ?.preferred_contact_method ||
          'whatsapp',
      }),
    );
  }, [
    user,
    profile,
  ]);

  useEffect(() => {
    const saveable = {
      ...form,

      confirmation:
        false,
    };

    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify(
        saveable,
      ),
    );
  }, [
    form,
  ]);

  useEffect(() => {
    if (
      validQueryService &&
      form.service !==
        validQueryService
    ) {
      setForm(
        (
          current,
        ) => ({
          ...current,

          service:
            validQueryService,

          projectType:
            '',
        }),
      );
    }
  }, [
    validQueryService,
    form.service,
  ]);

  const updateField =
    (
      field,
      value,
    ) => {
      setForm(
        (
          current,
        ) => ({
          ...current,

          [field]:
            value,
        }),
      );

      setError('');
    };

  const chooseService =
    (
      slug,
    ) => {
      setForm(
        (
          current,
        ) => ({
          ...current,

          service:
            slug,

          projectType:
            '',
        }),
      );

      setSearchParams({
        service:
          slug,
      });

      setError('');
    };

  const handleFiles =
    (
      event,
    ) => {
      const incoming =
        Array.from(
          event
            .target
            .files ||
            [],
        );

      if (
        !incoming.length
      ) {
        return;
      }

      const invalidType =
        incoming.find(
          (
            file,
          ) =>
            file.type &&
            !allowedFileTypes.has(
              file.type,
            ),
        );

      if (
        invalidType
      ) {
        setError(
          `"${invalidType.name}" is not a supported file type. Use PNG, JPG, WEBP, PDF, DOC or DOCX.`,
        );

        event.target.value =
          '';

        return;
      }

      const tooLarge =
        incoming.find(
          (
            file,
          ) =>
            file.size >
            10 *
              1024 *
              1024,
        );

      if (
        tooLarge
      ) {
        setError(
          `"${tooLarge.name}" is larger than 10 MB.`,
        );

        event.target.value =
          '';

        return;
      }

      if (
        files.length +
          incoming.length >
        6
      ) {
        setError(
          'You can upload a maximum of 6 files.',
        );

        event.target.value =
          '';

        return;
      }

      setFiles(
        (
          current,
        ) => [
          ...current,
          ...incoming,
        ],
      );

      event.target.value =
        '';

      setError('');
    };

  const removeFile =
    (
      index,
    ) => {
      setFiles(
        (
          current,
        ) =>
          current.filter(
            (
              _,
              itemIndex,
            ) =>
              itemIndex !==
              index,
          ),
      );
    };

  const validateStep =
    () => {
      if (
        currentStep ===
          1 &&
        !form.service
      ) {
        setError(
          'Choose the Posho Creative service you need.',
        );

        return false;
      }

      if (
        currentStep ===
          2 &&
        !form.projectType
      ) {
        setError(
          'Choose the type of project you want to start.',
        );

        return false;
      }

      if (
        currentStep ===
        3
      ) {
        if (
          !form.projectTitle
            .trim()
        ) {
          setError(
            'Give your project a short title.',
          );

          return false;
        }

        if (
          form
            .projectDescription
            .trim()
            .length <
          30
        ) {
          setError(
            'Your project description should contain at least 30 characters.',
          );

          return false;
        }

        if (
          !form.projectGoal
            .trim()
        ) {
          setError(
            'Tell us what you want this project to achieve.',
          );

          return false;
        }
      }

      if (
        currentStep ===
        4
      ) {
        if (
          !form.budget
        ) {
          setError(
            'Choose your project budget range.',
          );

          return false;
        }

        if (
          !form.timeline
        ) {
          setError(
            'Choose your preferred project timeline.',
          );

          return false;
        }

        if (
          form.timeline ===
            'specific-date' &&
          !form.deadline
        ) {
          setError(
            'Enter your required deadline.',
          );

          return false;
        }
      }

      if (
        currentStep ===
        5
      ) {
        if (
          !form.fullName
            .trim()
        ) {
          setError(
            'Enter your full name.',
          );

          return false;
        }

        if (
          !user?.email
        ) {
          setError(
            'Your authenticated email could not be found. Please sign out and sign in again.',
          );

          return false;
        }

        if (
          !form.phone
            .trim()
        ) {
          setError(
            'Enter your phone or WhatsApp number.',
          );

          return false;
        }
      }

      return true;
    };

  const nextStep =
    () => {
      if (
        !validateStep()
      ) {
        return;
      }

      setCurrentStep(
        (
          current,
        ) =>
          Math.min(
            current + 1,
            6,
          ),
      );

      setError('');

      window.scrollTo({
        top: 0,
        behavior:
          'smooth',
      });
    };

  const previousStep =
    () => {
      setCurrentStep(
        (
          current,
        ) =>
          Math.max(
            current - 1,
            1,
          ),
      );

      setError('');

      window.scrollTo({
        top: 0,
        behavior:
          'smooth',
      });
    };

  const resetOrder =
    () => {
      localStorage.removeItem(
        DRAFT_KEY,
      );

      setForm(
        createEmptyForm(
          validQueryService,
        ),
      );

      setFiles([]);
      setCurrentStep(1);
      setError('');
      setSubmittedOrder(
        null,
      );
      setSubmissionStage(
        '',
      );

      window.scrollTo({
        top: 0,
        behavior:
          'smooth',
      });
    };

  const submitOrder =
    async () => {
      if (
        !form.confirmation
      ) {
        setError(
          'Confirm that your project information is correct before submitting.',
        );

        return;
      }

      if (
        submitting
      ) {
        return;
      }

      try {
        setSubmitting(
          true,
        );

        setError('');

        setSubmissionStage(
          'Securing your project request...',
        );

        const createdOrder =
          await createProjectOrder({
            form: {
              ...form,

              email:
                user?.email ||
                form.email,
            },

            files,

            onStageChange:
              setSubmissionStage,
          });

        localStorage.removeItem(
          DRAFT_KEY,
        );

        localStorage.removeItem(
          'poshoCreativeLocalOrders',
        );

        setSubmittedOrder(
          createdOrder,
        );

        window.scrollTo({
          top: 0,
          behavior:
            'smooth',
        });
      } catch (
        submissionError
      ) {
        console.error(
          'Real project submission failed:',
          submissionError,
        );

        setError(
          submissionError
            .message ||
            'Your project could not be submitted. Nothing has been charged. Please try again.',
        );
      } finally {
        setSubmitting(
          false,
        );

        setSubmissionStage(
          '',
        );
      }
    };

  if (
    submittedOrder
  ) {
    return (
      <main className="order-success-page">
        <div className="container">
          <div className="order-success-card">
            <div className="order-success-icon">
              <CheckCircle2
                size={38}
              />
            </div>

            <span className="section-kicker">
              REQUEST SUBMITTED
            </span>

            <h1>
              Your project
              <br />
              is now in your workspace.
            </h1>

            <p>
              Posho Creative has received your project request.

              {' '}

              Your reference is

              {' '}

              <strong>
                {submittedOrder.reference}
              </strong>
              .
            </p>

            <div className="order-success-summary">
              <div>
                <span>
                  Service
                </span>

                <strong>
                  {selectedService
                    ?.title}
                </strong>
              </div>

              <div>
                <span>
                  Project
                </span>

                <strong>
                  {selectedProjectType
                    ?.label}
                </strong>
              </div>

              <div>
                <span>
                  Status
                </span>

                <strong>
                  {submittedOrder.status
                    ?.replaceAll(
                      '_',
                      ' ',
                    )}
                </strong>
              </div>
            </div>

            <div
              style={{
                display:
                  'flex',

                justifyContent:
                  'center',

                flexWrap:
                  'wrap',

                gap:
                  '10px',

                marginTop:
                  '28px',
              }}
            >
              <Link
                to={`/dashboard/orders/${submittedOrder.reference}`}
                className="button button-primary"
              >
                Open project

                <ArrowRight
                  size={18}
                />
              </Link>

              <button
                type="button"
                className="button button-secondary"
                onClick={
                  resetOrder
                }
              >
                Start another project
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="order-page">
      <section className="order-header-section">
        <div className="container">
          <div className="order-header-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />

              Start a project
            </div>

            <h1>
              Tell us what
              <span>
                {' '}
                you imagine.
              </span>
            </h1>

            <p>
              Create a real Posho Creative project connected permanently to your account.
            </p>
          </div>

          <div className="order-progress">
            {steps.map(
              (
                step,
              ) => (
                <div
                  key={
                    step.id
                  }
                  className={`order-progress-item ${
                    currentStep ===
                    step.id
                      ? 'active'
                      : ''
                  } ${
                    currentStep >
                    step.id
                      ? 'complete'
                      : ''
                  }`}
                >
                  <div className="order-progress-circle">
                    {currentStep >
                    step.id ? (
                      <Check
                        size={15}
                      />
                    ) : (
                      step.id
                    )}
                  </div>

                  <span>
                    {step.label}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="order-workspace-section">
        <div className="container order-workspace">
          <div className="order-main-card">
            <div className="order-card-heading">
              <span>
                Step {currentStep} of 6
              </span>

              {currentStep ===
                1 && (
                <>
                  <h2>
                    Choose a service.
                  </h2>

                  <p>
                    Select the main Posho Creative service your project requires.
                  </p>
                </>
              )}

              {currentStep ===
                2 && (
                <>
                  <h2>
                    What are we creating?
                  </h2>

                  <p>
                    Choose the project category that best matches your requirements.
                  </p>
                </>
              )}

              {currentStep ===
                3 && (
                <>
                  <h2>
                    Tell us about the project.
                  </h2>

                  <p>
                    Give us the information we need to understand the work properly.
                  </p>
                </>
              )}

              {currentStep ===
                4 && (
                <>
                  <h2>
                    Budget and timing.
                  </h2>

                  <p>
                    Tell us the scale and preferred delivery timeline.
                  </p>
                </>
              )}

              {currentStep ===
                5 && (
                <>
                  <h2>
                    Contact information.
                  </h2>

                  <p>
                    This project will be permanently connected to your signed-in account.
                  </p>
                </>
              )}

              {currentStep ===
                6 && (
                <>
                  <h2>
                    Review your project.
                  </h2>

                  <p>
                    Confirm the details before the project is securely created.
                  </p>
                </>
              )}
            </div>

            {currentStep ===
              1 && (
              <div className="order-service-grid">
                {orderCatalog.map(
                  (
                    service,
                  ) => {
                    const Icon =
                      service.icon;

                    const selected =
                      form.service ===
                      service.slug;

                    return (
                      <button
                        key={
                          service.slug
                        }
                        type="button"
                        className={`order-service-option ${
                          selected
                            ? 'selected'
                            : ''
                        }`}
                        onClick={() =>
                          chooseService(
                            service.slug,
                          )
                        }
                      >
                        <div className="order-service-option-top">
                          <div className="order-option-icon">
                            <Icon
                              size={22}
                            />
                          </div>

                          <div className="order-option-check">
                            <Check
                              size={14}
                            />
                          </div>
                        </div>

                        <h3>
                          {service.title}
                        </h3>

                        <p>
                          {service.description}
                        </p>
                      </button>
                    );
                  },
                )}
              </div>
            )}

            {currentStep ===
              2 &&
              selectedService && (
              <div className="order-project-type-grid">
                {selectedService
                  .projectTypes
                  .map(
                    (
                      item,
                    ) => {
                      const selected =
                        form.projectType ===
                        item.id;

                      const pricing =
                        catalogMap.get(
                          `${form.service}:${item.id}`,
                        );

                      return (
                        <button
                          key={
                            item.id
                          }
                          type="button"
                          className={`order-project-type-option ${
                            selected
                              ? 'selected'
                              : ''
                          }`}
                          onClick={() =>
                            updateField(
                              'projectType',
                              item.id,
                            )
                          }
                        >
                          <div>
                            <h3>
                              {item.label}
                            </h3>

                            <p>
                              {item.description}
                            </p>

                            <strong
                              style={{
                                display:
                                  'block',

                                marginTop:
                                  '10px',

                                color:
                                  'var(--brand-primary)',

                                fontSize:
                                  '12px',
                              }}
                            >
                              {formatCatalogPrice(
                                pricing,
                              )}
                            </strong>
                          </div>

                          <div className="order-radio">
                            {selected && (
                              <span />
                            )}
                          </div>
                        </button>
                      );
                    },
                  )}
              </div>
            )}

            {currentStep ===
              3 && (
              <div className="order-form-stack">
                <div className="order-field">
                  <label htmlFor="projectTitle">
                    Project title
                  </label>

                  <input
                    id="projectTitle"
                    value={
                      form.projectTitle
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'projectTitle',
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="Example: Posho Foods company website"
                  />
                </div>

                <div className="order-field">
                  <label htmlFor="projectDescription">
                    Project description
                  </label>

                  <textarea
                    id="projectDescription"
                    value={
                      form.projectDescription
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'projectDescription',
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="Explain what you need, what already exists and the important requirements."
                  />
                </div>

                <div className="order-field">
                  <label htmlFor="projectGoal">
                    Main goal
                  </label>

                  <textarea
                    id="projectGoal"
                    value={
                      form.projectGoal
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'projectGoal',
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="What should this project achieve for you?"
                  />
                </div>

                <div className="order-field">
                  <label htmlFor="referenceLinks">
                    Reference links
                    <span>
                      Optional
                    </span>
                  </label>

                  <textarea
                    id="referenceLinks"
                    value={
                      form.referenceLinks
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'referenceLinks',
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="Paste websites, social pages or other references."
                  />
                </div>

                <div className="order-upload-block">
                  <div className="order-upload-copy">
                    <div className="order-upload-icon">
                      <UploadCloud
                        size={22}
                      />
                    </div>

                    <div>
                      <h3>
                        Reference files
                      </h3>

                      <p>
                        Upload up to 6 PNG, JPG, WEBP, PDF, DOC or DOCX files. Maximum 10 MB each.
                      </p>
                    </div>
                  </div>

                  <label className="order-upload-button">
                    <Paperclip
                      size={16}
                    />

                    Add files

                    <input
                      type="file"
                      multiple
                      accept=".png,.jpg,.jpeg,.webp,.pdf,.doc,.docx"
                      onChange={
                        handleFiles
                      }
                    />
                  </label>
                </div>

                {files.length >
                  0 && (
                  <div className="order-file-list">
                    {files.map(
                      (
                        file,
                        index,
                      ) => (
                        <div
                          key={`${file.name}-${file.lastModified}-${index}`}
                          className="order-file-item"
                        >
                          <div className="order-file-details">
                            <FileText
                              size={18}
                            />

                            <div>
                              <strong>
                                {file.name}
                              </strong>

                              <span>
                                {formatFileSize(
                                  file.size,
                                )}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeFile(
                                index,
                              )
                            }
                            aria-label={`Remove ${file.name}`}
                          >
                            <Trash2
                              size={16}
                            />
                          </button>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            )}

            {currentStep ===
              4 && (
              <div className="order-form-stack">
                <div>
                  <div className="order-subheading">
                    <h3>
                      Project budget
                    </h3>

                    <p>
                      Choose the range that best reflects your current budget.
                    </p>
                  </div>

                  <div className="order-choice-list">
                    {budgetOptions.map(
                      (
                        option,
                      ) => (
                        <button
                          key={
                            option.id
                          }
                          type="button"
                          className={`order-choice-row ${
                            form.budget ===
                            option.id
                              ? 'selected'
                              : ''
                          }`}
                          onClick={() =>
                            updateField(
                              'budget',
                              option.id,
                            )
                          }
                        >
                          <div>
                            <strong>
                              {option.label}
                            </strong>

                            <span>
                              {option.description}
                            </span>
                          </div>

                          <div className="order-radio">
                            {form.budget ===
                              option.id && (
                              <span />
                            )}
                          </div>
                        </button>
                      ),
                    )}
                  </div>
                </div>

                <div>
                  <div className="order-subheading">
                    <h3>
                      Preferred timeline
                    </h3>

                    <p>
                      Select the timing that best matches your plans.
                    </p>
                  </div>

                  <div className="order-choice-list">
                    {timelineOptions.map(
                      (
                        option,
                      ) => (
                        <button
                          key={
                            option.id
                          }
                          type="button"
                          className={`order-choice-row ${
                            form.timeline ===
                            option.id
                              ? 'selected'
                              : ''
                          }`}
                          onClick={() =>
                            updateField(
                              'timeline',
                              option.id,
                            )
                          }
                        >
                          <div>
                            <strong>
                              {option.label}
                            </strong>

                            <span>
                              {option.description}
                            </span>
                          </div>

                          <div className="order-radio">
                            {form.timeline ===
                              option.id && (
                              <span />
                            )}
                          </div>
                        </button>
                      ),
                    )}
                  </div>
                </div>

                {form.timeline ===
                  'specific-date' && (
                  <div className="order-field">
                    <label htmlFor="deadline">
                      Required deadline
                    </label>

                    <input
                      id="deadline"
                      type="date"
                      value={
                        form.deadline
                      }
                      onChange={(
                        event,
                      ) =>
                        updateField(
                          'deadline',
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {currentStep ===
              5 && (
              <div className="order-form-stack">
                <div className="order-two-column-fields">
                  <div className="order-field">
                    <label htmlFor="fullName">
                      Full name
                    </label>

                    <div className="order-input-icon-wrapper">
                      <UserRound
                        size={17}
                      />

                      <input
                        id="fullName"
                        value={
                          form.fullName
                        }
                        onChange={(
                          event,
                        ) =>
                          updateField(
                            'fullName',
                            event
                              .target
                              .value,
                          )
                        }
                        placeholder="Your full name"
                      />
                    </div>
                  </div>

                  <div className="order-field">
                    <label htmlFor="email">
                      Account email
                    </label>

                    <div className="order-input-icon-wrapper">
                      <Mail
                        size={17}
                      />

                      <input
                        id="email"
                        type="email"
                        value={
                          user?.email ||
                          form.email
                        }
                        readOnly
                      />
                    </div>

                    <span className="order-field-hint">
                      Orders are permanently linked to this authenticated account.
                    </span>
                  </div>
                </div>

                <div className="order-two-column-fields">
                  <div className="order-field">
                    <label htmlFor="phone">
                      Phone / WhatsApp
                    </label>

                    <div className="order-input-icon-wrapper">
                      <Phone
                        size={17}
                      />

                      <input
                        id="phone"
                        value={
                          form.phone
                        }
                        onChange={(
                          event,
                        ) =>
                          updateField(
                            'phone',
                            event
                              .target
                              .value,
                          )
                        }
                        placeholder="+234..."
                      />
                    </div>
                  </div>

                  <div className="order-field">
                    <label htmlFor="businessName">
                      Business name
                      <span>
                        Optional
                      </span>
                    </label>

                    <input
                      id="businessName"
                      value={
                        form.businessName
                      }
                      onChange={(
                        event,
                      ) =>
                        updateField(
                          'businessName',
                          event
                            .target
                            .value,
                        )
                      }
                      placeholder="Business or organisation"
                    />
                  </div>
                </div>

                <div>
                  <div className="order-subheading">
                    <h3>
                      Preferred contact method
                    </h3>
                  </div>

                  <div className="order-contact-methods">
                    {contactMethods.map(
                      (
                        option,
                      ) => (
                        <button
                          key={
                            option.id
                          }
                          type="button"
                          className={`order-contact-method ${
                            form.contactMethod ===
                            option.id
                              ? 'selected'
                              : ''
                          }`}
                          onClick={() =>
                            updateField(
                              'contactMethod',
                              option.id,
                            )
                          }
                        >
                          {option.label}

                          <div className="order-radio">
                            {form.contactMethod ===
                              option.id && (
                              <span />
                            )}
                          </div>
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentStep ===
              6 && (
              <div>
                <div className="order-review">
                  <div className="order-review-section">
                    <span>
                      Service
                    </span>

                    <div>
                      <strong>
                        {selectedService
                          ?.title}
                      </strong>

                      <p>
                        {selectedProjectType
                          ?.label}
                      </p>

                      <p>
                        {formatCatalogPrice(
                          selectedCatalogItem,
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="order-review-section">
                    <span>
                      Project
                    </span>

                    <div>
                      <strong>
                        {form.projectTitle}
                      </strong>

                      <p>
                        {form.projectDescription}
                      </p>

                      <p>
                        Goal: {form.projectGoal}
                      </p>
                    </div>
                  </div>

                  <div className="order-review-section">
                    <span>
                      Budget
                    </span>

                    <div>
                      <strong>
                        {selectedBudget
                          ?.label}
                      </strong>

                      <p>
                        {selectedTimeline
                          ?.label}
                      </p>
                    </div>
                  </div>

                  <div className="order-review-section">
                    <span>
                      Account
                    </span>

                    <div>
                      <strong>
                        {form.fullName}
                      </strong>

                      <p>
                        {user?.email}
                      </p>

                      <p>
                        {form.phone}
                      </p>
                    </div>
                  </div>

                  <div className="order-review-section">
                    <span>
                      Files
                    </span>

                    <div>
                      <strong>
                        {files.length}
                        {' '}
                        file
                        {files.length ===
                        1
                          ? ''
                          : 's'}
                      </strong>

                      <p>
                        Files are uploaded privately to your project workspace after the project record is created.
                      </p>
                    </div>
                  </div>
                </div>

                <label className="order-confirmation">
                  <input
                    type="checkbox"
                    checked={
                      form.confirmation
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'confirmation',
                        event
                          .target
                          .checked,
                      )
                    }
                  />

                  <span className="order-checkbox">
                    <Check
                      size={14}
                    />
                  </span>

                  <span>
                    I confirm that the information above is correct and understand that Posho Creative will use it to create and manage this project in my account.
                  </span>
                </label>
              </div>
            )}

            {error && (
              <div className="order-error">
                {error}
              </div>
            )}

            {submitting && (
              <div
                className="order-summary-note"
                style={{
                  margin:
                    '24px 0 0',
                }}
              >
                <ShieldCheck
                  size={18}
                />

                <p>
                  {submissionStage ||
                    'Creating your secure project workspace...'}

                  <br />

                  Please do not close this page.
                </p>
              </div>
            )}

            <div className="order-navigation">
              {currentStep >
              1 ? (
                <button
                  type="button"
                  className="order-back-button"
                  onClick={
                    previousStep
                  }
                  disabled={
                    submitting
                  }
                >
                  <ArrowLeft
                    size={17}
                  />

                  Back
                </button>
              ) : (
                <span />
              )}

              {currentStep <
              6 ? (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={
                    nextStep
                  }
                >
                  Continue

                  <ArrowRight
                    size={17}
                  />
                </button>
              ) : (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={
                    submitOrder
                  }
                  disabled={
                    submitting
                  }
                >
                  {submitting
                    ? 'Creating project...'
                    : 'Create project'}

                  {!submitting && (
                    <ArrowRight
                      size={17}
                    />
                  )}
                </button>
              )}
            </div>
          </div>

          <aside className="order-summary-card">
            <div className="order-summary-heading">
              <span>
                Project summary
              </span>

              <button
                type="button"
                onClick={
                  resetOrder
                }
              >
                <RotateCcw
                  size={13}
                />

                Reset
              </button>
            </div>

            <div className="order-summary-content">
              <div className="order-summary-row">
                <span>
                  Account
                </span>

                <strong>
                  {user?.email}
                </strong>
              </div>

              <div className="order-summary-row">
                <span>
                  Service
                </span>

                <strong>
                  {selectedService
                    ?.title ||
                    'Not selected'}
                </strong>
              </div>

              <div className="order-summary-row">
                <span>
                  Project
                </span>

                <strong>
                  {selectedProjectType
                    ?.label ||
                    'Not selected'}
                </strong>
              </div>

              <div className="order-summary-row">
                <span>
                  Price
                </span>

                <strong>
                  {selectedProjectType
                    ? formatCatalogPrice(
                        selectedCatalogItem,
                      )
                    : 'Select a project type'}
                </strong>
              </div>

              <div className="order-summary-row">
                <span>
                  Budget
                </span>

                <strong>
                  {selectedBudget
                    ?.label ||
                    'Not selected'}
                </strong>
              </div>

              <div className="order-summary-row">
                <span>
                  Timeline
                </span>

                <strong>
                  {selectedTimeline
                    ?.label ||
                    'Not selected'}
                </strong>
              </div>

              <div className="order-summary-row">
                <span>
                  Contact
                </span>

                <strong>
                  {selectedContact
                    ?.label ||
                    'WhatsApp'}
                </strong>
              </div>
            </div>

            <div className="order-summary-note">
              <LockKeyhole
                size={17}
              />

              <p>
                Your project information and reference files are protected within your Posho Creative workspace and remain connected to the appropriate project account.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}