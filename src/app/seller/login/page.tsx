"use client";

import Link from "next/link";
import { useRouter,useSearchParams } from "next/navigation";
import { Suspense,useState,type FormEvent } from "react";
import { sellerLogin } from "@/lib/seller";
import { SellerNotice } from "@/components/SellerShell";
import { SellerLocalized } from "@/components/seller/SellerI18n";
function LoginForm(){const router=useRouter();const params=useSearchParams();const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [error,setError]=useState(params.get("denied")?"This portal is available to seller accounts only.":"");const [notice]=useState(params.get("deletion")==="pending"?"Your account is disabled while marketplace listing removal is being processed.":params.get("deletion")==="complete"?"Your account was deleted.":"");const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError("");try{await sellerLogin(email,password);router.replace("/seller/products");}catch(err){setError(err instanceof Error?err.message:"Sign in failed.");}finally{setBusy(false);}}
 return <SellerLocalized><main className="seller-auth-card"><div className="seller-brand"><span>BENIM</span><b style={{color:"#f58a1f"}}>DEPOM</b><small>SELLER WORKSPACE</small></div><h1>Welcome back</h1><p>Sign in to manage your products and sales.</p>{notice&&<SellerNotice kind="success">{notice}</SellerNotice>}<form onSubmit={submit}><label className="seller-field">Email<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="seller-field">Password<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<SellerNotice>{error}</SellerNotice>}<button className="seller-button primary" disabled={busy}>{busy?"Signing in…":"Sign in"}</button></form><p><Link className="seller-link" href="/seller/forgot-password">Forgot password?</Link></p><p>New to Benim Depom? <Link className="seller-link" href="/seller/register">Create seller account</Link></p></main></SellerLocalized>;
}
export default function SellerLoginPage(){return <SellerLocalized><Suspense fallback={<SellerLocalized><p className="seller-loading">Loading…</p></SellerLocalized>}><LoginForm/></Suspense></SellerLocalized>;}
