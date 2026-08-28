import React,{
useState
} from "react";

import {
supabase
} from "../../lib/supabase";



const money=(value=0)=>
new Intl.NumberFormat(
"en-NG",
{
style:"currency",
currency:"NGN",
maximumFractionDigits:0
}
).format(value);



export default function CustomerPaymentCenter({

project,

userId,

paymentPlan

}){


const [amount,setAmount]=
useState("");

const [reason,setReason]=
useState("");

const [loading,setLoading]=
useState(false);



const total =
paymentPlan?.original_amount ||
project?.total_amount ||
0;



const due =
paymentPlan?.approved_initial_payment ||
total;



async function requestPartPayment(){


setLoading(true);



const {

error

}=

await supabase
.from(
"part_payment_requests"
)
.insert({

project_id:
project.id,

customer_id:
userId,

requested_amount:
Number(amount),

reason

});



setLoading(false);



if(error){

alert(
error.message
);

return;

}


alert(
"Part payment request submitted"
);


}



return (

<section className="customer-payment-center">


<header>

<h3>
Project Payment
</h3>


<p>
Manage your project payments securely.
</p>


</header>



<div className="customer-payment-grid">


<div>

<span>
Project Cost
</span>

<strong>
{
money(total)
}
</strong>

</div>



<div>

<span>
Current Payment Due
</span>

<strong>
{
money(due)
}
</strong>

</div>



<div>

<span>
Remaining Balance
</span>

<strong>

{
money(
paymentPlan?.remaining_balance ||
0
)
}

</strong>

</div>


</div>



<button className="payment-primary-button">

Pay Now

</button>




<div className="part-payment-box">


<h4>
Request Part Payment
</h4>


<input

type="number"

placeholder="Amount you can pay"

value={amount}

onChange={
e=>
setAmount(
e.target.value
)
}

/>



<textarea

placeholder="Reason for request"

value={reason}

onChange={
e=>
setReason(
e.target.value
)
}

/>



<button

disabled={loading}

onClick={
requestPartPayment
}

>

{
loading
?
"Sending..."
:
"Submit Request"
}

</button>


</div>


</section>

);

}