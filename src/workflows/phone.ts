export function formatPhone(value:string){
 if(/[a-z@]/i.test(value))return value;
 let digits=value.replace(/\D/g,'');
 if(digits.length===11&&digits.startsWith('1'))digits=digits.slice(1);
 if(digits.length>10)return value;
 return digits.length>6?`${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`:digits.length>3?`${digits.slice(0,3)}-${digits.slice(3)}`:digits;
}
