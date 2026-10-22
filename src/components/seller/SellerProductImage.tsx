"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import Image from "next/image";

export default function SellerProductImage({src,alt,className,style}:{src?:string|null;alt:string;className?:string;style?:React.CSSProperties}){
  const [failed,setFailed]=useState(!src);
  if(failed)return <div className={`seller-image-placeholder ${className||""}`} style={style} role="img" aria-label={alt||"Product image unavailable"}><Package size={22}/></div>;
  return <Image unoptimized src={src||""} alt={alt} width={320} height={320} className={className} style={style} onError={()=>setFailed(true)}/>;
}
