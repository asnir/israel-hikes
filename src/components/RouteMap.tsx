import { routeMapLink } from "../lib/navigation";
import {useState} from 'react';
import {language} from '../i18n';
import type {Trail} from '../lib/catalog';
export default function RouteMap({trail}:{trail:Trail}){
 const he=language()==='he', [show,S]=useState(false);
 const share=routeMapLink(trail);
 return <section className="detail-section route-map-section"><h2>{he?'מפת מסלול וקובצי ניווט':'Route map and navigation files'}</h2>
 {share?<><p className="fine-print">{he?'מקור חיצוני: Israel Hiking Map הודיע שהשירות אינו נתמך ועלול להפסיק לעבוד. התוואי הוא תיאור מקור, לא אישור שהמסלול פתוח או בטוח.':'External source: Israel Hiking Map states that it is unsupported and may stop working. The track is source information, not confirmation that the route is open or safe.'}</p>
 <a className="button primary" href={share} target="_blank" rel="noopener noreferrer">{he?'פתיחת מפת המקור':'Open source route map'}</a>
 <button className="button" onClick={()=>S(!show)} aria-expanded={show}>{he?(show?'הסתרת המפה':'הצגת מפה חיצונית כאן'):(show?'Hide map':'Show external map here')}</button>
 {show&&<iframe className="source-map-frame" title={he?'מפת מסלול חיצונית - Israel Hiking Map':'External route map - Israel Hiking Map'} src={share} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-downloads allow-popups" />}
 <p>{he?'להורדת GPX במקור: תפריט ← Save - Share - Files ← Export As… ← GPX. אפשר לייבא GPX באפליקציית ניווט שתומכת בו. בדקו שהקובץ תואם למסלול הרצוי והורידו אותו לפני יציאה.':'For GPX export at the source: Menu → Save - Share - Files → Export As… → GPX. Import the file into a GPX-compatible navigation app. Check that it matches your intended route and download it before leaving.'}</p>
 <p className="fine-print">{he?'המפה נטענת רק לפי בחירה ופונה לשירות חיצוני. אם ההטמעה אינה זמינה, השתמשו בקישור המקור. קובצי המסלול לא הועתקו ולא הוענק להם רישיון חדש.':'The map loads only on request and connects to an external service. If embedding fails, use the source link. Track files have not been copied or relicensed.'}</p></>:<p>{he?'אין במאגר קובץ GPX או קישור ישיר למפת תוואי מאומתת למסלול זה. קישורי המקור למטה עשויים לכלול מפה או הורדה. לא נוצר תוואי משוער.':'No GPX file or verified direct route-map link is stored for this trail. The source links below may provide a map or download. A guessed track has not been created.'}</p>}
 </section>;
}
