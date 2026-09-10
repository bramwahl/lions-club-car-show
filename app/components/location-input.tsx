'use client';
import {useState} from 'react';
export function LocationInput({kind,defaultValue='',required=false}:{kind:'city'|'state';defaultValue?:string;required?:boolean}){
 const [value,setValue]=useState(kind==='state'?defaultValue.toUpperCase():defaultValue.replace(/^(\s*)(\S)/,(_,space,letter)=>space+letter.toUpperCase()));
 return <input name={kind} value={value} required={required} maxLength={kind==='state'?2:255} pattern={kind==='state'?'[A-Z]{2}':undefined} title={kind==='state'?'Use two letters, such as IN.':undefined} autoCapitalize={kind==='state'?'characters':'words'} autoComplete={kind==='state'?'address-level1':'address-level2'} onChange={e=>{const v=e.target.value;setValue(kind==='state'?v.replace(/[^a-z]/gi,'').slice(0,2).toUpperCase():v.replace(/^(\s*)(\S)/,(_,space,letter)=>space+letter.toUpperCase()));}}/>;
}
