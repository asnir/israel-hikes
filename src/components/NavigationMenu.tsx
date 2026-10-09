import { navigationLinks } from "../lib/navigation";
import { useState } from "react";
import { language } from "../i18n";
import { type Trail } from "../lib/catalog";
export default function NavigationMenu({trail}:{trail:Trail}) {
 const links=navigationLinks(trail);const [copied,C]=useState(false);const he=language()==="he";
 if(!links)return <p className="fine-print">{he?"נקודת התחלה מאומתת אינה זמינה. אין כאן קישור ניווט מנוחש.":"No verified start point is available. A navigation destination has not been guessed."}</p>;
 const coords=links.coordinates;
 return <div className="navigation-menu">
 <h3>{he?"ניווט לנקודת ההתחלה":"Navigate to the start"}</h3>
 <div className="navigation-links">
 {links.google&&<a className="button primary" href={links.google} target="_blank" rel="noopener noreferrer">Google Maps</a>}
 <a className="button" href={links.waze} target="_blank" rel="noopener noreferrer">Waze</a>
 <button className="button" onClick={async()=>{try{await navigator.clipboard.writeText(coords);C(true)}catch{C(false)}}}>{he?"העתקת קואורדינטות":"Copy coordinates"}</button>
 </div>
 <p><bdi dir="ltr">{coords}</bdi> {copied&&<span role="status">{he?"הועתקו":"Copied"}</span>}</p>
 <p className="fine-print">{he?"אל תחילת התוואי בלבד. הסיכה אינה אישור חניה, כניסה ברכב או דרך גישה בטוחה.":"To the route start only. The pin does not confirm parking, vehicle entry or safe road access."}</p>
 </div>
}
