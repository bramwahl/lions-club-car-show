'use client';
import { useActionState } from 'react';
import { createAccount, updateAccount } from './actions';
export type Account={id:string;email:string;display_name:string;app_role:'admin'|'judge';is_active:boolean};
export function CreateAccountForm() {
  const [state,action,pending]=useActionState(createAccount,{message:''});
  return <form action={action} className="stack"><label>Display name<input name="name" required minLength={2} maxLength={80} autoComplete="off"/></label><label>Email<input name="email" type="email" required maxLength={254} autoComplete="off"/></label><label>Initial password<input name="password" type="password" required minLength={12} maxLength={72} autoComplete="new-password" aria-describedby="password-help"/></label><p id="password-help" className="hint">at least 12 characters (maximum 72 bytes). Share it directly with the user. No email is sent.</p><label>Role<select name="role" defaultValue="judge"><option value="judge">Judge</option><option value="admin">Admin</option></select></label><button disabled={pending}>{pending?'Creating…':'Create account'}</button><p className="message" role="status">{state.message}</p></form>;
}
export function AccountForm({account}:{account:Account}) {
  const [state,action,pending]=useActionState(updateAccount,{message:''});
  return <form action={action} className="account-row"><input type="hidden" name="id" value={account.id}/><div><p className="account-email">{account.email}</p><label>Display name<input name="name" defaultValue={account.display_name} minLength={2} maxLength={80} required/></label></div><label>Role<select name="role" defaultValue={account.app_role}><option value="judge">Judge</option><option value="admin">Admin</option></select></label><label className="checkbox"><input type="checkbox" name="active" defaultChecked={account.is_active}/>Active access</label><button className="secondary" disabled={pending}>{pending?'Saving…':'Save access'}</button><p role="status" className="message">{state.message}</p></form>;
}
