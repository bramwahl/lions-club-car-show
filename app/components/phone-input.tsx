'use client';
import {useState} from 'react';
import {formatPhone} from '../../src/workflows/phone';
export function PhoneInput({defaultValue=''}:{defaultValue?:string}){
 const [value,setValue]=useState(()=>formatPhone(defaultValue));
 return <input name="phone" type="tel" autoComplete="tel" value={value} maxLength={50} onChange={e=>setValue(formatPhone(e.target.value))}/>;
}
