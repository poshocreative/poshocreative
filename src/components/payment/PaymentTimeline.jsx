import React from "react";


export default function PaymentTimeline({

events=[]

}){


return (

<section className="payment-timeline">


<h3>
Payment Activity
</h3>



{

events.length === 0 ?

<p>
No payment activity yet.
</p>


:

events.map(
event=>(


<article
key={event.id}
className="payment-timeline-item"
>


<strong>
{
event.title
}
</strong>


<p>
{
event.description
}
</p>


<small>
{
new Date(
event.created_at
)
.toLocaleString()
}
</small>


</article>


)

)

}


</section>

);

}