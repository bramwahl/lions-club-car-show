const COLORS=['Black','White','Silver','Gray','Red','Blue','Green','Yellow','Orange','Brown','Tan','Beige','Gold','Purple','Pink','Burgundy','Cream','Two-tone','Other'];
export function CarColorSelect({value,required=false}:{value?:string|null;required?:boolean}) {
 const saved=value?.trim()??'';
 const options=saved&&!COLORS.includes(saved)?[saved,...COLORS]:COLORS;
 return <label>Car color<select name="color" defaultValue={saved} required={required}><option value="">Choose color</option>{options.map(color=><option key={color} value={color}>{color}</option>)}</select></label>;
}
