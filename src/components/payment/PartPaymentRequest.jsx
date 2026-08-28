import React, {
 useState
} from "react";

import {
 supabase
} from "../../lib/supabase";


export default function PartPaymentRequest({
 projectId,
 userId,
 currentAmount
}) {


const [amount,setAmount] =
useState("");

const [reason,setReason] =
useState("");

const [loading,setLoading] =
useState(false);


async function submitRequest(){


 if(!amount){

 alert(
 "Please enter requested amount"
 );

 return;

 }


 setLoading(true);



 const {
 error
 } =
 await supabase
 .from(
 "part_payment_requests"
 )
 .insert({

 project_id:
 projectId,

 customer_id:
 userId,

 requested_amount:
 Number(amount),

 reason

 });


 setLoading(false);



 if(error){

 alert(error.message);

 return;

 }


 alert(
 "Part payment request submitted successfully"
 );


 setAmount("");

 setReason("");

}



return (

<section className="part-payment-request">


<h3>
Request Part Payment
</h3>


<p>
You can request a flexible payment arrangement for this approved project.
</p>


<label>
Requested amount
</label>


<input

type="number"

value={amount}

placeholder="Enter amount"

onChange={
e=>setAmount(e.target.value)
}

/>



<label>
Reason
</label>


<textarea

value={reason}

placeholder="Explain your request"

onChange={
e=>setReason(e.target.value)
}

/>



<button
disabled={loading}
onClick={submitRequest}
>

{
loading
?
"Submitting..."
:
"Submit Request"
}

</button>


</section>


);

}