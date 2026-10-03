import type { Camera, MapTheme } from './CityMap';
import { unproject } from '../../lib/geo';

/**
 * Basemap: OpenFreeMap vector tiles (OpenStreetMap data, free for commercial
 * use, no key) drawn by MapLibre GL with NÜVA's own minimal styles:
 *   light → "Esencial · Marfil"     (passenger)
 *   dark  → "Esencial · Medianoche" (driver)
 * The map is display-only; route, markers and labels stay in CityMap's overlay,
 * and the camera follows CityMap's camera exactly.
 */

export const VECTOR_ATTRIBUTION = '© OpenFreeMap · OpenMapTiles · OpenStreetMap';

const THEMES = {
  light: {
    background: '#F5F6F0', water: '#E2E8E3', park: '#EEF1E6',
    minor: 'rgba(16,20,17,0.05)', major: '#FFFFFF', majorCase: '#E4E5DD', motor: '#FFFFFF', motorCase: '#DADBD2',
    label: '#A3A79F', labelStrong: '#5F645E', halo: '#F5F6F0',
  },
  dark: {
    background: '#101411', water: '#141B19', park: '#121812',
    minor: 'rgba(245,246,240,0.035)', major: '#242A23', majorCase: '#101411', motor: '#2E352D', motorCase: '#101411',
    label: '#575C55', labelStrong: '#8B8F89', halo: '#101411',
  },
} as const;

export const vectorBackground = (theme: MapTheme) => THEMES[theme].background;

/** Centre + MapLibre zoom (512-px tiles) for a CityMap camera over a w×h view. */
export function vectorView(cam: Camera, w: number, h: number) {
  const c = unproject({ x: cam.x + w / 2 / cam.s, y: cam.y + h / 2 / cam.s });
  const metersPerPx = 10 / cam.s;
  const zoom = Math.log2((78271.517 * Math.cos((c.lat * Math.PI) / 180)) / metersPerPx);
  return { lng: c.lng, lat: c.lat, zoom };
}

export const MAPLIBRE_JS = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js';
export const MAPLIBRE_CSS = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css';
export const BASE_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
export const themeColors = (theme: MapTheme) => THEMES[theme];

/**
 * Plain-JS source of `nuva(style, T)`, which turns OpenFreeMap's positron style
 * into NÜVA's minimal style. Kept as a string so the exact same code runs in the
 * native WebView (Hermes can't serialise functions) and on the web.
 */
export const NUVA_STYLE_JS = `
// Minimal: no buildings, blocks, woods, paths, rail, borders, shields, icons or street names.
var DROP=/^(building|landuse_residential|landcover_|highway_path|road_pier|road_area_pier|railway|boundary|highway-shield|road_shield|highway-name|label_country|label_state|aeroway|airport|waterway_line_label|water_name)/;
function nuva(s,T){
  s.layers=s.layers.filter(function(l){return !DROP.test(l.id)});
  s.layers.forEach(function(l){
    var p=l.paint=l.paint||{}, y=l.layout=l.layout||{}, id=l.id;
    if(id==='background')p['background-color']=T.background;
    else if(id==='park'){p['fill-color']=T.park;p['fill-opacity']=1}
    else if(id==='water')p['fill-color']=T.water;
    else if(id==='waterway')p['line-color']=T.water;
    else if(/casing/.test(id)&&/motorway/.test(id))p['line-color']=T.motorCase;
    else if(/motorway/.test(id)&&l.type==='line')p['line-color']=T.motor;
    else if(/major_casing/.test(id))p['line-color']=T.majorCase;
    else if(/major/.test(id)&&l.type==='line')p['line-color']=T.major;
    else if(/minor/.test(id)&&l.type==='line')p['line-color']=T.minor;
    if(l.type==='symbol'){
      delete y['icon-image'];
      y['text-transform']='uppercase';y['text-letter-spacing']=0.25;y['text-font']=['Noto Sans Bold'];
      p['text-color']=/city|town/.test(id)?T.labelStrong:T.label;
      p['text-halo-color']=T.halo;p['text-halo-width']=1.6;
    }
  });
  return s;
}`;

/** Native: a self-contained page (MapLibre + NÜVA style) for the WebView. */
export function vectorMapHtml(theme: MapTheme, initial: { lng: number; lat: number; zoom: number }) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link href="${MAPLIBRE_CSS}" rel="stylesheet">
<script src="${MAPLIBRE_JS}"></script>
<style>html,body,#m{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:${THEMES[theme].background}}</style>
</head><body><div id="m"></div><script>
${NUVA_STYLE_JS}
var T=${JSON.stringify(THEMES[theme])};
var map=null, view=${JSON.stringify(initial)};
window.__view=function(lng,lat,zoom){view={lng:lng,lat:lat,zoom:zoom};if(map)map.jumpTo({center:[lng,lat],zoom:zoom});};
fetch('${BASE_STYLE_URL}').then(function(r){return r.json()}).then(function(s){
  map=new maplibregl.Map({container:'m',style:nuva(s,T),center:[view.lng,view.lat],zoom:view.zoom,interactive:false,attributionControl:false,fadeDuration:0});
}).catch(function(){});
</script></body></html>`;
}
