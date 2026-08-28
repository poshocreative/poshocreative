import React from "react";


const formatMoney = (value = 0) =>
  new Intl.NumberFormat(
    "en-NG",
    {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }
  ).format(value);



export default function AdminPaymentSummary({

project,

paymentPlan,

additionalCosts = []

}) {


const total =
paymentPlan?.original_amount ||
project?.total_amount ||
project?.amount ||
0;



const paid =
paymentPlan?.amount_paid ||
0;



const balance =
paymentPlan
?
paymentPlan.remaining_balance
:
total - paid;



const extra =
additionalCosts.reduce(
(sum,item)=>
sum + Number(item.amount || 0),
0
);



return (

<section className="admin-payment-summary">


<div className="payment-summary-card">


<div>

<span>
Project Value
</span>

<strong>
{
formatMoney(total)
}
</strong>

</div>



<div>

<span>
Paid
</span>

<strong>
{
formatMoney(paid)
}
</strong>

</div>



<div>

<span>
Balance
</span>

<strong>
{
formatMoney(balance)
}
</strong>

</div>



<div>

<span>
Additional Costs
</span>

<strong>
{
formatMoney(extra)
}
</strong>

</div>


</div>



{
paymentPlan &&

<div className="payment-plan-banner">


<strong>
Payment Plan Active
</strong>


<p>

Initial Payment:

{" "}

{
formatMoney(
paymentPlan.approved_initial_payment
)
}

</p>


<p>

Deadline:

{" "}

{
paymentPlan.deadline ||
"No deadline set"
}

</p>


</div>

}



</section>

);

}