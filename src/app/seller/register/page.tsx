"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState,type FormEvent } from "react";
import { sellerPublicRequest } from "@/lib/seller";
import { SellerNotice } from "@/components/SellerShell";
import { SellerLocalized } from "@/components/seller/SellerI18n";
export default function SellerRegisterPage(){const router=useRouter();const [form,setForm]=useState({username:"",email:"",password:"",password_confirm:"",first_name:"",last_name:"",phone:"",preferred_language:"en"});const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();setError("");setBusy(true);try{await sellerPublicRequest("/api/v1/auth/register/",form);router.push(`/seller/verify-email?email=${encodeURIComponent(form.email)}`);}catch(e){setError(e instanceof Error?e.message:"Registration failed.");}finally{setBusy(false);}}
 const text=(key:keyof typeof form,label:string,type="text")=><label className="seller-field">{label}<input required={key!=="phone"} type={type} autoComplete={key==="password_confirm"?"new-password":key} value={form[key]} onChange={e=>setForm(v=>({...v,[key]:e.target.value}))}/></label>;
 return <SellerLocalized><main className="seller-auth-card"><Link className="seller-brand" href="/seller/login"><span>BENIM</span><b style={{color:"#f58a1f"}}>DEPOM</b><small>SELLER WORKSPACE</small></Link><h1>Create seller account</h1><p>Use your business details to register.</p><form onSubmit={submit}>{text("username","Username")}{text("email","Email","email")}<div className="seller-field-row">{text("first_name","First name")}{text("last_name","Last name")}</div>{text("phone","Phone","tel")}{text("password","Password","password")}{text("password_confirm","Confirm password","password")}<label className="seller-field">Preferred language<select value={form.preferred_language} onChange={e=>setForm(v=>({...v,preferred_language:e.target.value}))}>{[["en","English"],["tr","Türkçe"],["ru","Русский"],["de","Deutsch"]].map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>{error&&<SellerNotice>{error}</SellerNotice>}<button className="seller-button primary" disabled={busy}>{busy?"Creating…":"Create account"}</button></form><p>Already registered? <Link className="seller-link" href="/seller/login">Sign in</Link></p></main></SellerLocalized>;
}
