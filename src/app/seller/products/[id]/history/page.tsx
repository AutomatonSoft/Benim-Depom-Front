import { redirect } from "next/navigation";
export default async function SellerProductHistoryPage({params}:{params:Promise<{id:string}>}){const {id}=await params;redirect(`/seller/products/${id}?history=1`);}
