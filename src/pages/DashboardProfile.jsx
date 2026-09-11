import {
  useEffect,
  useState,
} from 'react';

import {
  CheckCircle2,
  Save,
} from 'lucide-react';

import {
  useAuth,
} from '../context/AuthContext';

import { useToast } from '../components/ui/Toast';

import {
  updateCustomerProfile,
} from '../lib/orders';

import {
  getMyOrganization,
  getMyRetainers,
} from '../lib/clientOps';

import {
  formatNaira,
} from '../lib/reports';

export default function DashboardProfile() {
  const {
    user,
    profile,
    refreshProfile,
  } = useAuth();

  const toast = useToast();

  const [form, setForm] =
    useState({
      fullName: '',
      email: '',
      phone: '',
      businessName: '',
      preferredContactMethod:
        'whatsapp',
    });

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState('');

  const [error, setError] =
    useState('');

  const [organization, setOrganization] =
    useState(null);

  const [retainers, setRetainers] =
    useState([]);

  useEffect(() => {
    document.title =
      'Profile | Posho Creative';

    getMyOrganization()
      .then(setOrganization)
      .catch(() => setOrganization(null));

    getMyRetainers()
      .then(setRetainers)
      .catch(() => setRetainers([]));

    setForm({
      fullName:
        profile?.full_name ||
        '',

      email:
        user?.email ||
        '',

      phone:
        profile?.phone ||
        '',

      businessName:
        profile?.business_name ||
        '',

      preferredContactMethod:
        profile
          ?.preferred_contact_method ||
        'whatsapp',
    });
  }, [
    profile,
    user,
  ]);

  const update = (
    field,
    value,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setMessage('');
    setError('');
  };

  const save =
    async (event) => {
      event.preventDefault();

      if (
        !form.fullName.trim() ||
        !form.phone.trim()
      ) {
        setError(
          'Your name and phone number are required.',
        );

        return;
      }

      try {
        setSaving(true);

        await updateCustomerProfile({
          userId:
            user.id,

          fullName:
            form.fullName,

          phone:
            form.phone,

          businessName:
            form.businessName,

          preferredContactMethod:
            form.preferredContactMethod,
        });

        await refreshProfile();

        setMessage(
          'Your profile has been updated.',
        );

        toast.success('Profile saved.');
      } catch (saveError) {
        setError(
          saveError.message ||
            'We could not update your profile.',
        );

        toast.error('Your profile could not be saved.');
      } finally {
        setSaving(false);
      }
    };

  return (
    <div className="workspace-view page-reveal">
      <div className="workspace-view-heading">
        <div>
          <span className="workspace-kicker">
            PROFILE
          </span>

          <h2>
            Your account details.
          </h2>
        </div>
      </div>

      <form
        className="workspace-profile-card"
        onSubmit={save}
      >
        <div className="workspace-profile-grid">
          <label>
            <span>
              Full name
            </span>

            <input
              type="text"
              value={
                form.fullName
              }
              onChange={(event) =>
                update(
                  'fullName',
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>
              Email address
            </span>

            <input
              type="email"
              value={form.email}
              disabled
              aria-describedby="profile-email-hint"
            />

            <small id="profile-email-hint" style={{ fontSize: 12, color: '#5f5878' }}>
              Managed by your sign-in account and cannot be changed here.
            </small>
          </label>

          <label>
            <span>
              Phone / WhatsApp
            </span>

            <input
              type="tel"
              value={form.phone}
              onChange={(event) =>
                update(
                  'phone',
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>
              Business / organisation
            </span>

            <input
              type="text"
              value={
                form.businessName
              }
              onChange={(event) =>
                update(
                  'businessName',
                  event.target.value,
                )
              }
            />
          </label>

          <label className="workspace-profile-full">
            <span>
              Preferred contact method
            </span>

            <select
              value={
                form.preferredContactMethod
              }
              onChange={(event) =>
                update(
                  'preferredContactMethod',
                  event.target.value,
                )
              }
            >
              <option value="whatsapp">
                WhatsApp
              </option>

              <option value="email">
                Email
              </option>

              <option value="phone">
                Phone Call
              </option>
            </select>
          </label>
        </div>

        {error && (
          <div className="workspace-alert">
            {error}
          </div>
        )}

        {message && (
          <div className="workspace-success-message">
            <CheckCircle2 size={17} />
            {message}
          </div>
        )}

        <button
          type="submit"
          className="button button-primary"
          disabled={saving}
          aria-busy={saving}
        >
          <Save size={17} />

          {saving
            ? 'Saving…'
            : 'Save changes'}
        </button>
      </form>

      {organization && (
        <section className="workspace-panel" style={{ marginTop: 14 }}>
          <div className="workspace-panel-heading">
            <div>
              <span>ORGANIZATION</span>
              <h3 className="posho-long-value">
                {organization.organization?.name}
              </h3>
            </div>
          </div>

          <p style={{ fontSize: 13, color: '#5f5878' }}>
            Your role:{' '}
            {String(
              organization.org_role || '',
            ).replaceAll('_', ' ')}
            {organization.can_view_finance
              ? ' · You can view project finances.'
              : ' · Project finances stay with billing members.'}
            {organization.can_approve
              ? ' · You can approve deliverables.'
              : ''}
          </p>
        </section>
      )}

      {retainers.length > 0 && (
        <section className="workspace-panel" style={{ marginTop: 14 }}>
          <div className="workspace-panel-heading">
            <div>
              <span>RETAINERS</span>
              <h3>Ongoing support</h3>
            </div>
          </div>

          {retainers.map((retainer) => {
            const current = (retainer.periods || []).find(
              (period) => period.status === 'open',
            );

            const used = current
              ? Number(current.used_minutes || 0)
              : 0;

            const included = current
              ? Number(current.included_minutes || 0)
              : Number(retainer.included_minutes || 0);

            return (
              <div
                key={retainer.id}
                className="project-cost-list"
                style={{ marginBottom: 12 }}
              >
                <div>
                  <strong>{retainer.title}</strong>
                  <span>
                    {formatNaira(
                      retainer.monthly_amount_kobo,
                    )}
                    /mo · {Math.floor(included / 60)}h
                    included
                    {current
                      ? ` · ${Math.floor(used / 60)}h used`
                      : ''}
                  </span>
                </div>

                <strong>{retainer.status}</strong>
              </div>
            );
          })}
        </section>
      )}

      <section className="workspace-panel" style={{ marginTop: 14 }}>
        <div className="workspace-panel-heading">
          <div>
            <span>SECURITY</span>
            <h3>Signed in as</h3>
          </div>
        </div>
        <p className="posho-long-value" style={{ fontSize: 14 }}>
          {user?.email}
        </p>
        <p style={{ fontSize: 13, color: '#5f5878' }}>
          Your workspace session is private to this account. Use Sign out from
          the navigation when you finish on a shared device.
        </p>
      </section>
    </div>
  );
}