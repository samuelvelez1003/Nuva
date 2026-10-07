import type { Camera, MapTheme } from './CityMap';
import { unitsPerDegree, unproject } from '../../lib/geo';

/**
 * Basemap, recoloured with NÜVA's palette:
 *   light → "Esencial · Marfil"     (passenger)
 *   dark  → "Esencial · Medianoche" (driver)
 * With EXPO_PUBLIC_MAPBOX_TOKEN: Mapbox light/dark styles drawn by Mapbox GL JS
 * (Mapbox tiles may only be drawn by Mapbox's own library). Without it:
 * OpenFreeMap tiles (OpenStreetMap, no key) drawn by MapLibre GL.
 * The map is display-only and follows CityMap's camera exactly. It also draws the
 * route itself (NUVA_ROUTE_JS), like Uber or Google Maps: glued to the roads at any
 * zoom, under the street names, and moving in lockstep with the map. Markers and
 * labels stay in CityMap's overlay.
 */

/** Public token (pk.): Mapbox designs it to ship inside apps. */
export const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
export const USE_MAPBOX = MAPBOX_TOKEN.startsWith('pk.');

export const VECTOR_ATTRIBUTION = USE_MAPBOX ? '© Mapbox · © OpenStreetMap' : '© OpenFreeMap · OpenMapTiles · OpenStreetMap';

const THEMES = {
  light: {
    background: '#F5F6F0', water: '#E2E8E3', park: '#EEF1E6',
    minor: 'rgba(16,20,17,0.05)', major: '#FFFFFF', majorCase: '#E4E5DD', motor: '#FFFFFF', motorCase: '#DADBD2',
    label: '#A3A79F', labelStrong: '#5F645E', halo: '#F5F6F0',
    route: '#101411', routeCase: '#FFFFFF', routeDone: '#B7BBB2', routeGlow: false,
  },
  dark: {
    background: '#101411', water: '#141B19', park: '#121812',
    minor: 'rgba(245,246,240,0.035)', major: '#242A23', majorCase: '#101411', motor: '#2E352D', motorCase: '#101411',
    label: '#575C55', labelStrong: '#8B8F89', halo: '#101411',
    route: '#D4FF5F', routeCase: '#101411', routeDone: '#3A423B', routeGlow: true,
  },
} as const;

export const vectorBackground = (theme: MapTheme) => THEMES[theme].background;

/**
 * Centre + zoom (512-px tiles) for a CityMap camera over a w×h view. Both use Web
 * Mercator, so the basemap and the overlay match exactly: at zoom z the basemap
 * draws 512·2^z px per 360° of longitude, the overlay `cam.s` px per map unit.
 */
export function vectorView(cam: Camera, w: number, h: number) {
  const c = unproject({ x: cam.x + w / 2 / cam.s, y: cam.y + h / 2 / cam.s });
  const zoom = Math.log2((cam.s * unitsPerDegree() * 360) / 512);
  return { lng: c.lng, lat: c.lat, zoom };
}

const MAPLIBRE = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl';
const MAPBOX_GL = 'https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl';
/** Map library (script, css and the global it defines) for the active basemap. */
export const MAP_LIB = USE_MAPBOX ? { js: `${MAPBOX_GL}.js`, css: `${MAPBOX_GL}.css`, global: 'mapboxgl' } : { js: `${MAPLIBRE}.js`, css: `${MAPLIBRE}.css`, global: 'maplibregl' };
export const baseStyleUrl = (theme: MapTheme) =>
  USE_MAPBOX ? `https://api.mapbox.com/styles/v1/mapbox/${theme}-v11?access_token=${MAPBOX_TOKEN}` : 'https://tiles.openfreemap.org/styles/positron';
/** Options both libraries need on top of the camera. */
export const MAP_OPTIONS = { interactive: false, attributionControl: false, fadeDuration: 0, ...(USE_MAPBOX ? { accessToken: MAPBOX_TOKEN, projection: 'mercator' } : {}) };
export const themeColors = (theme: MapTheme) => THEMES[theme];

/**
 * Plain-JS source of `nuva(style, T, mapbox)`, which recolours the base style
 * with NÜVA's palette. Kept as a string so the exact same code runs in the
 * native WebView (Hermes can't serialise functions) and on the web.
 */
export const NUVA_STYLE_JS = `
function nuva(s,T,mapbox){return mapbox?nuvaMapbox(s,T):nuvaOsm(s,T)}
// Mapbox light/dark-v11: keeps street names, places and buildings (useful when placing the pin), in NÜVA's colours.
function nuvaMapbox(s,T){
  s.layers=s.layers.filter(function(l){return !/boundary|aeroway/.test(l.id)});
  s.layers.forEach(function(l){
    var p=l.paint=l.paint||{}, id=l.id;
    if(id==='land')p['background-color']=T.background;
    else if(id==='national-park'||id==='landuse')p['fill-color']=T.park;
    else if(id==='water')p['fill-color']=T.water;
    else if(id==='waterway')p['line-color']=T.water;
    else if(id==='building'){p['fill-color']=T.majorCase;p['fill-opacity']=0.55}
    else if(/case/.test(id)&&l.type==='line')p['line-color']=T.majorCase;
    else if(/^(road|bridge|tunnel)-simple$/.test(id))p['line-color']=T.major;
    if(l.type==='symbol'){
      p['text-color']=/settlement/.test(id)?T.labelStrong:T.label;
      p['text-halo-color']=T.halo;p['text-halo-width']=1.4;
    }
  });
  return s;
}
// OpenFreeMap positron, minimal: no buildings, blocks, woods, paths, rail, borders, shields, icons or street names.
var DROP=/^(building|landuse_residential|landcover_|highway_path|road_pier|road_area_pier|railway|boundary|highway-shield|road_shield|highway-name|label_country|label_state|aeroway|airport|waterway_line_label|water_name)/;
function nuvaOsm(s,T){
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

/** Route handed to the map: [lng, lat] pairs, and whether it is the straight-line placeholder. */
export interface MapRoute {
  coords: [number, number][];
  provisional: boolean;
}

/**
 * Plain-JS source of `nuvaRoute(map, T)`, which draws the route as map layers just
 * below the first label layer. `set(coords, provisional)` swaps the route;
 * `progress(f)` mutes the part already travelled (0..1). Same code on web and native.
 */
export const NUVA_ROUTE_JS = `
function nuvaRoute(map,T){
  var coords=[],cum=[0],prov=false,frac=0,ready=false;
  function line(c){return {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:c.length>1?c:[]}}}
  function split(){
    if(coords.length<2||frac<=0)return {done:[],ahead:coords};
    var total=cum[cum.length-1],target=Math.min(1,frac)*total;
    for(var i=1;i<coords.length;i++){
      if(cum[i]>=target){
        var seg=cum[i]-cum[i-1],k=seg?(target-cum[i-1])/seg:0,a=coords[i-1],b=coords[i];
        var p=[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k];
        return {done:coords.slice(0,i).concat([p]),ahead:[p].concat(coords.slice(i))};
      }
    }
    return {done:coords,ahead:[]};
  }
  function draw(){
    if(!ready)return;
    var s=split();
    map.getSource('nv-done').setData(line(prov?[]:s.done));
    map.getSource('nv-ahead').setData(line(prov?[]:s.ahead));
    map.getSource('nv-prov').setData(line(prov?coords:[]));
  }
  function setup(){
    if(ready)return;
    var before,ls=map.getStyle().layers;
    for(var i=0;i<ls.length;i++){if(ls[i].type==='symbol'){before=ls[i].id;break}}
    ['nv-done','nv-ahead','nv-prov'].forEach(function(id){map.addSource(id,{type:'geojson',data:line([])})});
    var round={'line-join':'round','line-cap':'round'};
    map.addLayer({id:'nv-done',type:'line',source:'nv-done',layout:round,paint:{'line-color':T.routeDone,'line-width':5}},before);
    map.addLayer({id:'nv-ahead-case',type:'line',source:'nv-ahead',layout:round,paint:{'line-color':T.routeCase,'line-width':10}},before);
    if(T.routeGlow)map.addLayer({id:'nv-ahead-glow',type:'line',source:'nv-ahead',layout:round,paint:{'line-color':T.route,'line-opacity':0.22,'line-width':16}},before);
    map.addLayer({id:'nv-ahead',type:'line',source:'nv-ahead',layout:round,paint:{'line-color':T.route,'line-width':5}},before);
    map.addLayer({id:'nv-prov',type:'line',source:'nv-prov',layout:{'line-cap':'round'},paint:{'line-color':T.route,'line-opacity':0.45,'line-width':3,'line-dasharray':[0.7,2.7]}},before);
    ready=true;draw();
  }
  map.on('load',setup);
  return {
    set:function(c,p){
      coords=c||[];prov=!!p;cum=[0];
      for(var i=1;i<coords.length;i++){
        var dx=(coords[i][0]-coords[i-1][0])*Math.cos(coords[i][1]*Math.PI/180),dy=coords[i][1]-coords[i-1][1];
        cum.push(cum[i-1]+Math.sqrt(dx*dx+dy*dy));
      }
      draw();
    },
    progress:function(f){frac=f||0;draw()}
  };
}`;

/** Native: a self-contained page (map library + NÜVA style + route) for the WebView. */
export function vectorMapHtml(theme: MapTheme, initial: { lng: number; lat: number; zoom: number }) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link href="${MAP_LIB.css}" rel="stylesheet">
<script src="${MAP_LIB.js}"></script>
<style>html,body,#m{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:${THEMES[theme].background}}</style>
</head><body><div id="m"></div><script>
${NUVA_STYLE_JS}
${NUVA_ROUTE_JS}
var T=${JSON.stringify(THEMES[theme])};
var map=null, nv=null, route={c:[],p:false}, frac=0, view=${JSON.stringify(initial)};
window.__view=function(lng,lat,zoom){view={lng:lng,lat:lat,zoom:zoom};if(map)map.jumpTo({center:[lng,lat],zoom:zoom});};
window.__route=function(c,p){route={c:c,p:p};if(nv)nv.set(c,p);};
window.__progress=function(f){frac=f;if(nv)nv.progress(f);};
fetch('${baseStyleUrl(theme)}').then(function(r){return r.json()}).then(function(s){
  var o=${JSON.stringify(MAP_OPTIONS)};
  o.container='m';o.style=nuva(s,T,${USE_MAPBOX});o.center=[view.lng,view.lat];o.zoom=view.zoom;
  map=new window.${MAP_LIB.global}.Map(o);
  nv=nuvaRoute(map,T);nv.set(route.c,route.p);nv.progress(frac);
}).catch(function(){});
</script></body></html>`;
}
