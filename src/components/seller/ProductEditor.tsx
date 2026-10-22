"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SellerNotice } from "@/components/SellerShell";
import { SellerLocalized } from "@/components/seller/SellerI18n";
import { sellerRequest, type SellerProduct, type SellerVariant } from "@/lib/seller";
import OttoFields, { type OttoValue } from "@/components/seller/OttoFields";
import SellerProductImage from "@/components/seller/SellerProductImage";
import { useSellerI18n } from "@/components/seller/SellerI18n";

const cities = [["IST","Istanbul"],["ANK","Ankara"],["IZM","Izmir"],["BUR","Bursa"],["KSY","Kars"],["INE","Inegol"]];
type Fields = { title:string; product_type:string; unit_price:string; currency:"TRY"|"EUR"|"USD"; warehouse_city:string; color:string; materials:string; material_composition:string; width_cm:string; height_cm:string; length_cm:string; quantity:string; comment:string; set_parts:string };
const empty:Fields = { title:"",product_type:"",unit_price:"",currency:"TRY",warehouse_city:"INE",color:"",materials:"",material_composition:"",width_cm:"",height_cm:"",length_cm:"",quantity:"1",comment:"",set_parts:"[]" };
function fieldsFor(product:SellerProduct):Fields{const v=product.variants[0];return {title:product.title,product_type:product.product_type,unit_price:product.unit_price,currency:product.currency,warehouse_city:product.warehouse_city,color:v?.color||"",materials:v?.materials.join(", ")||"",material_composition:v?.material_composition||"",width_cm:v?.width_cm||"",height_cm:v?.height_cm||"",length_cm:v?.length_cm||"",quantity:String(v?.quantity??1),comment:"",set_parts:JSON.stringify(product.set_parts||[],null,2)};}

export default function ProductEditor({ product }: { product?: SellerProduct }) {
  const { t } = useSellerI18n();
  const router = useRouter(); const [fields,setFields] = useState<Fields>(product?()=>fieldsFor(product):empty); const [files,setFiles] = useState<File[]>([]);const [previews,setPreviews]=useState<string[]>([]);
  const [error,setError] = useState(""); const [success,setSuccess] = useState(""); const [busy,setBusy] = useState(false); const [resubmit,setResubmit] = useState(false);
  const [otto,setOtto] = useState<OttoValue>(()=>({group:product?.otto_category_group_id??null,category:product?.otto_category_id??null,attributes:product?.otto_attributes??{}}));
  useEffect(()=>()=>previews.forEach(URL.revokeObjectURL),[previews]);
  function set<K extends keyof Fields>(key:K,value:Fields[K]){setFields(current=>({...current,[key]:value}));}
  function chooseFiles(selected:File[]){if(selected.length+(product?.images.length||0)>20){setError("A product can have at most 20 photos.");return;}const invalid=selected.find(file=>!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>40*1024*1024);if(invalid){setError(t("{file} must be JPEG, PNG, or WebP and no larger than 40 MB.",{file:invalid.name}));return;}setError("");setFiles(selected);setPreviews(selected.map(file=>URL.createObjectURL(file)));}
  function moveFile(index:number,step:number){const target=index+step;if(target<0||target>=files.length)return;const next=[...files];[next[index],next[target]]=[next[target],next[index]];chooseFiles(next);}
  function removeFile(index:number){chooseFiles(files.filter((_,i)=>i!==index));}
  async function submit(event:FormEvent){event.preventDefault();setError("");setSuccess("");setBusy(true);
    const materials=fields.materials.split(",").map(s=>s.trim()).filter(Boolean);
    const variant:SellerVariant={color:fields.color,materials,material_composition:fields.material_composition,width_cm:fields.width_cm,height_cm:fields.height_cm,length_cm:fields.length_cm,quantity:Number(fields.quantity)};
    let setParts:SellerProduct["set_parts"];try{const parsed=JSON.parse(fields.set_parts);if(!Array.isArray(parsed)||parsed.length>20)throw new Error();setParts=parsed;}catch{setError("Set parts must be a JSON array with no more than 20 entries.");setBusy(false);return;}
    const body={title:fields.title.trim(),product_type:fields.product_type.trim(),unit_price:fields.unit_price,currency:fields.currency,warehouse_city:fields.warehouse_city,variants:[variant],set_parts:setParts,otto_category_group_id:otto.group,otto_category_id:otto.category,otto_attributes:otto.attributes};
    try{
      if(product){
        const payload={...body,change_comment:fields.comment,...(resubmit?{resubmit_for_moderation:true}:{})};
        let updateBody:BodyInit; const headers:HeadersInit={};
        if(files.length){const form=new FormData();Object.entries(payload).forEach(([key,value])=>form.append(key,["variants","set_parts","otto_attributes"].includes(key)?JSON.stringify(value):String(value)));files.forEach(file=>form.append("images",file));updateBody=form;}
        else {headers["Content-Type"]="application/json";updateBody=JSON.stringify(payload);}
        await sellerRequest(`/api/v1/products/${product.id}/`,{method:"PATCH",headers,body:updateBody});
        setSuccess(product.status==="approved"?"Your changes were sent for review.":"Product saved.");
        setTimeout(()=>router.push(`/seller/products/${product.id}`),700);
      }else{
        const form=new FormData(); Object.entries(body).forEach(([key,value])=>form.append(key,["variants","set_parts","otto_attributes"].includes(key)?JSON.stringify(value):String(value)));
        files.forEach(file=>form.append("images",file));
        await sellerRequest("/api/v1/products/",{method:"POST",headers:{"Idempotency-Key":crypto.randomUUID()},body:form});
        router.push("/seller/products");
      }
    }catch(e){setError(e instanceof Error?e.message:"Could not save product.");}finally{setBusy(false);}
  }
  async function removeImage(imageId:number){if(!product)return;setBusy(true);setError("");try{await sellerRequest(`/api/v1/products/${product.id}/images/${imageId}/`,{method:"DELETE"});router.refresh();window.location.reload();}catch(e){setError(e instanceof Error?e.message:"Could not remove image.");}finally{setBusy(false);}}
  async function makePrimary(imageId:number){if(!product)return;setBusy(true);setError("");try{await sellerRequest(`/api/v1/products/${product.id}/images/${imageId}/make-primary/`,{method:"POST",body:"{}"});window.location.reload();}catch(e){setError(e instanceof Error?e.message:"Could not update primary image.");}finally{setBusy(false);}}
  async function moveExisting(index:number,step:number){if(!product)return;const target=index+step;if(target<0||target>=product.images.length)return;const imageIds=product.images.map(image=>image.id);[imageIds[index],imageIds[target]]=[imageIds[target],imageIds[index]];setBusy(true);setError("");try{await sellerRequest(`/api/v1/products/${product.id}/images/reorder/`,{method:"POST",body:JSON.stringify({image_ids:imageIds})});window.location.reload();}catch(e){setError(e instanceof Error?e.message:"Could not reorder photos.");}finally{setBusy(false);}}
  const field=(name:keyof Fields,label:string,type="text",required=true)=><label className="seller-field">{label}<input required={required} type={type} step={type==="number"?(name==="quantity"?"1":"0.01"):undefined} min={type==="number"?(name==="quantity"?"1":"0.01"):undefined} value={fields[name]} onChange={e=>set(name,e.target.value as Fields[typeof name])}/></label>;
  return <SellerLocalized><form className="seller-stack" onSubmit={submit}>
    {error&&<SellerNotice>{error}</SellerNotice>}{success&&<SellerNotice kind="success">{success}</SellerNotice>}
    <section className="seller-card"><h2>Product information</h2><div className="seller-form-grid">
      {field("title","Product title")}{field("product_type","Product type")}
      <div className="seller-field-row">{field("unit_price","Unit price","number")}<label className="seller-field">Currency<select value={fields.currency} onChange={e=>set("currency",e.target.value as Fields["currency"])}>{["TRY","EUR","USD"].map(c=><option key={c}>{c}</option>)}</select></label></div>
      <label className="seller-field">Warehouse city<select value={fields.warehouse_city} onChange={e=>set("warehouse_city",e.target.value)}>{cities.map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></label>
    </div></section>
    <section className="seller-card"><h2>Variant details</h2><p>One color variant is supported per product. Add materials separated by commas.</p><div className="seller-form-grid">
      {field("color","Color")}{field("materials","Materials (up to 2)")}{field("material_composition","Material composition", "text",false)}
      <div className="seller-field-row">{field("width_cm","Width (cm)","number")}{field("height_cm","Height (cm)","number")}</div>
      <div className="seller-field-row">{field("length_cm","Length (cm)","number")}{field("quantity","Quantity","number")}</div>
    </div></section>
    <section className="seller-card"><h2>Set parts (optional)</h2><p>Enter up to 20 additional pieces as JSON objects with description and dimensions.</p><label className="seller-field">Set parts JSON<textarea value={fields.set_parts} onChange={e=>set("set_parts",e.target.value)} placeholder="[]"/></label></section>
    <OttoFields value={otto} onChange={setOtto}/>
    <section className="seller-card" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();chooseFiles(product?[e.dataTransfer.files[0]].filter(Boolean):[...files,...Array.from(e.dataTransfer.files)]);}}><h2>{product?"Add photos":"Product photos"}</h2><p>{product?"Add more photos to this product.":"Select or drop up to 20 JPEG, PNG or WebP images. The first photo will be the main image."} Maximum 40 MB each.</p><label className="seller-field">Photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple={!product} required={!product} onChange={e=>chooseFiles(Array.from(e.target.files||[]))}/></label>{files.map((file,index)=><div className="seller-toolbar" key={`${file.name}-${index}`}><img src={previews[index]} alt={`Selected product photo ${index+1}`} width="64" height="64" style={{objectFit:"cover",borderRadius:6}}/><span>{index===0&&!product?"Main photo · ":""}{file.name}</span>{!product&&<><button type="button" className="seller-button" disabled={index===0} onClick={()=>moveFile(index,-1)}>Move earlier</button><button type="button" className="seller-button" disabled={index===files.length-1} onClick={()=>moveFile(index,1)}>Move later</button></>}<button type="button" className="seller-button danger" onClick={()=>removeFile(index)}>Remove</button></div>)}</section>
    {product?.images?.length ? <section className="seller-card"><h2>Current photos</h2><div className="seller-toolbar">{product.images.map((image,index)=><div key={image.id} style={{display:"grid",gap:6}}><SellerProductImage src={image.thumbnail||image.image} alt={image.is_primary?"Main product photo":"Product photo"} style={{width:90,height:90,objectFit:"cover",borderRadius:8}}/>{image.is_primary?<small>Main photo</small>:<button type="button" className="seller-button" disabled={busy} onClick={()=>void makePrimary(image.id)}>Make main</button>}<button type="button" className="seller-button" disabled={busy||index===0} onClick={()=>void moveExisting(index,-1)}>Move earlier</button><button type="button" className="seller-button" disabled={busy||index===product.images.length-1} onClick={()=>void moveExisting(index,1)}>Move later</button><button type="button" className="seller-button danger" disabled={busy} onClick={()=>void removeImage(image.id)}>Remove</button></div>)}</div></section>:null}
    {product&&(product.status==="approved"||product.status==="rejected"||product.status==="withdrawn")&&<section className="seller-card"><h2>Review note</h2><label className="seller-field">Comment for reviewer<textarea value={fields.comment} onChange={e=>set("comment",e.target.value)}/></label>{["rejected","withdrawn"].includes(product.status)&&<label><input type="checkbox" checked={resubmit} onChange={e=>setResubmit(e.target.checked)}/> Resubmit for moderation</label>}</section>}
    <div className="seller-toolbar"><button className="seller-button primary" disabled={busy}>{busy?"Saving…":product?"Save changes":"Create product"}</button></div>
  </form></SellerLocalized>;
}
