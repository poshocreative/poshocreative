const formatMoney = (amount = 0) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);


export default function PaymentSummaryCard({
  project,
  paymentPlan,
}) {

  const total =
    paymentPlan?.original_amount ||
    project?.total_amount ||
    0;


  const paid =
    paymentPlan?.amount_paid ||
    project?.amount_paid ||
    0;


  const balance =
    paymentPlan?.remaining_balance ??
    total - paid;


  return (

    <section className="payment-summary-card">

      <div>

        <span>
          Project Value
        </span>

        <strong>
          {formatMoney(total)}
        </strong>

      </div>


      <div>

        <span>
          Paid
        </span>

        <strong>
          {formatMoney(paid)}
        </strong>

      </div>


      <div>

        <span>
          Remaining Balance
        </span>

        <strong>
          {formatMoney(balance)}
        </strong>

      </div>


      {
        paymentPlan && (

          <div className="payment-plan-status">

            <span>
              Payment Plan
            </span>


            <strong>
              Active
            </strong>

          </div>

        )
      }

    </section>

  );
}
