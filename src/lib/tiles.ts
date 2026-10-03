import { LatLng } from './geo';

/**
 * Raster basemap tiles placed on the app's local projection: Esri "Canvas"
 * light/dark gray (no API key). Light for passengers, dark for drivers/admin.
 * Attribution is mandatory. Esri paths are z/y/x. Canvas data stops at z16;
 * deeper views upscale z16 tiles.
 * For high commercial volume, move to a keyed provider (Esri/MapTiler/Stadia).
 */
const ESRI = 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas';

export const TILE_URL = {
  light: (z: number, x: number, y: number) => `${ESRI}/World_Light_Gray_Base/MapServer/tile/${z}/${y}/${x}`,
  dark: (z: number, x: number, y: number) => `${ESRI}/World_Dark_Gray_Base/MapServer/tile/${z}/${y}/${x}`,
};

export const MAX_TILE_ZOOM = 16;

export const ATTRIBUTION = '© Esri · HERE · OpenStreetMap';

/** Tile x/y at zoom z containing a lat/lng (Web Mercator). */
export function tileOf(p: LatLng, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((p.lng + 180) / 360) * n);
  const latRad = (p.lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

/** North-west corner of a tile. */
export function tileCorner(x: number, y: number, z: number): LatLng {
  const n = 2 ** z;
  const lng = (x / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return { lat, lng };
}
