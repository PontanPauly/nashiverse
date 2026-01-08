import React, { useMemo, useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function FamilyConstellation({ people, households, relationships }) {
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [hoveredPersonId, setHoveredPersonId] = useState(null);
  const [selectedConstellationId, setSelectedConstellationId] = useState('all');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Hash function for deterministic randomness
  const hash = (input) => {
    if (!input) return 0;
    let h = 0;
    for (let i = 0; i < input.length; i++) {
      h = (h * 31 + input.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  };

  // Group people into ancestors and living by household
  const { ancestors, livingByHousehold, householdsList } = useMemo(() => {
    const ancestors = people.filter(p => p.is_deceased || p.role_type === 'ancestor');
    const living = people.filter(p => !p.is_deceased && p.role_type !== 'ancestor');
    
    const byHousehold = new Map();
    living.forEach(p => {
      const key = p.household_id || '__no_household__';
      if (!byHousehold.has(key)) byHousehold.set(key, []);
      byHousehold.get(key).push(p);
    });

    const householdsList = Array.from(byHousehold.keys()).sort();
    
    return { ancestors, livingByHousehold: byHousehold, householdsList };
  }, [people]);

  // Position ancestors on inner ring around center
  const getAncestorPosition = (person) => {
    const index = ancestors.findIndex(a => a.id === person.id);
    const total = Math.max(ancestors.length, 1);
    const angle = (index / total) * Math.PI * 2;

    const radiusBase = 22;
    const h = hash(person.id);
    const radiusJitter = ((h % 6) - 3) * 0.5;
    const radius = radiusBase + radiusJitter;

    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);

    return { x, y };
  };

  // Position household cluster center on outer ring
  const getHouseholdClusterCenter = (householdId) => {
    const idx = householdsList.indexOf(householdId);
    const total = Math.max(householdsList.length, 1);
    const angle = (idx / total) * Math.PI * 2;

    const radius = 40;
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);

    return { x, y };
  };

  // Position person within their household cluster
  const getHouseholdMemberPosition = (person) => {
    const householdId = person.household_id || '__no_household__';
    const members = livingByHousehold.get(householdId) || [person];
    const memberIndex = members.findIndex(m => m.id === person.id);
    const total = Math.max(members.length, 1);

    const center = getHouseholdClusterCenter(householdId);

    const baseAngle = (memberIndex / total) * Math.PI * 2;
    const h = hash(person.id);
    const angleJitter = ((h % 20) - 10) * (Math.PI / 180);
    const angle = baseAngle + angleJitter;

    const baseOrbit = 7;
    const orbitJitter = (h % 5) * 0.6;
    const orbitRadius = baseOrbit + orbitJitter;

    const x = center.x + orbitRadius * Math.cos(angle);
    const y = center.y + orbitRadius * Math.sin(angle);

    return { x, y };
  };

  // Get position for any person
  const getStarPosition = (person) => {
    if (person.is_deceased || person.role_type === 'ancestor') {
      return getAncestorPosition(person);
    }
    return getHouseholdMemberPosition(person);
  };

  // Get visual properties for star
  const getStarVisuals = (person) => {
    const isAncestor = person.is_deceased || person.role_type === 'ancestor';
    const isChild = person.role_type === 'child';
    const isTeen = person.role_type === 'teen';

    const h = hash(person.id);
    const blur = 0.6 + (h % 6) * 0.1;

    let size = 18;
    if (isChild) size = 14;
    else if (isTeen) size = 16;
    else if (isAncestor) size = 20;

    const baseColor = isAncestor ? '#FBBF77' : '#60A5FA';
    const glowColor = isAncestor ? '#FDBA74' : '#93C5FD';

    return { size, blur, baseColor, glowColor };
  };

  // Check if person is in active constellation
  const isInActiveConstellation = (person) => {
    if (!selectedConstellationId || selectedConstellationId === 'all') return true;
    if (selectedConstellationId === 'ancestors') {
      return !!(person.is_deceased || person.role_type === 'ancestor');
    }
    return person.household_id === selectedConstellationId;
  };

  // Detect couples (co-parents) for barycenter approach
  const couples = useMemo(() => {
    if (!relationships || !people) return [];
    
    const coParentMap = new Map(); // key: sorted parent IDs, value: [parent1, parent2, children]
    
    const parentRels = relationships.filter(r => r.relationship_type === 'parent');
    
    // Group children by their parents
    const childToParents = new Map();
    parentRels.forEach(rel => {
      const child = rel.related_person_id;
      if (!childToParents.has(child)) {
        childToParents.set(child, []);
      }
      childToParents.get(child).push(rel.person_id);
    });
    
    // Find parent pairs that share children
    childToParents.forEach((parents, child) => {
      if (parents.length === 2) {
        const key = [...parents].sort().join('-');
        if (!coParentMap.has(key)) {
          coParentMap.set(key, {
            parent1: people.find(p => p.id === parents[0]),
            parent2: people.find(p => p.id === parents[1]),
            children: []
          });
        }
        coParentMap.get(key).children.push(child);
      }
    });
    
    return Array.from(coParentMap.values()).filter(c => c.parent1 && c.parent2);
  }, [relationships, people]);

  // Get constellation lines for active selection
  const constellationLines = useMemo(() => {
    const lines = [];

    // For "all" view, use barycenter approach for couples
    if (!selectedConstellationId || selectedConstellationId === 'all') {
      if (relationships && relationships.length > 0) {
        const processedChildren = new Set();
        
        // Draw couple systems with barycenters
        couples.forEach((couple, idx) => {
          const p1Pos = getStarPosition(couple.parent1);
          const p2Pos = getStarPosition(couple.parent2);
          
          // Barycenter between parents - offset perpendicular to couple axis
          const dx = p2Pos.x - p1Pos.x;
          const dy = p2Pos.y - p1Pos.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const perpX = -dy / len;
          const perpY = dx / len;
          
          const hubX = (p1Pos.x + p2Pos.x) / 2 + perpX * 0.8;
          const hubY = (p1Pos.y + p2Pos.y) / 2 + perpY * 0.8;
          
          // Binary link between parents (gentle arc)
          lines.push({
            id: `couple-${couple.parent1.id}-${couple.parent2.id}`,
            type: 'couple',
            x1: p1Pos.x,
            y1: p1Pos.y,
            x2: p2Pos.x,
            y2: p2Pos.y,
            hubX,
            hubY,
          });
          
          // Parent to hub
          lines.push({
            id: `p1-hub-${couple.parent1.id}`,
            type: 'parent-hub',
            x1: p1Pos.x,
            y1: p1Pos.y,
            x2: hubX,
            y2: hubY,
          });
          
          lines.push({
            id: `p2-hub-${couple.parent2.id}`,
            type: 'parent-hub',
            x1: p2Pos.x,
            y1: p2Pos.y,
            x2: hubX,
            y2: hubY,
          });
          
          // Hub to children - fan out to avoid overlapping lines
          const fanTotal = couple.children.length;
          couple.children.forEach((childId, j) => {
            const child = people.find(p => p.id === childId);
            if (child) {
              const childPos = getStarPosition(child);
              
              // Spread start points around the hub
              const t = j - (fanTotal - 1) / 2;
              const spread = 0.9;
              const fromX = hubX + perpX * t * spread;
              const fromY = hubY + perpY * t * spread;
              
              lines.push({
                id: `hub-child-${childId}`,
                type: 'hub-child',
                x1: fromX,
                y1: fromY,
                x2: childPos.x,
                y2: childPos.y,
                fanT: t,
              });
              processedChildren.add(childId);
            }
          });
        });
        
        // Draw remaining parent-child lines for single parents
        const parentRels = relationships.filter(r => r.relationship_type === 'parent');
        parentRels.forEach(rel => {
          if (processedChildren.has(rel.related_person_id)) return;
          
          const parent = people.find(p => p.id === rel.person_id);
          const child = people.find(p => p.id === rel.related_person_id);
          
          if (parent && child) {
            const pPos = getStarPosition(parent);
            const cPos = getStarPosition(child);
            lines.push({
              id: `single-${rel.person_id}-${rel.related_person_id}`,
              type: 'parent-child',
              x1: pPos.x,
              y1: pPos.y,
              x2: cPos.x,
              y2: cPos.y,
            });
          }
        });
      }
      return lines;
    }

    // For specific constellation views
    let members = [];
    if (selectedConstellationId === 'ancestors') {
      members = ancestors;
    } else {
      members = people.filter(
        p => !p.is_deceased && p.role_type !== 'ancestor' && p.household_id === selectedConstellationId
      );
    }

    if (members.length < 2) return lines;

    const sorted = [...members].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    for (let i = 0; i < sorted.length - 1; i++) {
      const start = getStarPosition(sorted[i]);
      const end = getStarPosition(sorted[i + 1]);
      lines.push({
        id: `${sorted[i].id}-${sorted[i + 1].id}`,
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
      });
    }

    return lines;
  }, [selectedConstellationId, ancestors, people, relationships]);

  const selectedPerson = useMemo(
    () => people.find(p => p.id === selectedPersonId) || null,
    [people, selectedPersonId]
  );

  // Get visible people for fit calculation
  const getVisiblePeople = () => {
    if (selectedConstellationId === 'ancestors') {
      return people.filter(p => p.is_deceased || p.role_type === 'ancestor');
    }
    if (selectedConstellationId && selectedConstellationId !== 'all') {
      return people.filter(p => p.household_id === selectedConstellationId);
    }
    return people;
  };

  // Fit universe to screen
  const fitToUniverse = (targetPeople = getVisiblePeople()) => {
    const el = containerRef.current;
    if (!el || !targetPeople?.length) return;

    const rect = el.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // Convert % positions to px
    const pts = targetPeople.map(p => {
      const pos = getStarPosition(p);
      return { x: (pos.x / 100) * w, y: (pos.y / 100) * h };
    });

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    const padding = 100;
    const boxW = Math.max(1, (maxX - minX) + padding * 2);
    const boxH = Math.max(1, (maxY - minY) + padding * 2);

    const rawZoom = Math.min(w / boxW, h / boxH);
    const newZoom = Math.min(Math.max(rawZoom, 0.5), 3);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const desiredShiftX = (w / 2) - centerX;
    const desiredShiftY = (h / 2) - centerY;

    setZoom(newZoom);
    setPan({ x: desiredShiftX / newZoom, y: desiredShiftY / newZoom });
  };

  // Auto-fit on load (only once)
  useEffect(() => {
    if (people && people.length > 0) {
      const t = setTimeout(() => fitToUniverse(people), 200);
      return () => clearTimeout(t);
    }
  }, [people?.length]);

  // Check if person is part of a couple
  const isInCouple = (personId) => {
    return couples.some(c => c.parent1.id === personId || c.parent2.id === personId);
  };

  // Get couple partner ID
  const getCouplePartnerId = (personId) => {
    const couple = couples.find(c => c.parent1.id === personId || c.parent2.id === personId);
    if (!couple) return null;
    return couple.parent1.id === personId ? couple.parent2.id : couple.parent1.id;
  };

  const householdOptions = useMemo(() => {
    return households
      .filter(h => livingByHousehold.has(h.id))
      .map(h => ({
        id: h.id,
        label: h.name,
      }));
  }, [households, livingByHousehold]);

  if (!people || people.length === 0) {
    return (
      <div className="relative w-full h-[600px] rounded-2xl bg-gradient-to-b from-[#050716] via-[#050816] to-[#03040d] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 text-lg mb-2">No family members yet</p>
          <p className="text-slate-500 text-sm">Add people to see your constellation</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      {/* Deep Space Background */}
      <div className="absolute inset-0">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#000000] via-[#020206] to-[#030308]" />

        {/* Distant stars field - multiple layers */}
        <div className="absolute inset-0 opacity-60">
          <div 
            className="absolute inset-0" 
            style={{
              backgroundImage: `
                radial-gradient(1px 1px at 20% 10%, white, transparent),
                radial-gradient(1px 1px at 80% 20%, white, transparent),
                radial-gradient(0.5px 0.5px at 40% 30%, white, transparent),
                radial-gradient(1px 1px at 60% 40%, white, transparent),
                radial-gradient(0.5px 0.5px at 15% 50%, white, transparent),
                radial-gradient(1px 1px at 85% 60%, white, transparent),
                radial-gradient(0.5px 0.5px at 45% 70%, white, transparent),
                radial-gradient(1px 1px at 25% 80%, white, transparent),
                radial-gradient(0.5px 0.5px at 75% 90%, white, transparent),
                radial-gradient(1px 1px at 10% 95%, white, transparent),
                radial-gradient(0.5px 0.5px at 50% 15%, white, transparent),
                radial-gradient(1px 1px at 90% 35%, white, transparent),
                radial-gradient(0.5px 0.5px at 35% 55%, white, transparent),
                radial-gradient(1px 1px at 65% 75%, white, transparent),
                radial-gradient(0.5px 0.5px at 55% 85%, white, transparent)
              `,
              backgroundSize: '200% 200%, 220% 220%, 180% 180%, 250% 250%, 190% 190%, 210% 210%, 170% 170%, 240% 240%, 200% 200%, 230% 230%, 185% 185%, 195% 195%, 215% 215%, 205% 205%, 225% 225%',
              backgroundPosition: 'center',
            }}
          />
        </div>

        {/* Nebula clouds - more dramatic */}
        <div className="absolute inset-0 opacity-25">
          {/* Purple nebula */}
          <div 
            className="absolute w-[800px] h-[800px] rounded-full"
            style={{
              top: '10%',
              left: '15%',
              background: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.4) 0%, rgba(139, 92, 246, 0.2) 30%, transparent 70%)',
              filter: 'blur(100px)',
            }}
          />
          {/* Blue nebula */}
          <div 
            className="absolute w-[700px] h-[700px] rounded-full"
            style={{
              bottom: '15%',
              right: '20%',
              background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.35) 0%, rgba(59, 130, 246, 0.15) 35%, transparent 70%)',
              filter: 'blur(120px)',
            }}
          />
          {/* Gold nebula */}
          <div 
            className="absolute w-[600px] h-[600px] rounded-full"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(ellipse at center, rgba(251, 191, 36, 0.2) 0%, rgba(251, 191, 36, 0.1) 40%, transparent 70%)',
              filter: 'blur(90px)',
            }}
          />
          {/* Pink nebula */}
          <div 
            className="absolute w-[500px] h-[500px] rounded-full"
            style={{
              top: '30%',
              right: '10%',
              background: 'radial-gradient(ellipse at center, rgba(236, 72, 153, 0.25) 0%, rgba(236, 72, 153, 0.12) 35%, transparent 65%)',
              filter: 'blur(85px)',
            }}
          />
        </div>

        {/* Cosmic dust overlay */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.1) 0%, transparent 50%),
              radial-gradient(ellipse at 70% 80%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(251, 191, 36, 0.06) 0%, transparent 50%)
            `,
          }}
        />
      </div>

      {/* Floating Controls */}
      <div className="absolute top-20 right-4 z-50 glass-card rounded-xl px-4 py-3 border border-slate-700/50 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-medium">Focus:</span>
          <select
            className="rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs text-slate-200 shadow-sm focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 backdrop-blur-md"
            value={selectedConstellationId}
            onChange={(e) => setSelectedConstellationId(e.target.value)}
          >
            <option value="all">Whole Universe</option>
            {ancestors.length > 0 && <option value="ancestors">Ancestors</option>}
            {householdOptions.map(h => (
              <option key={h.id} value={h.id}>
                {h.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => fitToUniverse()}
            className="px-3 py-1.5 rounded-lg text-xs border border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800/70 transition-colors"
          >
            Fit View
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="px-3 py-1.5 rounded-lg text-xs border border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800/70 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Universe canvas */}
      <div 
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onWheel={(e) => {
          e.preventDefault();
          const delta = e.deltaY * -0.001;
          const newZoom = Math.min(Math.max(0.5, zoom + delta), 3);
          setZoom(newZoom);
        }}
        onMouseDown={(e) => {
          setIsDragging(true);
          setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        }}
        onMouseMove={(e) => {
          if (isDragging) {
            setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
          }
        }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
      >

        {/* Constellation lines */}
        <svg 
          className="pointer-events-none absolute inset-0 h-full w-full z-10"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        >
          {constellationLines.map((line, index) => {
            const isWhole = selectedConstellationId === 'all';
            const shouldAnimate = !isWhole;
            
            const baseStyle = shouldAnimate ? {
              strokeDasharray: '1000',
              strokeDashoffset: '1000',
              animation: `drawLine 0.6s ease forwards ${index * 0.04}s`,
            } : {};

            if (line.type === 'couple') {
              // Gentle arc between couple
              const midX = (line.x1 + line.x2) / 2;
              const midY = (line.y1 + line.y2) / 2;
              const dx = line.x2 - line.x1;
              const dy = line.y2 - line.y1;
              const controlX = midX - dy * 0.1;
              const controlY = midY + dx * 0.1;

              return (
                <path
                  key={line.id}
                  d={`M ${line.x1} ${line.y1} Q ${controlX} ${controlY} ${line.x2} ${line.y2}`}
                  stroke="rgba(251,191,36,0.22)"
                  strokeWidth="0.65"
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    filter: isWhole ? 'none' : 'drop-shadow(0 0 3px rgba(251,191,36,0.25))',
                    ...baseStyle,
                  }}
                />
              );
            } else if (line.type === 'parent-hub' || line.type === 'hub-child') {
              // Curved path through hub with fan variation
              const midX = (line.x1 + line.x2) / 2;
              const midY = (line.y1 + line.y2) / 2;
              const dx = line.x2 - line.x1;
              const dy = line.y2 - line.y1;
              
              // Vary control point based on fan position
              const fanOffset = (line.fanT || 0) * 0.5;
              const controlX = midX + dy * (0.15 + fanOffset);
              const controlY = midY - dx * (0.15 + fanOffset);

              return (
                <path
                  key={line.id}
                  d={`M ${line.x1} ${line.y1} Q ${controlX} ${controlY} ${line.x2} ${line.y2}`}
                  stroke="rgba(251,191,36,0.16)"
                  strokeWidth="0.45"
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    filter: isWhole ? 'none' : 'drop-shadow(0 0 2px rgba(251,191,36,0.20))',
                    ...baseStyle,
                  }}
                />
              );
            } else {
              // Regular lines for other connections
              return (
                <line
                  key={line.id}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke="rgba(251,191,36,0.12)"
                  strokeWidth="0.4"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  style={{
                    filter: isWhole ? 'none' : 'drop-shadow(0 0 2px rgba(251,191,36,0.18))',
                    ...baseStyle,
                  }}
                />
              );
            }
          })}
        </svg>

        {/* Family stars */}
        <div 
          className="absolute inset-0 z-20"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        >
        {people.map(person => {
          const { x, y } = getStarPosition(person);
          const { size, blur, baseColor, glowColor } = getStarVisuals(person);

          const isSelected = selectedPersonId === person.id;
          const isHovered = hoveredPersonId === person.id;
          const inConstellation = isInActiveConstellation(person);
          const dimOthers = !!selectedConstellationId && selectedConstellationId !== 'all';
          const dimmed = dimOthers && !inConstellation;

          let finalSize = size;
          if (isSelected) finalSize *= 1.25;
          else if (isHovered) finalSize *= 1.1;

          const householdName = person.household_id 
            ? households.find(h => h.id === person.household_id)?.name 
            : null;

          return (
            <div
              key={person.id}
              className="group absolute cursor-pointer transition-all duration-300"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: isSelected ? 30 : isHovered ? 20 : 10,
              }}
              onMouseEnter={() => setHoveredPersonId(person.id)}
              onMouseLeave={() => setHoveredPersonId(null)}
              onClick={() => setSelectedPersonId(person.id)}
            >
              <div
                className="relative transition-all duration-300"
                style={{ width: finalSize, height: finalSize }}
              >
                {/* Star core with optional orbital motion */}
                <div
                  className={`absolute inset-0 rounded-full transition-all duration-300 ${
                    isInCouple(person.id) ? 'binary-orbit' : ''
                  } ${
                    isInCouple(person.id) && getCouplePartnerId(person.id) > person.id ? 'reverse' : ''
                  }`}
                  style={{
                    background: `radial-gradient(circle at 45% 40%, ${baseColor}, transparent 70%)`,
                    filter: `blur(${blur}px)`,
                    opacity: dimmed ? 0.3 : isSelected ? 1 : 0.9,
                    boxShadow: isSelected || isHovered
                      ? `0 0 ${finalSize * 2}px ${glowColor}, 0 0 ${finalSize * 3}px ${glowColor}40`
                      : `0 0 ${finalSize}px ${glowColor}30`,
                    '--orbit-dur': `${16 + (person.id.charCodeAt(0) % 8)}s`,
                  }}
                />
                
                {/* Chromatic aberration - red */}
                <div
                  className="pointer-events-none absolute rounded-full transition-opacity duration-300"
                  style={{
                    top: -1,
                    left: -1,
                    width: finalSize + 2,
                    height: finalSize + 2,
                    background: 'radial-gradient(circle, transparent 40%, rgba(255,0,0,0.2) 70%, transparent 100%)',
                    opacity: isSelected || isHovered ? 0.6 : 0.3,
                  }}
                />
                
                {/* Chromatic aberration - blue */}
                <div
                  className="pointer-events-none absolute rounded-full transition-opacity duration-300"
                  style={{
                    top: 1,
                    left: 1,
                    width: finalSize - 2,
                    height: finalSize - 2,
                    background: 'radial-gradient(circle, transparent 40%, rgba(0,0,255,0.2) 70%, transparent 100%)',
                    opacity: isSelected || isHovered ? 0.6 : 0.3,
                  }}
                />

                {/* Extra glow for selected/hovered */}
                {(isSelected || isHovered) && (
                  <div
                    className="pointer-events-none absolute rounded-full animate-pulse"
                    style={{
                      top: '50%',
                      left: '50%',
                      width: finalSize * 3,
                      height: finalSize * 3,
                      transform: 'translate(-50%, -50%)',
                      background: `radial-gradient(circle, ${glowColor}30 0%, transparent 70%)`,
                    }}
                  />
                )}
              </div>

              {/* Hover label */}
              {(isHovered || isSelected) && (
                <div className="absolute left-1/2 top-full mt-3 -translate-x-1/2 whitespace-nowrap animate-in fade-in zoom-in-95 duration-200">
                  <div className="rounded-lg border border-amber-500/30 bg-slate-900/95 px-3 py-1.5 text-xs text-white shadow-lg backdrop-blur-md">
                    <div className="font-medium">{person.name}</div>
                    {person.nickname && (
                      <div className="text-[10px] text-amber-400/80">"{person.nickname}"</div>
                    )}
                    {householdName && (
                      <div className="text-[10px] text-slate-400 mt-0.5">{householdName}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>

      {/* Context Panel - floating */}
      {selectedPerson && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[500px] max-w-[calc(100vw-2rem)] glass-card rounded-2xl p-6 border border-amber-500/30 backdrop-blur-xl z-50 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-amber-500/30">
                {selectedPerson.photo_url ? (
                  <img src={selectedPerson.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl text-slate-400">{selectedPerson.name?.charAt(0)}</span>
                )}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-100">{selectedPerson.name}</h3>
                {selectedPerson.nickname && (
                  <p className="text-sm text-amber-400 mt-0.5">"{selectedPerson.nickname}"</p>
                )}
                <div className="flex gap-2 mt-2">
                  <Badge className={
                    selectedPerson.role_type === 'adult' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                    selectedPerson.role_type === 'teen' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                    selectedPerson.role_type === 'child' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                    'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }>
                    {selectedPerson.role_type}
                  </Badge>
                  {selectedPerson.is_deceased && (
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                      In Memory
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedPersonId(null)}
              className="text-slate-400 hover:text-slate-100"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-3 text-sm">
            {selectedPerson.household_id && (
              <div className="flex gap-2">
                <span className="text-slate-500 min-w-24">Household:</span>
                <span className="text-slate-200">
                  {households.find(h => h.id === selectedPerson.household_id)?.name || 'Unknown'}
                </span>
              </div>
            )}
            
            {selectedPerson.birth_date && (
              <div className="flex gap-2">
                <span className="text-slate-500 min-w-24">Born:</span>
                <span className="text-slate-200">
                  {new Date(selectedPerson.birth_date).toLocaleDateString()}
                </span>
              </div>
            )}

            {selectedPerson.birth_year && !selectedPerson.birth_date && (
              <div className="flex gap-2">
                <span className="text-slate-500 min-w-24">Born:</span>
                <span className="text-slate-200">{selectedPerson.birth_year}</span>
              </div>
            )}

            {selectedPerson.death_date && (
              <div className="flex gap-2">
                <span className="text-slate-500 min-w-24">Passed:</span>
                <span className="text-slate-200">
                  {new Date(selectedPerson.death_date).toLocaleDateString()}
                </span>
              </div>
            )}

            {selectedPerson.about && (
              <div className="pt-2 border-t border-slate-700/50">
                <p className="text-slate-400 text-xs leading-relaxed">{selectedPerson.about}</p>
              </div>
            )}

            {(selectedPerson.allergies?.length > 0 || selectedPerson.dietary_preferences?.length > 0) && (
              <div className="pt-2 border-t border-slate-700/50">
                {selectedPerson.allergies?.length > 0 && (
                  <div className="mb-2">
                    <span className="text-slate-500 text-xs">Allergies:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedPerson.allergies.map((allergy, i) => (
                        <Badge key={i} variant="outline" className="text-xs border-red-500/30 text-red-400">
                          {allergy}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {selectedPerson.dietary_preferences?.length > 0 && (
                  <div>
                    <span className="text-slate-500 text-xs">Dietary:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedPerson.dietary_preferences.map((pref, i) => (
                        <Badge key={i} variant="outline" className="text-xs border-slate-600 text-slate-400">
                          {pref}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes drawLine {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}