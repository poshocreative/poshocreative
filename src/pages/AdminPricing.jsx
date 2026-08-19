import {
  useEffect,
  useState,
} from 'react';

import {
  Save,
} from 'lucide-react';

import BrandLoader from '../components/BrandLoader';

import {
  getAdminCatalog,
  updateCatalogItem,
} from '../lib/admin';

import {
  formatCatalogPrice,
} from '../lib/catalog';

export default function AdminPricing() {
  const [
    catalog,
    setCatalog,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busy,
    setBusy,
  ] =
    useState('');

  const [
    message,
    setMessage,
  ] =
    useState('');

  useEffect(() => {
    document.title =
      'Pricing | Posho Creative Admin';

    getAdminCatalog()
      .then(setCatalog)
      .catch(
        console.error,
      )
      .finally(() =>
        setLoading(false),
      );
  }, []);

  const change =
    (
      id,
      field,
      value,
    ) => {
      setCatalog(
        (
          current,
        ) =>
          current.map(
            (
              item,
            ) =>
              item.id ===
              id
                ? {
                    ...item,

                    [field]:
                      value,
                  }
                : item,
          ),
      );
  };

  const save =
    async (
      item,
    ) => {
      try {
        setBusy(
          item.id,
        );

        setMessage('');

        const updated =
          await updateCatalogItem(
            item.id,
            {
              pricing_type:
                item.pricing_type,

              price_kobo:
                item.pricing_type ===
                'custom'
                  ? null
                  : Number(
                      item.price_kobo ||
                        0,
                    ),

              active:
                item.active,
            },
          );

        setCatalog(
          (
            current,
          ) =>
            current.map(
              (
                row,
              ) =>
                row.id ===
                updated.id
                  ? updated
                  : row,
            ),
        );

        setMessage(
          `${item.title} updated.`,
        );
      } catch (
        error
      ) {
        setMessage(
          error.message,
        );
      } finally {
        setBusy('');
      }
    };

  if (loading) {
    return (
      <BrandLoader label="Loading pricing..." />
    );
  }

  return (
    <div className="admin-view page-reveal">
      <div className="admin-view-heading">
        <div>
          <span>
            PRICING
          </span>

          <h1>
            Service price control.
          </h1>

          <p>
            Prices saved here are the backend authority used by Posho Creative orders.
          </p>
        </div>
      </div>

      {message && (
        <div className="workspace-success-message">
          {message}
        </div>
      )}

      <div className="admin-pricing-grid">
        {catalog.map(
          (
            item,
          ) => (
            <article
              key={
                item.id
              }
              className="admin-pricing-card"
            >
              <small>
                {item.service_slug
                  .replaceAll(
                    '-',
                    ' ',
                  )}
              </small>

              <h3>
                {item.title}
              </h3>

              <p>
                {formatCatalogPrice(
                  item,
                )}
              </p>

              <label>
                <span>
                  Pricing model
                </span>

                <select
                  value={
                    item.pricing_type
                  }
                  onChange={(
                    event,
                  ) =>
                    change(
                      item.id,
                      'pricing_type',
                      event
                        .target
                        .value,
                    )
                  }
                >
                  <option value="fixed">
                    Fixed
                  </option>

                  <option value="starting_at">
                    Starting at
                  </option>

                  <option value="monthly">
                    Monthly
                  </option>

                  <option value="custom">
                    Custom quote
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Price in Naira
                </span>

                <input
                  type="number"
                  disabled={
                    item.pricing_type ===
                    'custom'
                  }
                  value={
                    item.price_kobo
                      ? Number(
                          item.price_kobo,
                        ) /
                        100
                      : ''
                  }
                  onChange={(
                    event,
                  ) =>
                    change(
                      item.id,
                      'price_kobo',
                      event
                        .target
                        .value
                        ? Number(
                            event
                              .target
                              .value,
                          ) *
                          100
                        : null,
                    )
                  }
                />
              </label>

              <label className="admin-pricing-active">
                <input
                  type="checkbox"
                  checked={
                    item.active
                  }
                  onChange={(
                    event,
                  ) =>
                    change(
                      item.id,
                      'active',
                      event
                        .target
                        .checked,
                    )
                  }
                />

                Service available
              </label>

              <button
                type="button"
                className="button button-primary"
                disabled={
                  busy ===
                  item.id
                }
                onClick={() =>
                  save(item)
                }
              >
                <Save
                  size={16}
                />

                {busy ===
                item.id
                  ? 'Saving...'
                  : 'Save price'}
              </button>
            </article>
          ),
        )}
      </div>
    </div>
  );
}