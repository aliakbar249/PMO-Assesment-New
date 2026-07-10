import { useState, useCallback, useRef, useEffect } from 'react';
import {
  getPositions, getActivePositions, getHierarchyLevels, getOrgUnits,
  getOrgEmployees, getCurrentPrimaryOccupant, getOccupancies,
  getCustomFieldValues, getCustomFields,
} from '../lib/orgDb';
import { X, ZoomIn, ZoomOut, Maximize2, Eye, EyeOff, Filter } from 'lucide-react';

// ─── Build position tree ──────────────────────────────────────────────────────
function buildPositionTree(positions) {
  const map = {};
  positions.forEach(p => { map[p.id] = { ...p, children: [] }; });
  const roots = [];
  positions.forEach(p => {
    if (p.parentPositionId && map[p.parentPositionId]) {
      map[p.parentPositionId].children.push(map[p.id]);
    } else {
      roots.push(map[p.id]);
    }
  });
  return roots;
}

// ─── Node dimensions ──────────────────────────────────────────────────────────
const NODE_W = 160;
const NODE_H = 80;
const H_GAP  = 28;
const V_GAP  = 60;

// Measure tree widths bottom-up
function measureTree(node) {
  if (!node.children || node.children.length === 0) {
    node._width = NODE_W;
    node._x     = 0;
    return;
  }
  node.children.forEach(measureTree);
  const totalChildW = node.children.reduce((s, c) => s + c._width, 0) + H_GAP * (node.children.length - 1);
  node._width = Math.max(NODE_W, totalChildW);
  // Position children relative to parent
  let x = 0;
  node.children.forEach(c => {
    c._x = x + c._width / 2;
    x += c._width + H_GAP;
  });
}

// Flatten tree into a list of { node, x, y } for rendering
function flattenTree(node, parentX, depth, result, offsetX = 0) {
  const absX = offsetX + (node._x || 0);
  const y    = depth * (NODE_H + V_GAP);
  result.push({ node, x: absX, y, parentX, parentY: depth > 0 ? y - V_GAP + NODE_H : null });
  (node.children || []).forEach(child => {
    flattenTree(child, absX, depth + 1, result, offsetX);
  });
  return result;
}

// ─── Side Panel ───────────────────────────────────────────────────────────────
function SidePanel({ node, levels, units, employees, occupancies, onClose }) {
  const pos     = node;
  const lvl     = levels.find(l => l.id === pos.hierarchyLevelId);
  const unit    = units.find(u => u.id === pos.orgUnitId);
  const occupantId = getCurrentPrimaryOccupant(pos.id);
  const occupant   = occupantId ? employees.find(e => e.id === occupantId) : null;

  // All current occupancies for this position
  const posOccs = occupancies.filter(o => o.positionId === pos.id && !o.effectiveTo);
  const acting   = posOccs.filter(o => o.occupancyType === 'acting');
  const dotted   = posOccs.filter(o => o.occupancyType === 'dotted-line' || o.occupancyType === 'functional');

  return (
    <div className="fixed right-0 top-0 h-full z-30 w-80 bg-white shadow-2xl border-l border-gray-100 flex flex-col">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0" style={{background:'#01A2B1'}}>
        <div>
          <div className="text-white font-semibold text-sm">{pos.title}</div>
          <div className="text-white/70 text-xs font-mono">{pos.positionCode}</div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Occupant */}
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Current Occupant</div>
          {occupant ? (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{background:'#01A2B1'}}>
                {occupant.name[0].toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-gray-800 text-sm">{occupant.name}</div>
                <div className="text-xs text-gray-500">{occupant.email}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-red-400 text-lg">?</span>
              </div>
              <div>
                <div className="font-semibold text-red-600 text-sm">Vacant</div>
                <div className="text-xs text-red-400">No primary occupant</div>
              </div>
            </div>
          )}
        </div>

        {/* Position details */}
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Position Details</div>
          <div className="space-y-2">
            {lvl && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Level</span>
                <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{background: lvl.colorTag || '#6B7280'}}>
                  {lvl.abbreviation} — {lvl.name}
                </span>
              </div>
            )}
            {unit && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Org Unit</span>
                <span className="text-xs text-gray-700 font-medium">{unit.name}</span>
              </div>
            )}
            {pos.division && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Division</span>
                <span className="text-xs text-gray-700 font-medium">{pos.division}</span>
              </div>
            )}
          </div>
        </div>

        {/* Acting occupants */}
        {acting.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Acting</div>
            {acting.map(o => {
              const emp = employees.find(e => e.id === o.employeeId);
              return emp ? (
                <div key={o.id} className="flex items-center gap-2 py-1.5">
                  <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-bold flex-shrink-0">
                    {emp.name[0]}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-700">{emp.name}</div>
                    {o.notes && <div className="text-xs text-gray-400">{o.notes}</div>}
                  </div>
                </div>
              ) : null;
            })}
          </div>
        )}

        {/* Dotted-line */}
        {dotted.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Dotted / Functional</div>
            {dotted.map(o => {
              const emp = employees.find(e => e.id === o.employeeId);
              return emp ? (
                <div key={o.id} className="flex items-center gap-2 py-1.5">
                  <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-xs font-bold flex-shrink-0">
                    {emp.name[0]}
                  </div>
                  <div className="text-xs font-medium text-gray-700">{emp.name}
                    <span className="ml-1 text-gray-400">({o.occupancyType})</span>
                  </div>
                </div>
              ) : null;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Org Chart Node ───────────────────────────────────────────────────────────
function ChartNode({ item, levels, employees, occupancies, onSelect, selected }) {
  const { node, x, y } = item;
  const lvl      = levels.find(l => l.id === node.hierarchyLevelId);
  const occupantId = getCurrentPrimaryOccupant(node.id);
  const occupant   = occupantId ? employees.find(e => e.id === occupantId) : null;
  const isVacant   = !occupant;
  const isSelected = selected?.id === node.id;

  const nodeColor  = lvl?.colorTag || '#6B7280';

  return (
    <g
      transform={`translate(${x - NODE_W / 2}, ${y})`}
      style={{ cursor: 'pointer' }}
      onClick={() => onSelect(isSelected ? null : node)}
    >
      {/* Shadow */}
      <rect x={2} y={2} width={NODE_W} height={NODE_H} rx={10} ry={10}
        fill="rgba(0,0,0,0.06)" />

      {/* Card background */}
      <rect width={NODE_W} height={NODE_H} rx={10} ry={10}
        fill={isVacant ? '#FEF2F2' : 'white'}
        stroke={isSelected ? nodeColor : (isVacant ? '#FCA5A5' : '#E5E7EB')}
        strokeWidth={isSelected ? 2 : 1}
        strokeDasharray={isVacant ? '4 3' : 'none'}
      />

      {/* Level color strip */}
      <rect width={5} height={NODE_H} rx={10} ry={0}
        fill={nodeColor} opacity={isVacant ? 0.4 : 1} />
      <rect x={5} y={0} width={5} height={NODE_H} fill={nodeColor} opacity={isVacant ? 0.4 : 1} />

      {/* Avatar circle */}
      {occupant ? (
        <>
          <circle cx={28} cy={NODE_H / 2} r={14} fill={nodeColor} opacity={0.15} />
          <circle cx={28} cy={NODE_H / 2} r={12} fill={nodeColor} />
          <text x={28} y={NODE_H / 2 + 1} textAnchor="middle" dominantBaseline="middle"
            fontSize="9" fontWeight="700" fill="white" fontFamily="sans-serif">
            {occupant.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </text>
        </>
      ) : (
        <>
          <circle cx={28} cy={NODE_H / 2} r={14} fill="#FEE2E2" />
          <text x={28} y={NODE_H / 2 + 1} textAnchor="middle" dominantBaseline="middle"
            fontSize="12" fill="#EF4444" fontFamily="sans-serif">?</text>
        </>
      )}

      {/* Name */}
      <text x={50} y={NODE_H / 2 - 10} fontSize="9.5" fontWeight="600" fill={isVacant ? '#9CA3AF' : '#1F2937'} fontFamily="sans-serif">
        {occupant ? (occupant.name.length > 16 ? occupant.name.slice(0, 15) + '…' : occupant.name) : 'Vacant'}
      </text>

      {/* Position title */}
      <text x={50} y={NODE_H / 2 + 2} fontSize="8" fill={isVacant ? '#D1D5DB' : '#6B7280'} fontFamily="sans-serif">
        {node.title.length > 19 ? node.title.slice(0, 18) + '…' : node.title}
      </text>

      {/* Position code */}
      <text x={50} y={NODE_H / 2 + 13} fontSize="7.5" fill={isVacant ? '#D1D5DB' : '#9CA3AF'} fontFamily="sans-serif" fontStyle="italic">
        {node.positionCode}
      </text>

      {/* Level badge */}
      {lvl && (
        <>
          <rect x={NODE_W - 32} y={NODE_H / 2 - 8} width={26} height={14} rx={5} fill={nodeColor} opacity={isVacant ? 0.3 : 0.9} />
          <text x={NODE_W - 19} y={NODE_H / 2 + 1} textAnchor="middle" dominantBaseline="middle"
            fontSize="7" fontWeight="700" fill="white" fontFamily="sans-serif">
            {lvl.abbreviation}
          </text>
        </>
      )}
    </g>
  );
}

// ─── Connector Lines ──────────────────────────────────────────────────────────
function ConnectorLines({ items }) {
  return (
    <g>
      {items.map(({ node, x, y, parentX, parentY }, idx) => {
        if (parentY === null) return null;
        const px = parentX;
        const py = parentY + NODE_H; // bottom of parent
        const cy = y;               // top of child
        const midY = (py + cy) / 2;
        return (
          <path key={idx}
            d={`M${px},${py} C${px},${midY} ${x},${midY} ${x},${cy}`}
            fill="none"
            stroke="#D1D5DB"
            strokeWidth="1.5"
          />
        );
      })}
    </g>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OrgChart() {
  const [tick, setTick] = useState(0);

  const positions   = getActivePositions();
  const allPositions = getPositions();
  const levels      = getHierarchyLevels();
  const units       = getOrgUnits();
  const employees   = getOrgEmployees();
  const occupancies = getOccupancies().filter(o => !o.effectiveTo);

  // ── Filters ──
  const [filterLevel,   setFL]    = useState('');
  const [filterUnit,    setFU]    = useState('');
  const [filterDiv,     setFDiv]  = useState('');
  const [showVacant,    setSV]    = useState(true);

  // ── Selection and side panel ──
  const [selected, setSelected] = useState(null);

  // ── Pan / Zoom ──
  const [zoom,      setZoom]  = useState(0.9);
  const [pan,       setPan]   = useState({ x: 40, y: 40 });
  const isPanning = useRef(false);
  const lastPt    = useRef({ x: 0, y: 0 });
  const svgRef    = useRef();

  function handleWheel(e) {
    e.preventDefault();
    setZoom(z => Math.min(2.5, Math.max(0.3, z - e.deltaY * 0.001)));
  }
  function handleMouseDown(e) { isPanning.current = true; lastPt.current = { x: e.clientX, y: e.clientY }; }
  function handleMouseMove(e) {
    if (!isPanning.current) return;
    setPan(p => ({ x: p.x + e.clientX - lastPt.current.x, y: p.y + e.clientY - lastPt.current.y }));
    lastPt.current = { x: e.clientX, y: e.clientY };
  }
  function handleMouseUp() { isPanning.current = false; }

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // ── Build tree data ──
  const DIVISIONS = ['Primary Care', 'Oncology', 'Vaccines', 'CNS', 'Cardiology', 'Respiratory'];
  const vacantIds = new Set(
    positions.filter(p => {
      const occ = occupancies.find(o => o.positionId === p.id && o.occupancyType === 'primary');
      return !occ;
    }).map(p => p.id)
  );

  const visiblePositions = positions.filter(p => {
    if (!showVacant && vacantIds.has(p.id)) return false;
    if (filterLevel && p.hierarchyLevelId !== filterLevel) return false;
    if (filterUnit  && p.orgUnitId !== filterUnit) return false;
    if (filterDiv   && p.division !== filterDiv) return false;
    return true;
  });

  // Build tree from visible positions (include parents even if filtered, for tree structure)
  // Actually, build the full tree then prune for display
  const treeRoots = buildPositionTree(visiblePositions);
  treeRoots.forEach(root => measureTree(root));

  // Flatten
  let allItems = [];
  let offsetX  = 0;
  treeRoots.forEach((root, i) => {
    const items = flattenTree(root, root._width / 2, 0, [], offsetX + root._width / 2);
    allItems = allItems.concat(items);
    offsetX += root._width + H_GAP * 3;
  });

  // SVG canvas size
  const maxX = Math.max(...allItems.map(i => i.x + NODE_W / 2), 600);
  const maxY = Math.max(...allItems.map(i => i.y + NODE_H), 400);

  const vacantCount = vacantIds.size;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Org Chart</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {positions.length} positions · <span className="text-red-500 font-medium">{vacantCount} vacant</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom(z => Math.min(2.5, z + 0.1))}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600">
            <ZoomIn size={16} />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600">
            <ZoomOut size={16} />
          </button>
          <button onClick={() => { setZoom(0.9); setPan({ x: 40, y: 40 }); }}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600">
            <Maximize2 size={16} />
          </button>
          <span className="text-xs text-gray-400 min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 flex-shrink-0">
        <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white" value={filterLevel} onChange={e => setFL(e.target.value)}>
          <option value="">All Levels</option>
          {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white" value={filterUnit} onChange={e => setFU(e.target.value)}>
          <option value="">All Org Units</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white" value={filterDiv} onChange={e => setFDiv(e.target.value)}>
          <option value="">All Divisions</option>
          {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <button onClick={() => setSV(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border transition-colors ${showVacant ? 'border-red-200 text-red-500 bg-red-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
          {showVacant ? <Eye size={14} /> : <EyeOff size={14} />}
          {showVacant ? 'Showing Vacant' : 'Hiding Vacant'}
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 flex-shrink-0">
        {levels.map(l => (
          <div key={l.id} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{background: l.colorTag}} />
            <span className="text-xs text-gray-500">{l.abbreviation}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2">
          <div className="w-3 h-3 rounded-full bg-red-200 border border-red-300 border-dashed" />
          <span className="text-xs text-gray-500">Vacant</span>
        </div>
      </div>

      {/* Chart canvas */}
      <div
        ref={svgRef}
        className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden cursor-grab active:cursor-grabbing relative select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Dot-grid background */}
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
          <defs>
            <pattern id="dots" x={pan.x % (20 * zoom)} y={pan.y % (20 * zoom)} width={20 * zoom} height={20 * zoom} patternUnits="userSpaceOnUse">
              <circle cx={1} cy={1} r={0.8} fill="#E5E7EB" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        {allItems.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Filter size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No positions match your filters.</p>
            </div>
          </div>
        ) : (
          <svg
            width="100%"
            height="100%"
            style={{ pointerEvents: 'none' }}
          >
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`} style={{ pointerEvents: 'all' }}>
              {/* Connector lines */}
              <ConnectorLines items={allItems} />

              {/* Nodes */}
              {allItems.map((item, idx) => (
                <ChartNode
                  key={item.node.id + idx}
                  item={item}
                  levels={levels}
                  employees={employees}
                  occupancies={occupancies}
                  onSelect={setSelected}
                  selected={selected}
                />
              ))}
            </g>
          </svg>
        )}

        {/* Zoom hint */}
        <div className="absolute bottom-3 left-3 text-xs text-gray-400 pointer-events-none">
          Scroll to zoom · Drag to pan · Click node for details
        </div>
      </div>

      {/* Side panel */}
      {selected && (
        <SidePanel
          node={selected}
          levels={levels}
          units={units}
          employees={employees}
          occupancies={occupancies}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
