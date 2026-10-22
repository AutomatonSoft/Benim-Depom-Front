"use client";

import { useEffect,useState } from "react";
import { useParams } from "next/navigation";
import { SellerNotice,SellerPage } from "@/components/SellerShell";
import ProductEditor from "@/components/seller/ProductEditor";
import { sellerRequest,type SellerProduct } from "@/lib/seller";
export default function EditSellerProductPage(){const {id}=useParams<{id:string}>();const [product,setProduct]=useState<SellerProduct|null>(null);const [error,setError]=useState("");useEffect(()=>{sellerRequest<SellerProduct>(`/api/v1/products/${id}/`).then(setProduct).catch(e=>setError(e.message));},[id]);return <SellerPage title="Edit product" description="Seller changes to approved products are sent for moderation.">{error?<SellerNotice>{error}</SellerNotice>:product?<ProductEditor product={product}/>:<p className="seller-empty">Loading product…</p>}</SellerPage>;}
