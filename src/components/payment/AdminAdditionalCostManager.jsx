import {
  useState,
} from "react";

import {
  supabase,
} from "../../lib/supabase";


const formatMoney = (value = 0) =>
  new Intl.NumberFormat(
    "en-NG",
    {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }
  ).format(value);



export default function AdminAdditionalCostManager({

projectId,

adminId,

onUpdated

}) {


const [title,setTitle] =
useState("");

const [amount,setAmount] =
useState("");

const [description,setDescription] =
useState("");

const [loading,setLoading] =
useState(false);



async function createCost(){


if(
!title ||
!amount
){

alert(
"Title and amount are required."
);

return;

}



setLoading(true);



const {
error
}
=
await supabase
.from(
"project_additional_costs"
)
.insert({

project_id:
projectId,

title,

amount:
Number(amount),

description,

created_by:
adminId

});



setLoading(false);



if(error){

alert(
error.message
);

return;

}



setTitle("");

setAmount("");

setDescription("");



alert(
`Additional charge ${formatMoney(amount)} created.`
);



if(onUpdated){

onUpdated();

}


}



return (

<section className="admin-additional-cost-manager">


<h3>
Additional Project Costs
</h3>


<p>
Add approved extra charges during project development.
</p>



<input

placeholder="Cost title"

value={title}

onChange={
e =>
setTitle(
e.target.value
)
}

/>



<input

type="number"

placeholder="Amount"

value={amount}

onChange={
e =>
setAmount(
e.target.value
)
}

/>



<textarea

placeholder="Reason for additional cost"

value={description}

onChange={
e =>
setDescription(
e.target.value
)
}

/>



<button

disabled={loading}

onClick={createCost}

>

{
loading
?
"Saving..."
:
"Add Additional Cost"
}

</button>



</section>

);

}
