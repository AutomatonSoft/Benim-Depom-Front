"use client";

import Link from "next/link";
import { useSearchParams,useRouter } from "next/navigation";
import { Suspense,useState,type FormEvent } from "react";
import { sellerPublicRequest } from "@/lib/seller";
import { SellerNotice } from "@/components/SellerShell";
import { SellerLocalized } from "@/components/seller/SellerI18n";
function VerifyForm(){const params=useSearchParams();const router=useRouter();const [email,setEmail]=useState(params.get("email")||"");const [phone,setPhone]=useState(params.get("phone")||"");const [code,setCode]=useState("");const [notice,setNotice]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError("");setNotice("");try{await sellerPublicRequest("/api/v2/auth/email/verify/",{email,phone,code});setNotice("Email verified. You can sign in now.");setTimeout(()=>router.push("/seller/login"),900);}catch(e){setError(e instanceof Error?e.message:"Verification failed.");}finally{setBusy(false);}}
 async function resend(){if(!email||!phone)return;setBusy(true);setError("");try{await sellerPublicRequest("/api/v2/auth/email/resend-verification/",{email,phone});setNotice("If this email has an unverified account, a new code was sent.");}catch(e){setError(e instanceof Error?e.message:"Could not resend code.");}finally{setBusy(false);}}
 return <SellerLocalized><main className="seller-auth-card"><h1>Verify your email</h1><p>Enter the six-digit code sent to your email address.</p><form onSubmit={submit}><label className="seller-field">Phone<input type="tel" autoComplete="tel" required value={phone} onChange={e=>setPhone(e.target.value)}/></label><label className="seller-field">Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="seller-field">Verification code<input inputMode="numeric" minLength={6} maxLength={6} required value={code} onChange={e=>setCode(e.target.value)}/></label>{error&&<SellerNotice>{error}</SellerNotice>}{notice&&<SellerNotice kind="success">{notice}</SellerNotice>}<button className="seller-button primary seller-verify-submit" disabled={busy}>Verify email</button><button type="button" className="seller-button" disabled={busy||!email||!phone} onClick={()=>void resend()}>Resend code</button></form><p className="seller-auth-navigation"><Link className="seller-link" href="/seller/login">Back to sign in</Link></p></main></SellerLocalized>;
}
export default function SellerVerifyEmailPage(){return <SellerLocalized><Suspense fallback={<SellerLocalized><p className="seller-loading">Loading…</p></SellerLocalized>}><VerifyForm/></Suspense></SellerLocalized>;}
