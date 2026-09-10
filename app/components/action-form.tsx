'use client';
import { useActionState } from 'react';
import type { FormState } from '../actions';
export function ActionForm({action,children,submit='Save',className='stack'}:{action:(state:FormState,form:FormData)=>Promise<FormState>;children:React.ReactNode;submit?:string;className?:string}){
 const [state,dispatch,pending]=useActionState(action,{message:''});return <form action={dispatch} className={className}><fieldset disabled={pending}>{children}</fieldset><button disabled={pending}>{pending?'Saving…':submit}</button><p role="status" className="message">{state.message}</p></form>;
}
