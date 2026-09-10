'use client';
import { useActionState, useState } from 'react';
import { submitVehicleRegistration } from '../admin/workflow-actions';

export function VehicleRegistrationForm({event,year,participant,car,payment,registered,numbered}:{event:string;year:number;participant:string;car:string;payment:string;registered:boolean;numbered:boolean}){
 const [selectedPayment,setSelectedPayment]=useState(payment);
 const [state,action,pending]=useActionState(submitVehicleRegistration,{message:''});
 return <form action={action} className="stack">
  <input type="hidden" name="event" value={event}/>
  <input type="hidden" name="participant" value={participant}/>
  <input type="hidden" name="car" value={car}/>
  <input type="hidden" name="cars" value={car}/>
  <input type="hidden" name="intent" value={registered?'payment':'register'}/>
  <label>Payment for {year}<select name="payment" value={selectedPayment} onChange={e=>setSelectedPayment(e.target.value)} disabled={pending}><option>Unpaid</option><option>Paid</option></select></label>
  <p className="hint">Check-in saves this payment status and opens the QR car sheet.</p>
  <div className="actions">
   <button name="operation" value="check-in" disabled={pending}>{pending?'Saving…':numbered?'Save & open QR sheet':'Check in & open QR sheet'}</button>
   <button className="secondary" name="operation" value="pre-register" disabled={pending}>{registered?'Save payment only':'Pre-register only'}</button>
  </div>
  <p role="status" className="message">{state.message}</p>
 </form>;
}
