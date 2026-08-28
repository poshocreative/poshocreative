import {
useState
} from "react";


import {
supabase
}
from "../../lib/supabase";


export default function AdditionalCostForm({

projectId,

adminId

}){


const [title,setTitle]
=
useState("");

const [amount,setAmount]
=
useState("");

const [description,setDescription]
=
useState("");



async function submit(){


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

amount:Number(amount),

description,

created_by:
adminId

});



if(error){

alert(error.message);

return;

}


alert(
"Additional cost added"
);


}



return (

<div>


<h3>
Add Additional Cost
</h3>


<input

placeholder="Cost title"

onChange={
e=>setTitle(e.target.value)
}

/>


<input

type="number"

placeholder="Amount"

onChange={
e=>setAmount(e.target.value)
}

/>


<textarea

placeholder="Reason"

onChange={
e=>setDescription(e.target.value)
}

/>



<button
onClick={submit}
>
Add Cost
</button>


</div>

);


}
