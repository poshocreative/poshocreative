import {
useState
} from "react";


import {
supabase
} from "../../lib/supabase";


export default function AdminPaymentPlan({

projectId,

originalAmount,

adminId

}){


const [amount,setAmount]
=
useState("");

const [deadline,setDeadline]
=
useState("");

const [terms,setTerms]
=
useState("");

const [loading,setLoading]
=
useState(false);



async function approvePlan(){


setLoading(true);


const remaining =
Number(originalAmount)
-
Number(amount);



const {
error
}
=
await supabase
.from(
"project_payment_plans"
)
.insert({

project_id:
projectId,

original_amount:
originalAmount,

approved_initial_payment:
Number(amount),

remaining_balance:
remaining,

payment_deadline:
deadline,

terms,

created_by:
adminId

});


setLoading(false);



if(error){

alert(error.message);

return;

}


alert(
"Payment plan approved"
);



}



return (

<section className="admin-payment-plan">


<h3>
Create Payment Plan
</h3>


<input

type="number"

placeholder="Initial payment amount"

onChange={
e=>setAmount(e.target.value)
}

/>


<input

type="date"

onChange={
e=>setDeadline(e.target.value)
}

/>


<textarea

placeholder="Payment terms"

onChange={
e=>setTerms(e.target.value)
}

/>



<button

disabled={loading}

onClick={approvePlan}

>

{
loading
?
"Saving..."
:
"Approve Payment Plan"
}

</button>


</section>

);


}
