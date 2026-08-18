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

import {
  updateCustomerProfile,
} from '../lib/orders';

export default function DashboardProfile() {
  const {
    user,
    profile,
    refreshProfile,
  } = useAuth();

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

  useEffect(() => {
    document.title =
      'Profile | Posho Creative';

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
      } catch (saveError) {
        console.error(
          saveError,
        );

        setError(
          'We could not update your profile.',
        );
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
            />
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
        >
          <Save size={17} />

          {saving
            ? 'Saving...'
            : 'Save changes'}
        </button>
      </form>
    </div>
  );
}