"use client";

import { X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import SellerProductImage from "@/components/seller/SellerProductImage";
import styles from "./ProductPhotoViewer.module.css";

export default function ProductPhotoViewer({ src, title, closeLabel, onClose }: {
  src: string | null;
  title: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return <Dialog open={src !== null} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className={styles.viewer} showCloseButton={false} aria-describedby={undefined} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <DialogTitle className="sr-only">{title}</DialogTitle>
      <DialogClose asChild><button type="button" className={styles.close} aria-label={closeLabel}><X size={24} aria-hidden="true" /></button></DialogClose>
      {src && <SellerProductImage key={src} className={styles.image} src={src} alt={title} />}
    </DialogContent>
  </Dialog>;
}
