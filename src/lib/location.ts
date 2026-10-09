export const locationMaxAge = 15 * 60 * 1000;
export function isFreshLocation(observedAt: number, now = Date.now()) {
  return Number.isFinite(observedAt) && now >= observedAt && now - observedAt < locationMaxAge;
}
export type LocationFix = { point: [number, number]; accuracy: number; observedAt: number };
type OneShotLocation = Pick<Geolocation, "getCurrentPosition">;
export function readCurrentLocation(service: OneShotLocation | null): Promise<LocationFix> {
  return new Promise((resolve, reject) => {
    if (!service) { reject(new Error("Geolocation unavailable")); return; }
    service.getCurrentPosition(position => {
      const { latitude, longitude, accuracy } = position.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || !Number.isFinite(position.timestamp)) {
        reject(new Error("Invalid location fix")); return;
      }
      resolve({ point: [latitude, longitude], accuracy, observedAt: position.timestamp });
    }, reject, { enableHighAccuracy: false, maximumAge: 0, timeout: 10000 });
  });
}
