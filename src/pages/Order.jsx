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
  Mail,
  Paperclip,
  Phone,
  RotateCcw,
  Trash2,
  UploadCloud,
  UserRound,
} from 'lucide-react';

import {
  useSearchParams,
} from 'react-router-dom';

import {
  budgetOptions,
  contactMethods,
  getOrderService,
  orderCatalog,
  timelineOptions,
} from '../data/orderCatalog';

const STORAGE_KEY = 'poshoCreativeOrderDraft';

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

function createEmptyForm(service = '') {
  return {
    service,
    projectType: '',
    projectTitle: '',
    projectDescription: '',
    projectGoal: '',
    referenceLinks: '',
    budget: '',
    timeline: '',
    deadline: '',
    fullName: '',
    email: '',
    phone: '',
    businessName: '',
    contactMethod: 'whatsapp',
    confirmation: false,
  };
}

function createReference() {
  const now = new Date();

  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');

  const random = Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase();

  return `PC-${date}-${random}`;
}

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Order() {
  const [searchParams, setSearchParams] = useSearchParams();

  const queryService = searchParams.get('service') || '';

  const validQueryService = getOrderService(queryService)
    ? queryService
    : '';

  const [currentStep, setCurrentStep] = useState(1);

  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        return {
          ...createEmptyForm(validQueryService),
          ...parsed,
          service:
            validQueryService ||
            parsed.service ||
            '',
          confirmation: false,
        };
      } catch {
        return createEmptyForm(validQueryService);
      }
    }

    return createEmptyForm(validQueryService);
  });

  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [submittedReference, setSubmittedReference] =
    useState('');

  const selectedService = useMemo(
    () => getOrderService(form.service),
    [form.service],
  );

  const selectedProjectType = useMemo(
    () =>
      selectedService?.projectTypes.find(
        (item) => item.id === form.projectType,
      ),
    [selectedService, form.projectType],
  );

  const selectedBudget = useMemo(
    () =>
      budgetOptions.find(
        (item) => item.id === form.budget,
      ),
    [form.budget],
  );

  const selectedTimeline = useMemo(
    () =>
      timelineOptions.find(
        (item) => item.id === form.timeline,
      ),
    [form.timeline],
  );

  const selectedContactMethod = useMemo(
    () =>
      contactMethods.find(
        (item) => item.id === form.contactMethod,
      ),
    [form.contactMethod],
  );

  useEffect(() => {
    document.title =
      'Start a Project | Posho Creative';

    const description = document.querySelector(
      'meta[name="description"]',
    );

    if (description) {
      description.setAttribute(
        'content',
        'Start a project with Posho Creative. Choose a service, describe your requirements and submit your project request.',
      );
    }
  }, []);

  useEffect(() => {
    const saveableForm = {
      ...form,
      confirmation: false,
    };

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(saveableForm),
    );
  }, [form]);

  useEffect(() => {
    if (
      validQueryService &&
      form.service !== validQueryService
    ) {
      setForm((current) => ({
        ...current,
        service: validQueryService,
        projectType: '',
      }));
    }
  }, [validQueryService, form.service]);

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError('');
  };

  const chooseService = (slug) => {
    setForm((current) => ({
      ...current,
      service: slug,
      projectType: '',
    }));

    setSearchParams({
      service: slug,
    });

    setError('');
  };

  const handleFiles = (event) => {
    const selectedFiles = Array.from(
      event.target.files || [],
    );

    if (!selectedFiles.length) {
      return;
    }

    const allowed = selectedFiles.filter(
      (file) => file.size <= 10 * 1024 * 1024,
    );

    const combined = [
      ...files,
      ...allowed,
    ].slice(0, 6);

    setFiles(combined);

    event.target.value = '';
  };

  const removeFile = (index) => {
    setFiles((current) =>
      current.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    );
  };

  const validateStep = () => {
    if (currentStep === 1 && !form.service) {
      setError(
        'Choose the Posho Creative service you need.',
      );

      return false;
    }

    if (
      currentStep === 2 &&
      !form.projectType
    ) {
      setError(
        'Choose the type of project you want to start.',
      );

      return false;
    }

    if (currentStep === 3) {
      if (!form.projectTitle.trim()) {
        setError(
          'Give your project a short title.',
        );

        return false;
      }

      if (
        form.projectDescription.trim().length < 30
      ) {
        setError(
          'Tell us a little more about the project. Your description should be at least 30 characters.',
        );

        return false;
      }

      if (!form.projectGoal.trim()) {
        setError(
          'Tell us what you want this project to achieve.',
        );

        return false;
      }
    }

    if (currentStep === 4) {
      if (!form.budget) {
        setError(
          'Choose the budget range that best matches your project.',
        );

        return false;
      }

      if (!form.timeline) {
        setError(
          'Choose your preferred project timeline.',
        );

        return false;
      }

      if (
        form.timeline === 'specific-date' &&
        !form.deadline
      ) {
        setError(
          'Enter the deadline you want us to consider.',
        );

        return false;
      }
    }

    if (currentStep === 5) {
      if (!form.fullName.trim()) {
        setError(
          'Enter your full name.',
        );

        return false;
      }

      if (!form.email.trim()) {
        setError(
          'Enter your email address.',
        );

        return false;
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          form.email,
        )
      ) {
        setError(
          'Enter a valid email address.',
        );

        return false;
      }

      if (!form.phone.trim()) {
        setError(
          'Enter your phone or WhatsApp number.',
        );

        return false;
      }
    }

    return true;
  };

  const nextStep = () => {
    if (!validateStep()) {
      return;
    }

    setCurrentStep((current) =>
      Math.min(current + 1, 6),
    );

    setError('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const previousStep = () => {
    setCurrentStep((current) =>
      Math.max(current - 1, 1),
    );

    setError('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const resetOrder = () => {
    localStorage.removeItem(STORAGE_KEY);

    setForm(
      createEmptyForm(validQueryService),
    );

    setFiles([]);
    setCurrentStep(1);
    setError('');
    setSubmittedReference('');

    if (!validQueryService) {
      setSearchParams({});
    }

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const submitOrder = () => {
    if (!form.confirmation) {
      setError(
        'Confirm that the information provided is correct before submitting.',
      );

      return;
    }

    const reference = createReference();

    const orderRecord = {
      reference,
      ...form,
      serviceTitle:
        selectedService?.title || '',
      projectTypeTitle:
        selectedProjectType?.label || '',
      budgetTitle:
        selectedBudget?.label || '',
      timelineTitle:
        selectedTimeline?.label || '',
      contactMethodTitle:
        selectedContactMethod?.label || '',
      files: files.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
      })),
      submittedAt: new Date().toISOString(),
    };

    const existingOrders = JSON.parse(
      localStorage.getItem(
        'poshoCreativeLocalOrders',
      ) || '[]',
    );

    localStorage.setItem(
      'poshoCreativeLocalOrders',
      JSON.stringify([
        orderRecord,
        ...existingOrders,
      ]),
    );

    localStorage.removeItem(STORAGE_KEY);

    setSubmittedReference(reference);

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (submittedReference) {
    return (
      <main className="order-success-page">
        <div className="container">
          <div className="order-success-card">
            <div className="order-success-icon">
              <CheckCircle2 size={38} />
            </div>

            <span className="section-kicker">
              Project request completed
            </span>

            <h1>
              Your idea is ready
              <br />
              for the next step.
            </h1>

            <p>
              Your project reference is
              <strong>
                {' '}
                {submittedReference}
              </strong>
              .
            </p>

            <div className="order-success-summary">
              <div>
                <span>Service</span>
                <strong>
                  {selectedService?.title}
                </strong>
              </div>

              <div>
                <span>Project</span>
                <strong>
                  {selectedProjectType?.label}
                </strong>
              </div>

              <div>
                <span>Customer</span>
                <strong>
                  {form.fullName}
                </strong>
              </div>
            </div>

            <button
              type="button"
              className="button button-primary"
              onClick={resetOrder}
            >
              Start another project
              <ArrowRight size={18} />
            </button>
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
              <span> you imagine.</span>
            </h1>

            <p>
              Answer a few focused questions so we can
              understand your project properly.
            </p>
          </div>

          <div className="order-progress">
            {steps.map((step) => (
              <div
                className={`order-progress-item ${
                  currentStep === step.id
                    ? 'active'
                    : ''
                } ${
                  currentStep > step.id
                    ? 'complete'
                    : ''
                }`}
                key={step.id}
              >
                <div className="order-progress-circle">
                  {currentStep > step.id ? (
                    <Check size={15} />
                  ) : (
                    step.id
                  )}
                </div>

                <span>
                  {step.label}
                </span>
              </div>
            ))}
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

              {currentStep === 1 && (
                <>
                  <h2>
                    What can we help you with?
                  </h2>

                  <p>
                    Choose the main service that best
                    matches your project.
                  </p>
                </>
              )}

              {currentStep === 2 && (
                <>
                  <h2>
                    What are we creating?
                  </h2>

                  <p>
                    Choose the project type that most
                    closely matches what you need.
                  </p>
                </>
              )}

              {currentStep === 3 && (
                <>
                  <h2>
                    Tell us about the idea.
                  </h2>

                  <p>
                    Give us enough context to understand
                    what success looks like for you.
                  </p>
                </>
              )}

              {currentStep === 4 && (
                <>
                  <h2>
                    Budget and timing.
                  </h2>

                  <p>
                    This helps us understand the scale
                    and urgency of the project.
                  </p>
                </>
              )}

              {currentStep === 5 && (
                <>
                  <h2>
                    How should we reach you?
                  </h2>

                  <p>
                    Provide accurate details so we can
                    follow up about your project.
                  </p>
                </>
              )}

              {currentStep === 6 && (
                <>
                  <h2>
                    Review your project.
                  </h2>

                  <p>
                    Check the information carefully
                    before submitting your request.
                  </p>
                </>
              )}
            </div>

            {currentStep === 1 && (
              <div className="order-service-grid">
                {orderCatalog.map((service) => {
                  const Icon = service.icon;

                  return (
                    <button
                      type="button"
                      key={service.slug}
                      className={`order-service-option ${
                        form.service === service.slug
                          ? 'selected'
                          : ''
                      }`}
                      onClick={() =>
                        chooseService(service.slug)
                      }
                    >
                      <div className="order-service-option-top">
                        <div className="order-option-icon">
                          <Icon size={23} />
                        </div>

                        <div className="order-option-check">
                          {form.service ===
                            service.slug && (
                            <Check size={15} />
                          )}
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
                })}
              </div>
            )}

            {currentStep === 2 &&
              selectedService && (
                <div className="order-project-type-grid">
                  {selectedService.projectTypes.map(
                    (project) => (
                      <button
                        type="button"
                        key={project.id}
                        className={`order-project-type-option ${
                          form.projectType ===
                          project.id
                            ? 'selected'
                            : ''
                        }`}
                        onClick={() =>
                          updateField(
                            'projectType',
                            project.id,
                          )
                        }
                      >
                        <div>
                          <h3>
                            {project.label}
                          </h3>

                          <p>
                            {project.description}
                          </p>
                        </div>

                        <div className="order-radio">
                          {form.projectType ===
                            project.id && (
                            <span />
                          )}
                        </div>
                      </button>
                    ),
                  )}
                </div>
              )}

            {currentStep === 3 && (
              <div className="order-form-stack">
                <div className="order-field">
                  <label htmlFor="projectTitle">
                    Project title
                  </label>

                  <input
                    id="projectTitle"
                    type="text"
                    value={form.projectTitle}
                    onChange={(event) =>
                      updateField(
                        'projectTitle',
                        event.target.value,
                      )
                    }
                    placeholder="Example: New company website"
                  />
                </div>

                <div className="order-field">
                  <label htmlFor="projectDescription">
                    Describe the project
                  </label>

                  <textarea
                    id="projectDescription"
                    rows="7"
                    value={
                      form.projectDescription
                    }
                    onChange={(event) =>
                      updateField(
                        'projectDescription',
                        event.target.value,
                      )
                    }
                    placeholder="Tell us what you need, the important features, what you already have and anything else we should understand..."
                  />

                  <span className="order-field-hint">
                    Minimum 30 characters.
                  </span>
                </div>

                <div className="order-field">
                  <label htmlFor="projectGoal">
                    What should this project achieve?
                  </label>

                  <textarea
                    id="projectGoal"
                    rows="4"
                    value={form.projectGoal}
                    onChange={(event) =>
                      updateField(
                        'projectGoal',
                        event.target.value,
                      )
                    }
                    placeholder="Example: Make our business look more professional and generate more enquiries."
                  />
                </div>

                <div className="order-field">
                  <label htmlFor="referenceLinks">
                    Reference links
                    <span>Optional</span>
                  </label>

                  <textarea
                    id="referenceLinks"
                    rows="3"
                    value={form.referenceLinks}
                    onChange={(event) =>
                      updateField(
                        'referenceLinks',
                        event.target.value,
                      )
                    }
                    placeholder="Paste websites, social pages, examples or inspiration links here."
                  />
                </div>

                <div className="order-upload-block">
                  <div className="order-upload-copy">
                    <div className="order-upload-icon">
                      <UploadCloud size={24} />
                    </div>

                    <div>
                      <h3>
                        Upload references
                      </h3>

                      <p>
                        Images, PDFs or other useful
                        project references. Up to 6 files,
                        maximum 10 MB each.
                      </p>
                    </div>
                  </div>

                  <label className="order-upload-button">
                    <Paperclip size={17} />
                    Choose files

                    <input
                      type="file"
                      multiple
                      onChange={handleFiles}
                      accept=".png,.jpg,.jpeg,.webp,.pdf,.doc,.docx"
                    />
                  </label>
                </div>

                {files.length > 0 && (
                  <div className="order-file-list">
                    {files.map((file, index) => (
                      <div
                        className="order-file-item"
                        key={`${file.name}-${index}`}
                      >
                        <div className="order-file-details">
                          <FileText size={20} />

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
                            removeFile(index)
                          }
                          aria-label={`Remove ${file.name}`}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {currentStep === 4 && (
              <div className="order-form-stack">
                <div>
                  <div className="order-subheading">
                    <h3>
                      Estimated budget
                    </h3>

                    <p>
                      Choose the closest range. Final
                      pricing will depend on the actual
                      project requirements.
                    </p>
                  </div>

                  <div className="order-choice-list">
                    {budgetOptions.map((option) => (
                      <button
                        type="button"
                        key={option.id}
                        className={`order-choice-row ${
                          form.budget === option.id
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
                    ))}
                  </div>
                </div>

                <div>
                  <div className="order-subheading">
                    <h3>
                      Preferred timeline
                    </h3>

                    <p>
                      Tell us how soon you would like the
                      project completed.
                    </p>
                  </div>

                  <div className="order-choice-list">
                    {timelineOptions.map(
                      (option) => (
                        <button
                          type="button"
                          key={option.id}
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
                      Project deadline
                    </label>

                    <input
                      id="deadline"
                      type="date"
                      value={form.deadline}
                      onChange={(event) =>
                        updateField(
                          'deadline',
                          event.target.value,
                        )
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {currentStep === 5 && (
              <div className="order-form-stack">
                <div className="order-two-column-fields">
                  <div className="order-field">
                    <label htmlFor="fullName">
                      Full name
                    </label>

                    <div className="order-input-icon-wrapper">
                      <UserRound size={18} />

                      <input
                        id="fullName"
                        type="text"
                        value={form.fullName}
                        onChange={(event) =>
                          updateField(
                            'fullName',
                            event.target.value,
                          )
                        }
                        placeholder="Your full name"
                      />
                    </div>
                  </div>

                  <div className="order-field">
                    <label htmlFor="businessName">
                      Business or organisation
                      <span>Optional</span>
                    </label>

                    <input
                      id="businessName"
                      type="text"
                      value={form.businessName}
                      onChange={(event) =>
                        updateField(
                          'businessName',
                          event.target.value,
                        )
                      }
                      placeholder="Business name"
                    />
                  </div>
                </div>

                <div className="order-two-column-fields">
                  <div className="order-field">
                    <label htmlFor="email">
                      Email address
                    </label>

                    <div className="order-input-icon-wrapper">
                      <Mail size={18} />

                      <input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(event) =>
                          updateField(
                            'email',
                            event.target.value,
                          )
                        }
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <div className="order-field">
                    <label htmlFor="phone">
                      Phone / WhatsApp
                    </label>

                    <div className="order-input-icon-wrapper">
                      <Phone size={18} />

                      <input
                        id="phone"
                        type="tel"
                        value={form.phone}
                        onChange={(event) =>
                          updateField(
                            'phone',
                            event.target.value,
                          )
                        }
                        placeholder="+234..."
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="order-subheading">
                    <h3>
                      Preferred contact method
                    </h3>

                    <p>
                      How would you prefer Posho Creative
                      to contact you about this project?
                    </p>
                  </div>

                  <div className="order-contact-methods">
                    {contactMethods.map(
                      (method) => (
                        <button
                          type="button"
                          key={method.id}
                          className={`order-contact-method ${
                            form.contactMethod ===
                            method.id
                              ? 'selected'
                              : ''
                          }`}
                          onClick={() =>
                            updateField(
                              'contactMethod',
                              method.id,
                            )
                          }
                        >
                          <span>
                            {method.label}
                          </span>

                          <div className="order-radio">
                            {form.contactMethod ===
                              method.id && (
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

            {currentStep === 6 && (
              <div className="order-review">
                <div className="order-review-section">
                  <span>
                    Service
                  </span>

                  <div>
                    <strong>
                      {selectedService?.title}
                    </strong>

                    <p>
                      {selectedProjectType?.label}
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
                  </div>
                </div>

                <div className="order-review-section">
                  <span>
                    Goal
                  </span>

                  <div>
                    <p>
                      {form.projectGoal}
                    </p>
                  </div>
                </div>

                <div className="order-review-section">
                  <span>
                    Budget & timeline
                  </span>

                  <div>
                    <strong>
                      {selectedBudget?.label}
                    </strong>

                    <p>
                      {selectedTimeline?.label}

                      {form.deadline
                        ? ` · ${form.deadline}`
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="order-review-section">
                  <span>
                    Contact
                  </span>

                  <div>
                    <strong>
                      {form.fullName}
                    </strong>

                    <p>
                      {form.email}
                    </p>

                    <p>
                      {form.phone}
                    </p>

                    <p>
                      Preferred: {' '}
                      {
                        selectedContactMethod?.label
                      }
                    </p>
                  </div>
                </div>

                {files.length > 0 && (
                  <div className="order-review-section">
                    <span>
                      References
                    </span>

                    <div>
                      <strong>
                        {files.length}{' '}
                        {files.length === 1
                          ? 'file'
                          : 'files'}
                      </strong>

                      {files.map((file) => (
                        <p key={file.name}>
                          {file.name}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <label className="order-confirmation">
                  <input
                    type="checkbox"
                    checked={form.confirmation}
                    onChange={(event) =>
                      updateField(
                        'confirmation',
                        event.target.checked,
                      )
                    }
                  />

                  <span className="order-checkbox">
                    {form.confirmation && (
                      <Check size={14} />
                    )}
                  </span>

                  <span>
                    I confirm that the information I have
                    provided is accurate and can be used
                    to review my project request.
                  </span>
                </label>
              </div>
            )}

            {error && (
              <div className="order-error">
                {error}
              </div>
            )}

            <div className="order-navigation">
              <div>
                {currentStep > 1 && (
                  <button
                    type="button"
                    className="order-back-button"
                    onClick={previousStep}
                  >
                    <ArrowLeft size={17} />
                    Back
                  </button>
                )}
              </div>

              {currentStep < 6 ? (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={nextStep}
                >
                  Continue
                  <ArrowRight size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={submitOrder}
                >
                  Submit project request
                  <ArrowRight size={18} />
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
                onClick={resetOrder}
              >
                <RotateCcw size={15} />
                Start over
              </button>
            </div>

            <div className="order-summary-content">
              <div className="order-summary-row">
                <span>
                  Service
                </span>

                <strong>
                  {selectedService?.title ||
                    'Not selected'}
                </strong>
              </div>

              <div className="order-summary-row">
                <span>
                  Project type
                </span>

                <strong>
                  {selectedProjectType?.label ||
                    'Not selected'}
                </strong>
              </div>

              <div className="order-summary-row">
                <span>
                  Budget
                </span>

                <strong>
                  {selectedBudget?.label ||
                    'Not selected'}
                </strong>
              </div>

              <div className="order-summary-row">
                <span>
                  Timeline
                </span>

                <strong>
                  {selectedTimeline?.label ||
                    'Not selected'}
                </strong>
              </div>
            </div>

            <div className="order-summary-note">
              <CheckCircle2 size={19} />

              <p>
                Your progress is saved automatically in
                this browser while you complete the
                order.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}