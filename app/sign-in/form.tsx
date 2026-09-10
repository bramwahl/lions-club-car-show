'use client';
import { useActionState } from 'react';
import { signIn } from '../actions';
export function SignInForm({next}:{next?:string}) {
  const [state,action,pending]=useActionState(signIn,{message:''});
  return <form action={action} className="stack"><input type="hidden" name="next" value={next??'/staff'}/><label>Email<input name="email" type="email" autoComplete="username" required maxLength={254}/></label><label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={128}/></label><p role="status" className="message">{state.message}</p><button disabled={pending}>{pending?'Signing in…':'Sign in'}</button></form>;
}
