import React, { useMemo, useState } from 'react';
import { SlidersHorizontal, RotateCcw, Save, ArrowUpRight, ArrowRight, Info, Route, PackageCheck, GraduationCap, Wallet, Check, FolderOpen } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import './simulator.css';

const EMPTY = { routes: 0, load: 0, mentoring: 0, collection: 0 };
const KEY = 'orbita-express-scenario-v1';
const format = (v, digits = 1) => v == null || !Number.isFinite(v) ? 'Sin datos' : new Intl.NumberFormat('es-CO', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);
const percentage = (v) => v == null ? 'Sin datos' : `${format(v)} %`;
function readSaved() { try { const item = JSON.parse(localStorage.getItem(KEY)); if (!item?.values || !Number.isFinite(Date.parse(item.savedAt))) return null; const values = Object.fromEntries(Object.keys(EMPTY).map(key => [key, Math.max(0, Math.min(100, Number(item.values[key]) || 0))])); return { values, savedAt: item.savedAt }; } catch { return null; } }
function ratio(rows, field, predicate) { const valid = rows.filter(r => r[field] != null && Number.isFinite(Number(r[field]))); return valid.length ? valid.filter(r => predicate(Number(r[field]))).length / valid.length : null; }

export default function Simulator({ shipments = [], finance = {} }) {
  const [values, setValues] = useState(EMPTY);
  const [saved, setSaved] = useState(readSaved);
  const [message, setMessage] = useState('');
  const model = useMemo(() => {
    const punctuality = ratio(shipments, 'onTime', v => v === 1);
    const claims = ratio(shipments, 'claim', v => v === 1);
    const routeExposure = ratio(shipments, 'routeChanges', v => v > 0);
    const loadExposure = ratio(shipments, 'load', v => v > 80);
    const newExposure = ratio(shipments, 'tenure', v => v <= 12);
    const available = !((values.routes > 0 && routeExposure == null) || (values.load > 0 && loadExposure == null) || (values.mentoring > 0 && newExposure == null));
    const gain = available ? routeExposure * values.routes / 100 * 12 + loadExposure * values.load / 100 * 8 + newExposure * values.mentoring / 100 * 6 : null;
    const projected = punctuality == null || gain == null ? null : Math.min(100, punctuality * 100 + gain);
    const projectedClaims = claims == null || !available ? null : Math.max(0, claims * 100 - routeExposure * values.routes / 100 * 4 - loadExposure * values.load / 100 * 3 - newExposure * values.mentoring / 100 * 2);
    const released = finance.overdue == null ? null : finance.overdue * values.collection / 100;
    const penaltyReduction = gain == null ? null : punctuality == null || punctuality === 1 ? 0 : Math.min(1, gain / (100 - punctuality * 100));
    return { baseline: punctuality == null ? null : punctuality * 100, claims: claims == null ? null : claims * 100, projected, projectedClaims, gain, released, cash: finance.cash == null || released == null ? null : finance.cash + released, overdue: finance.overdue == null || released == null ? null : finance.overdue - released, penalties: finance.penalties == null || penaltyReduction == null ? null : finance.penalties * (1 - penaltyReduction), routeExposure, loadExposure, newExposure };
  }, [shipments, finance, values]);
  const chart = [{ name: 'Puntualidad', 'Dato base': model.baseline, 'Escenario': model.projected }, { name: 'Reclamos', 'Dato base': model.claims, 'Escenario': model.projectedClaims }];
  const controls = [
    { key: 'routes', name: 'Menos cambios de ruta', desc: 'Reducción sobre las rutas con cambios', icon: Route },
    { key: 'load', name: 'Equilibrio de carga', desc: 'Reducción de rutas con más de 80 paquetes', icon: PackageCheck },
    { key: 'mentoring', name: 'Acompañamiento a nuevos', desc: 'Cobertura de conductores con hasta 12 meses', icon: GraduationCap },
    { key: 'collection', name: 'Recuperación de cartera', desc: 'Porcentaje del saldo vencido que se recuperaría', icon: Wallet },
  ];
  function save() { const scenario = { values, savedAt: new Date().toISOString() }; try { localStorage.setItem(KEY, JSON.stringify(scenario)); setSaved(scenario); setMessage('Escenario guardado en este navegador.'); } catch { setMessage('No se pudo guardar: el almacenamiento local no está disponible.'); } }
  function restore() { if (saved?.values) { setValues({ ...EMPTY, ...saved.values }); setMessage('Escenario guardado cargado.'); } }
  return <div className="simulator page-section">
    <div className="sim-intro"><span className="badge"><SlidersHorizontal size={13}/> Laboratorio de decisiones</span><p>Explora cómo podrían cambiar los resultados al ajustar la operación. Tus escenarios no modifican los datos del archivo.</p></div>
    <div className="sim-layout">
      <section className="panel sim-controls"><div className="panel-head"><div><h3>Construye tu escenario</h3><p className="muted">Ajusta una o varias palancas de mejora</p></div><button className="sim-icon-btn" title="Restablecer controles" aria-label="Restablecer controles" onClick={() => { setValues(EMPTY); setMessage('Controles restablecidos.'); }}><RotateCcw size={17}/></button></div>
        {controls.map(({ key, name, desc, icon: Icon }) => <div className="sim-control" key={key}><div className="sim-control-label"><div className="sim-control-icon"><Icon size={18}/></div><label htmlFor={`sim-${key}`}>{name}</label><output htmlFor={`sim-${key}`}>{values[key]}<small>%</small></output></div><p>{desc}</p><input id={`sim-${key}`} type="range" min="0" max="100" step="5" value={values[key]} onChange={e => { setValues(v => ({ ...v, [key]: Number(e.target.value) })); setMessage(''); }} style={{ '--range-progress': `${values[key]}%` }}/><div className="sim-range-labels"><span>Sin cambio</span><span>100 %</span></div></div>)}
        <div className="sim-save-row"><button className="btn primary" onClick={save}><Save size={16}/> Guardar escenario</button>{saved && <button className="btn" onClick={restore} title="Cargar el escenario guardado en este navegador"><FolderOpen size={16}/> Cargar</button>}</div><div className="sim-message" role="status">{message || (saved ? `Último guardado: ${new Date(saved.savedAt).toLocaleDateString('es-CO')}` : 'Se guarda únicamente en este navegador.')}</div>
      </section>
      <div className="sim-results"><div className="sim-result-grid"><div className="sim-result-card"><span>Puntualidad proyectada</span><strong>{percentage(model.projected)}</strong><div><ArrowUpRight size={15}/>{format(model.gain)} puntos potenciales</div><small>Dato base: {percentage(model.baseline)}</small></div><div className="sim-result-card pale"><span>Caja que se liberaría</span><strong>{format(model.released)} <em>MM COP</em></strong><div><Wallet size={15}/>Recuperación de cartera vencida</div><small>Sobre {format(finance.overdue)} MM COP al cierre</small></div></div>
        <section className="panel sim-comparison"><div className="panel-head"><div><h3>Del dato a la posibilidad</h3><p className="muted">Resultados base y escenario · porcentaje</p></div><span className="badge">Proyección</span></div>{model.baseline == null ? <div className="sim-empty">No hay envíos en la selección. Ajusta los filtros para simular.</div> : <div className="sim-chart"><ResponsiveContainer width="100%" height={235}><BarChart data={chart} barGap={8} margin={{top: 15, right: 20, left: -15, bottom: 0}}><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e9eeec"/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#75827e',fontSize:12}}/><YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill:'#8b9693',fontSize:11}} unit="%"/><Tooltip formatter={v => percentage(v)} contentStyle={{border:'1px solid #e5ece8',borderRadius:12,fontSize:12}}/><Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:11,paddingTop:12}}/><Bar dataKey="Dato base" fill="#d5e1dc" radius={[5,5,0,0]} maxBarSize={45}/><Bar dataKey="Escenario" fill="#23796b" radius={[5,5,0,0]} maxBarSize={45}/></BarChart></ResponsiveContainer></div>}
          <div className="sim-financial-row"><div><span>Cartera proyectada</span><strong>{format(model.overdue)} <small>MM</small></strong></div><ArrowRight size={18}/><div><span>Efectivo proyectado</span><strong>{format(model.cash)} <small>MM</small></strong></div><div><span>Penalizaciones estimadas</span><strong>{format(model.penalties)} <small>MM</small></strong></div></div>
        </section>
      </div>
    </div>
    <details className="panel sim-assumptions"><summary><Info size={16}/> Cómo se calcula el escenario <span>Supuestos del modelo</span></summary><div><p>Es un ejercicio exploratorio con coeficientes heurísticos, sin validación causal ni predicción estadística. No equivale a un resultado garantizado.</p><ul><li>Puntualidad base = entregas a tiempo / envíos con indicador disponible. La mejora máxima supuesta es 12 puntos por cambios de ruta, 8 por sobrecarga y 6 por acompañamiento, ponderados por la exposición observada y cada control. El resultado se limita a 100 %.</li><li>Reclamos: reducción máxima supuesta de 4, 3 y 2 puntos con las mismas ponderaciones. El resultado no puede ser negativo.</li><li>Caja liberada = cartera vencida al cierre × recuperación seleccionada. Se transfiere de cartera a efectivo; no se reconoce como ingreso adicional.</li><li>Penalizaciones: se reducen proporcionalmente a la reducción estimada de incumplimiento. No se incluyen inversiones, costos adicionales ni efectos tributarios.</li></ul><p>Exposición en la selección: cambios de ruta {percentage(model.routeExposure == null ? null : model.routeExposure * 100)} · sobrecarga {percentage(model.loadExposure == null ? null : model.loadExposure * 100)} · conductores nuevos {percentage(model.newExposure == null ? null : model.newExposure * 100)}. Las cifras financieras corresponden al periodo seleccionado, sin desglose por centro o cliente.</p></div></details>
  </div>;
}
