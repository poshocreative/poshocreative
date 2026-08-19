import {
  useEffect,
  useState,
} from 'react';

import BrandLoader from '../components/BrandLoader';

import {
  getAdminCustomers,
} from '../lib/admin';

export default function AdminCustomers() {
  const [
    customers,
    setCustomers,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  useEffect(() => {
    document.title =
      'Customers | Posho Creative Admin';

    getAdminCustomers()
      .then(
        setCustomers,
      )
      .catch(
        console.error,
      )
      .finally(() =>
        setLoading(false),
      );
  }, []);

  if (loading) {
    return (
      <BrandLoader label="Loading customers..." />
    );
  }

  return (
    <div className="admin-view page-reveal">
      <div className="admin-view-heading">
        <div>
          <span>
            CUSTOMERS
          </span>

          <h1>
            Client directory.
          </h1>
        </div>
      </div>

      <div className="admin-data-card">
        {customers.map(
          (
            customer,
          ) => (
            <article
              key={
                customer.id
              }
              className="admin-data-row"
            >
              <div>
                <strong>
                  {
                    customer.full_name
                  }
                </strong>

                <span>
                  {
                    customer.email
                  }
                </span>
              </div>

              <div>
                <span>
                  Phone
                </span>

                <strong>
                  {
                    customer.phone
                  }
                </strong>
              </div>

              <div>
                <span>
                  Business
                </span>

                <strong>
                  {customer.business_name ||
                    '—'}
                </strong>
              </div>

              <div>
                <span>
                  Projects
                </span>

                <strong>
                  {
                    customer
                      .orders
                      ?.length ||
                    0
                  }
                </strong>
              </div>
            </article>
          ),
        )}
      </div>
    </div>
  );
}