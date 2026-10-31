import React, { useMemo, useState } from 'react';
import { MapPinned, MapPin, Plus, Minus, RotateCcw, Package, Clock3, TriangleAlert, ChevronRight, Info, ArrowUpRight, Compass, Layers3, X } from 'lucide-react';
import { aggregateShipments } from '../lib/analytics.js';
import colombia from '../data/colombia.json';
import './operations-map.css';

const CENTERS = [
  { key: 'Barranquilla', name: 'Barranquilla', lon: -74.7813, lat: 10.9685, label: [23, -19], width: 117 },
  { key: 'Medellin', name: 'Medellín', lon: -75.5812, lat: 6.2442, label: [-122, -21], width: 99 },
  { key: 'Bogota', name: 'Bogotá', lon: -74.0721, lat: 4.711, label: [23, -12], width: 92 },
  { key: 'Cali', name: 'Cali', lon: -76.532, lat: 3.4516, label: [-106, 1], width: 82 },
];
const format = (value, digits = 0) => value == null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('es-CO', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
const percent = value => value == null ? 'Sin datos' : `${format(value, 1)}%`;
const project = ([lon, lat]) => [340 + (lon + 73) * 29, 295 - (lat - 4.2) * 29];
const rings = colombia.geometry.type === 'Polygon' ? colombia.geometry.coordinates : colombia.geometry.coordinates.flat();
const countryPath = rings.map(ring => ring.map((point, i) => `${i ? 'L' : 'M'}${project(point).map(n => n.toFixed(2)).join(',')}`).join(' ') + ' Z').join(' ');
const toneFor = value => value == null ? 'none' : value < 45 ? 'critical' : value < 60 ? 'review' : 'stable';
const statusFor = value => value == null ? 'Sin registros' : value < 45 ? 'Crítico' : value < 60 ? 'En revisión' : 'Estable';

export default function OperationsMap({ shipments = [], center = 'all', onSelectCenter }) {
  const [zoom, setZoom] = useState(1);
  const [mapMode, setMapMode] = useState('local');
  const [hovered, setHovered] = useState(null);
  const [showLabels, setShowLabels] = useState(true);
  const centers = useMemo(() => CENTERS.map(c => ({ ...c, ...aggregateShipments(shipments.filter(s => s.center === c.key)) })), [shipments]);
  const total = useMemo(() => aggregateShipments(shipments), [shipments]);
  const active = centers.find(c => c.key === (hovered || center)) || [...centers].sort((a, b) => b.count - a.count)[0];
  const located = centers.reduce((sum, c) => sum + c.count, 0);
  const withData = centers.filter(c => c.count > 0).length;
  const claims = shipments.filter(s => s.claim === 1).length;
  const googleCenter = centers.find(c => c.key === center);
  const googleQuery = googleCenter ? `${googleCenter.lat},${googleCenter.lon}` : 'Colombia';
  const googleEmbed = `https://maps.google.com/maps?${new URLSearchParams({q:googleQuery,z:googleCenter?'11':'5',output:'embed',hl:'es'})}`;
  const googleLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${active.lat},${active.lon}`)}`;
  function selectCenter(key) { setHovered(null); onSelectCenter?.(center === key ? 'all' : key); }
  return <div className="operations-map">
    <div className="geo-intro"><span className="geo-eyebrow"><Compass size={14}/> LA OPERACIÓN, EN CONTEXTO</span><span>Selecciona una ciudad para enfocar todos los indicadores del dashboard.</span></div>
    <div className="geo-metrics">
      <div><span className="geo-metric-icon"><MapPinned size={18}/></span><span><small>Centros con envíos</small><strong>{withData}<em>de 4 ubicados</em></strong></span></div>
      <div><span className="geo-metric-icon"><Package size={18}/></span><span><small>Envíos en la selección</small><strong>{format(total.count)}</strong></span></div>
      <div><span className="geo-metric-icon amber"><Clock3 size={18}/></span><span><small>Puntualidad de la muestra</small><strong>{percent(total.onTimeRate)}</strong></span></div>
      <div><span className="geo-metric-icon coral"><TriangleAlert size={18}/></span><span><small>Envíos con reclamo</small><strong>{format(claims)}<em>{percent(total.claimRate)}</em></strong></span></div>
    </div>
    <div className="geo-layout">
      <section className="panel geo-map-panel"><div className="panel-head"><div><h3>Una red que conecta Colombia</h3><p>Ubicación de referencia de nuestros centros de distribución</p></div><div className="geo-map-header-actions"><div className="geo-view-toggle" role="group" aria-label="Tipo de mapa"><button className={mapMode==='local'?'is-active':''} onClick={()=>setMapMode('local')} aria-pressed={mapMode==='local'}>Mapa local</button><button className={mapMode==='google'?'is-active':''} onClick={()=>setMapMode('google')} aria-pressed={mapMode==='google'}>Google Maps<ArrowUpRight size={11}/></button></div></div></div>
        {mapMode === 'google' ? <><div className="geo-google-canvas"><iframe key={googleEmbed} src={googleEmbed} title={`Google Maps · ${googleCenter?.name || 'Colombia'}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen/><a href={googleCenter ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(googleQuery)}` : 'https://www.google.com/maps/search/?api=1&query=Colombia'} target="_blank" rel="noreferrer" className="geo-google-open">Abrir en Google Maps<ArrowUpRight size={13}/></a></div><div className="geo-google-note"><Info size={14}/><span>Mapa externo de referencia. Selecciona un centro para ubicar su ciudad. Requiere internet; si no carga, usa el enlace para abrir Google Maps.</span></div></> : <div className="geo-canvas"><div className="geo-floating-key"><MapPinned size={15}/><span><strong>{withData} centros con datos</strong><small>Según los filtros actuales</small></span></div><div className="geo-map-controls"><button aria-label="Acercar mapa" title="Acercar" disabled={zoom >= 1.75} onClick={() => setZoom(z => Math.min(1.75, +(z + .25).toFixed(2)))}><Plus size={17}/></button><button aria-label="Alejar mapa" title="Alejar" disabled={zoom <= .75} onClick={() => setZoom(z => Math.max(.75, +(z - .25).toFixed(2)))}><Minus size={17}/></button><button aria-label="Restablecer zoom del mapa" title="Vista inicial" onClick={() => setZoom(1)}><RotateCcw size={15}/></button><button className={showLabels ? 'is-active' : ''} aria-label="Mostrar etiquetas de ciudades" title="Mostrar u ocultar etiquetas" aria-pressed={showLabels} onClick={() => setShowLabels(v => !v)}><Layers3 size={16}/></button></div>
          <svg className="geo-country-map" viewBox="0 0 680 580" aria-label="Mapa de Colombia con centros de distribución en Bogotá, Medellín, Cali y Barranquilla">
            <defs><pattern id="geo-grid" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#d9e5db"/></pattern><linearGradient id="geo-land" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#edf3e9"/><stop offset="100%" stopColor="#dce8d8"/></linearGradient><filter id="geo-label-shadow" x="-25%" y="-25%" width="160%" height="180%"><feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#274b32" floodOpacity=".06"/></filter></defs>
            <rect width="680" height="580" fill="url(#geo-grid)"/><text className="geo-ocean" x="325" y="32" textAnchor="middle">MAR CARIBE</text><text className="geo-ocean" transform="translate(112 333) rotate(-90)" textAnchor="middle">OCÉANO PACÍFICO</text>
            <g transform={`translate(340 290) scale(${zoom}) translate(-340 -290)`} className="geo-zoom-layer"><path d={countryPath} fill="url(#geo-land)" stroke="#a9bfa5" strokeWidth="1.6" strokeLinejoin="round" fillRule="evenodd"/><text className="geo-country-name" x="400" y="397" textAnchor="middle">COLOMBIA</text>
            {centers.map(c => { const [x, y] = project([c.lon, c.lat]); const tone = toneFor(c.onTimeRate); const selected = center === c.key; return <g key={c.key} transform={`translate(${x} ${y})`} className={`geo-city-marker ${tone} ${selected ? 'is-selected' : ''} ${center !== 'all' && !selected ? 'is-muted' : ''}`} role="button" tabIndex="0" aria-label={`${c.name}: ${format(c.count)} envíos, puntualidad ${percent(c.onTimeRate)}. ${selected ? 'Mostrar todos los centros' : 'Filtrar por este centro'}.`} aria-pressed={selected} onClick={() => selectCenter(c.key)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCenter(c.key); } }} onMouseEnter={() => setHovered(c.key)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(c.key)} onBlur={() => setHovered(null)}><title>{c.name} · {format(c.count)} envíos · {percent(c.onTimeRate)} de puntualidad</title><circle className="geo-pin-halo" r={selected ? 23 : 19}/><circle className="geo-pin-ring" r={selected ? 12 : 10}/><circle className="geo-pin-core" r="3"/>{showLabels && <g transform={`translate(${c.label[0]} ${c.label[1]})`} className="geo-city-label"><rect width={c.width} height="41" rx="6" filter="url(#geo-label-shadow)"/><text x="10" y="16" className="geo-city-name">{c.name}</text><text x="10" y="30" className="geo-city-rate">{c.count ? `${percent(c.onTimeRate)} a tiempo` : 'Sin registros'}</text></g>}</g>; })}</g>
            <g className="geo-compass" transform="translate(620 505)"><path d="M0 0 L-5 15 L0 12 L5 15Z" fill="#8da183"/><text x="0" y="-8" textAnchor="middle">N</text></g>
          </svg>
          <div className="geo-map-bottom"><span><i/>Posiciones por ciudad, no por dirección</span><span>{format(zoom * 100)}%</span></div>
        </div>}<div className="geo-legend"><span className="geo-legend-title">Puntualidad</span><span><i className="critical"/>Crítico &lt;45%</span><span><i className="review"/>En revisión &lt;60%</span><span><i className="stable"/>Estable ≥60%</span><span><i className="none"/>Sin registros</span></div>
      </section>
      <aside className="geo-side">
        <section className="panel geo-centers-panel"><div className="panel-head"><div><h3>Elige tu centro</h3><p>El mapa responde a los filtros activos</p></div><MapPin size={17}/></div><div className="geo-center-list">{centers.map(c => <button key={c.key} className={`geo-center-row ${center === c.key ? 'is-selected' : ''}`} onClick={() => selectCenter(c.key)} aria-pressed={center === c.key}><span className={`geo-center-dot ${toneFor(c.onTimeRate)}`}><MapPin size={15}/></span><span><strong>{c.name}</strong><small>{format(c.count)} envíos en la selección</small></span><span className="geo-center-rate">{percent(c.onTimeRate)}<ChevronRight size={13}/></span></button>)}</div>{center !== 'all' && <button className="geo-clear" onClick={() => { setHovered(null); onSelectCenter?.('all'); }}><X size={13}/>Mostrar todos los centros</button>}</section>
        <section className="geo-detail-card"><div className="geo-detail-head"><span><MapPinned size={15}/>EN EL FOCO</span><span className={`geo-detail-status ${toneFor(active.onTimeRate)}`}>{statusFor(active.onTimeRate)}</span></div><h3>{active.name}</h3><p>{center === active.key ? 'Centro seleccionado en los filtros' : 'Detalle del centro en la muestra actual'}</p><div className="geo-detail-figure"><strong>{percent(active.onTimeRate)}</strong><span>entregas a tiempo</span></div><div className="geo-detail-progress"><i style={{width:`${Math.max(0, Math.min(100, active.onTimeRate || 0))}%`}}/></div><div className="geo-detail-stats"><div><span>Reclamos</span><strong>{percent(active.claimRate)}</strong></div><div><span>Devoluciones</span><strong>{percent(active.returnRate)}</strong></div><div><span>Costo medio · COP</span><strong>{active.averageCost == null ? '—' : `$${format(active.averageCost)}`}</strong></div></div><button onClick={() => selectCenter(active.key)}>{center === active.key ? 'Quitar filtro del centro' : 'Enfocar este centro'}<ArrowUpRight size={15}/></button><a className="geo-external-link" href={googleLink} target="_blank" rel="noreferrer"><MapPin size={13}/>Abrir {active.name} en Google Maps<ArrowUpRight size={12}/></a></section>
      </aside>
    </div>
    <div className="geo-note"><Info size={15}/><p>Las ubicaciones son referencias de las ciudades. El archivo no contiene coordenadas de envíos, direcciones de los centros ni recorridos GPS; por eso no se dibujan rutas. {total.count > located && `${format(total.count - located)} envíos pertenecen a centros sin ubicación de referencia. `}Los estados son umbrales orientativos del dashboard.</p></div>
    <div className="geo-attribution"><span>Geometría de Colombia: <a href={colombia.sourceUrl} target="_blank" rel="noreferrer">Natural Earth · Dominio público <ArrowUpRight size={10}/></a></span><span>Vista local sin conexión · Google Maps se carga solo al seleccionarlo</span></div>
  </div>;
}
