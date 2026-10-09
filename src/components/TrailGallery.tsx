import { useState } from "react";
import { language } from "../i18n";
export interface GalleryPhoto {
  src: string;
  captionHe: string;
  captionEn: string;
  author: string;
  authorEn: string;
  title: string;
  titleEn?: string;
  source: string;
  licence: string;
  licenceUrl: string;
  changes: string;
}
export default function TrailGallery({photos}:{photos:GalleryPhoto[]}) {
  const [index, setIndex] = useState(0);
  const he = language() === "he";
  const photo = photos[index] || photos[0];
  if (!photo) return null;
  return <section className="trail-gallery" aria-label={he ? "תמונות המסלול" : "Trail photographs"}>
    <figure className="area-photo">
      <img src={photo.src} alt={he ? photo.captionHe : photo.captionEn} loading="lazy" width="1400" height="700" />
      <figcaption>
        <span>{he ? photo.captionHe : photo.captionEn}</span>
        <small><a href={photo.source} target="_blank" rel="noopener noreferrer">{!he && photo.titleEn ? photo.titleEn : photo.title}</a> · {he ? photo.author : photo.authorEn} · <a href={photo.licenceUrl} target="_blank" rel="noopener noreferrer">{photo.licence}</a> · {he ? "הוקטן, הומר ל-WebP ונחתך לתצוגה" : photo.changes}</small>
      </figcaption>
    </figure>
    {photos.length > 1 && <div className="gallery-controls">
      <button className="button" onClick={()=>setIndex((index+photos.length-1)%photos.length)}>{he ? "תמונה קודמת" : "Previous photo"}</button>
      <span role="status" aria-live="polite">{index+1} / {photos.length}</span>
      <button className="button" onClick={()=>setIndex((index+1)%photos.length)}>{he ? "תמונה הבאה" : "Next photo"}</button>
    </div>}
  </section>;
}
