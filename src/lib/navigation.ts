import { coordinates, type Trail } from "./catalog";
export function navigationLinks(trail: Trail) {
 const point=coordinates(trail);
 if(!point) return null;
 const coords=point.join(",");
 return {coordinates:coords,google:trail.access?.mapUrl||null,waze:"https://waze.com/ul?ll="+encodeURIComponent(coords)+"&navigate=yes"};
}
export function routeMapLink(trail: Trail) {
 return trail.refs.find(([,u])=>/^https:\/\/israelhiking\.osm\.org\.il\/share\/[A-Za-z0-9]+$/.test(u))?.[1]||null;
}
