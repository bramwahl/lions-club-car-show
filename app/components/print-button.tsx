'use client';
export function PrintButton({title}:{title?:string}){return <button className="no-print" onClick={()=>{
 if(!title){window.print();return;}
 const previous=document.title;document.title=title;
 const restore=()=>{document.title=previous;window.removeEventListener('afterprint',restore);};
 window.addEventListener('afterprint',restore,{once:true});
 window.print();
}}>Print / Save as PDF</button>;}
