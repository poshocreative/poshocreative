import React, {
  useEffect,
  useState,
} from "react";

import {
  supabase,
} from "../../lib/supabase";


const money = (value = 0) =>
  new Intl.NumberFormat(
    "en-NG",
    {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }
  ).format(value);



export default function AdminPaymentRequestManager({
  projectId,
  adminId,
}) {


  const [requests, setRequests] =
    useState([]);

  const [loading, setLoading] =
    useState(true);


  const [processing, setProcessing] =
    useState(false);



  const [selectedRequest, setSelectedRequest] =
    useState(null);


  const [initialPayment, setInitialPayment] =
    useState("");

  const [deadline, setDeadline] =
    useState("");

  const [terms, setTerms] =
    useState("");

  const [response, setResponse] =
    useState("");



  async function loadRequests() {

    setLoading(true);


    const {
      data,
      error,
    } =
      await supabase
        .from(
          "part_payment_requests"
        )
        .select("*")
        .eq(
          "project_id",
          projectId
        )
        .order(
          "created_at",
          {
            ascending:false,
          }
        );


    if(!error){

      setRequests(
        data || []
      );

    }


    setLoading(false);

  }




  useEffect(()=>{

    if(projectId){

      loadRequests();

    }

  },[
    projectId
  ]);





  async function approveRequest(){


    if(!selectedRequest){

      return;

    }


    setProcessing(true);



    const amount =
      Number(initialPayment);



    const remaining =
      Number(
        selectedRequest.requested_project_amount ||
        0
      )
      -
      amount;



    const {
      error:planError
    } =
      await supabase
      .from(
        "project_payment_plans"
      )
      .insert({

        project_id:
        projectId,

        original_amount:
        selectedRequest.original_amount,

        approved_initial_payment:
        amount,

        remaining_balance:
        remaining > 0
        ?
        remaining
        :
        0,

        payment_deadline:
        deadline,

        terms,

        created_by:
        adminId,

      });



    if(planError){

      alert(
        planError.message
      );

      setProcessing(false);

      return;

    }




    await supabase
    .from(
      "part_payment_requests"
    )
    .update({

      status:
      "approved",

      admin_response:
      response,

      reviewed_by:
      adminId,

      reviewed_at:
      new Date()
      .toISOString(),

    })
    .eq(
      "id",
      selectedRequest.id
    );



    setProcessing(false);

    setSelectedRequest(null);

    loadRequests();



  }





  async function declineRequest(){


    if(!selectedRequest){

      return;

    }


    setProcessing(true);



    await supabase
    .from(
      "part_payment_requests"
    )
    .update({

      status:
      "declined",

      admin_response:
      response,

      reviewed_by:
      adminId,

      reviewed_at:
      new Date()
      .toISOString(),

    })
    .eq(
      "id",
      selectedRequest.id
    );



    setProcessing(false);

    setSelectedRequest(null);

    loadRequests();


  }





return (

<section className="admin-payment-request-manager">


<header>

<h3>
Part Payment Requests
</h3>

<p>
Review customer payment arrangement requests.
</p>

</header>



{
loading ?

<p>
Loading payment requests...
</p>

:

requests.length === 0 ?

<p>
No payment requests available.
</p>


:

requests.map(
(request)=>(


<article
key={request.id}
className="admin-payment-request-card"
>


<div>

<strong>
Requested Amount
</strong>

<h4>
{
money(
request.requested_amount
)
}
</h4>


<p>
{
request.reason ||
"No reason provided"
}
</p>


</div>


<span
className={
`payment-status ${request.status}`
}
>
{
request.status
}
</span>



{
request.status === "pending"
&&

<button

onClick={()=>{

setSelectedRequest(
request
);

}}

>
Review Request
</button>

}


</article>


)

)

}





{
selectedRequest && (

<div
className="admin-payment-modal"
>


<h3>
Approve Payment Request
</h3>


<p>
Requested:
{
money(
selectedRequest.requested_amount
)
}
</p>



<input

type="number"

placeholder="Approved first payment"

value={initialPayment}

onChange={
e=>
setInitialPayment(
e.target.value
)
}

/>



<input

type="date"

value={deadline}

onChange={
e=>
setDeadline(
e.target.value
)
}

/>



<textarea

placeholder="Payment terms"

value={terms}

onChange={
e=>
setTerms(
e.target.value
)
}

/>



<textarea

placeholder="Customer response"

value={response}

onChange={
e=>
setResponse(
e.target.value
)
}

/>



<div>

<button

disabled={processing}

onClick={approveRequest}

>
Approve
</button>


<button

disabled={processing}

onClick={declineRequest}

>
Decline
</button>

</div>


</div>

)

}



</section>

);

}