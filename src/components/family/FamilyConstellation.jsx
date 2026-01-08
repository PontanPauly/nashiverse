import React, { useMemo, useState, useRef, useEffect } from 'react';
import { X, Filter, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function FamilyConstellation({ people, households, relationships }) {
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [hoveredPersonId, setHoveredPersonId] = useState(null);
  const [viewMode, setViewMode] = useState('all'); // all, household, lineage
  const [selectedHouseholdId, setSelectedHouseholdId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Organize people by generation and household
  const organized = useMemo(() => {
    if (!people || !relationships) return { generations: [], households: new Map() };

    // Find root ancestors (people with no parents in the system)
    const hasParent = new Set();
    relationships.forEach(rel => {
      if (rel.relationship_type === 'parent') {
        hasParent.add(rel.related_person_id);
      }
    });

    const roots = people.filter(p => !hasParent.has(p.id) && (p.role_type === 'adult' || p.role_type === 'ancestor'));
    
    // Build generations using BFS
    const generations = [];
    const visited = new Set();
    let currentGen = roots;
    
    while (currentGen.length > 0) {
      generations.push(currentGen);
      currentGen.forEach(p => visited.add(p.id));
      
      const nextGen = [];
      currentGen.forEach(parent => {
        const children = relationships
          .filter(r => r.relationship_type === 'parent' && r.person_id === parent.id)
          .map(r => people.find(p => p.id === r.related_person_id))
          .filter(p => p && !visited.has(p.id));
        nextGen.push(...children);
      });
      
      currentGen = [...new Set(nextGen.map(p => p.id))].map(id => people.find(p => p.id === id)).filter(Boolean);
    }

    // Add any remaining people
    const remaining = people.filter(p => !visited.has(p.id));
    if (remaining.length > 0) generations.push(remaining);

    // Group by household
    const householdGroups = new Map();
    people.forEach(p => {
      const hid = p.household_id || 'none';
      if (!householdGroups.has(hid)) householdGroups.set(hid, []);
      householdGroups.get(hid).push(p);
    });

    return { generations, households: householdGroups };
  }, [people, relationships]);

  // Get filtered people
  const visiblePeople = useMemo(() => {
    if (viewMode === 'household' && selectedHouseholdId) {
      return people.filter(p => p.household_id === selectedHouseholdId);
    }
    if (viewMode === 'lineage' && selectedPersonId) {
      // Show person and their direct connections
      const connected = new Set([selectedPersonId]);
      relationships.forEach(r => {
        if (r.person_id === selectedPersonId) connected.add(r.related_person_id);
        if (r.related_person_id === selectedPersonId) connected.add(r.person_id);
      });
      return people.filter(p => connected.has(p.id));
    }
    return people;
  }, [people, viewMode, selectedHouseholdId, selectedPersonId, relationships]);

  // Calculate positions
  const positions = useMemo(() => {
    const pos = new Map();
    
    if (viewMode === 'household' && selectedHouseholdId) {
      // Circular layout for household
      const household = visiblePeople;
      household.forEach((person, i) => {
        const angle = (i / household.length) * Math.PI * 2;
        const radius = 30;
        pos.set(person.id, {
          x: 50 + radius * Math.cos(angle),
          y: 50 + radius * Math.sin(angle),
        });
      });
    } else {
      // Generational layout
      organized.generations.forEach((gen, genIdx) => {
        const y = 15 + (genIdx * 25);
        const spacing = 80 / (gen.length + 1);
        
        gen.forEach((person, idx) => {
          pos.set(person.id, {
            x: 10 + spacing * (idx + 1),
            y: y,
          });
        });
      });
    }

    return pos;
  }, [organized, visiblePeople, viewMode, selectedHouseholdId]);

  // Get relationship lines
  const lines = useMemo(() => {
    if (!relationships || !visiblePeople) return [];
    
    return relationships
      .filter(r => {
        const source = visiblePeople.find(p => p.id === r.person_id);
        const target = visiblePeople.find(p => p.id === r.related_person_id);
        return source && target && positions.get(r.person_id) && positions.get(r.related_person_id);
      })
      .map(r => ({
        ...r,
        source: positions.get(r.person_id),
        target: positions.get(r.related_person_id),
      }));
  }, [relationships, visiblePeople, positions]);

  const selectedPerson = people?.find(p => p.id === selectedPersonId);

  // Reset view
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Get star visuals
  const getStarVisuals = (person) => {
    const isAncestor = person.is_deceased || person.role_type === 'ancestor';
    const isChild = person.role_type === 'child';
    const isTeen = person.role_type === 'teen';

    let size = 16;
    if (isChild) size = 12;
    else if (isTeen) size = 14;
    else if (isAncestor) size = 18;

    const baseColor = isAncestor ? '#FBBF77' : '#60A5FA';
    const glowColor = isAncestor ? '#FDBA74' : '#93C5FD';

    return { size, baseColor, glowColor };
  };

  if (!people || people.length === 0) {
    return (
      <div className="relative w-full h-[600px] rounded-2xl bg-gradient-to-b from-[#050716] to-[#03040d] flex items-center justify-center">
        <p className="text-slate-500">No family members yet</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#000000] via-[#020206] to-[#030308]">
        <div className="absolute inset-0 opacity-40" style={{
          backgroundImage: `
            radial-gradient(1px 1px at 20% 30%, white, transparent),
            radial-gradient(1px 1px at 60% 70%, white, transparent),
            radial-gradient(0.5px 0.5px at 50% 50%, white, transparent)
          `,
          backgroundSize: '200% 200%',
        }} />
      </div>

      {/* Controls */}
      <div className="absolute top-20 right-4 z-50 glass-card rounded-xl p-3 border border-slate-700/50 space-y-2">
        <Select value={viewMode} onValueChange={setViewMode}>
          <SelectTrigger className="h-8 text-xs bg-slate-800/90 border-slate-700">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all">All Family</SelectItem>
            <SelectItem value="household">By Household</SelectItem>
            {selectedPersonId && <SelectItem value="lineage">Lineage View</SelectItem>}
          </SelectContent>
        </Select>

        {viewMode === 'household' && (
          <Select value={selectedHouseholdId} onValueChange={setSelectedHouseholdId}>
            <SelectTrigger className="h-8 text-xs bg-slate-800/90 border-slate-700">
              <SelectValue placeholder="Select household" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {households.map(h => (
                <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex gap-1 pt-2 border-t border-slate-700/50">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.min(z + 0.2, 3))}>
            <ZoomIn className="w-3 h-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))}>
            <ZoomOut className="w-3 h-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={resetView}>
            <Maximize2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
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
        onWheel={(e) => {
          e.preventDefault();
          const delta = e.deltaY * -0.001;
          setZoom(z => Math.min(Math.max(0.5, z + delta), 3));
        }}
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          {lines.map((line, i) => {
            const isHighlighted = selectedPersonId === line.person_id || selectedPersonId === line.related_person_id;
            let color = 'rgba(251, 191, 36, 0.2)';
            let width = 0.3;
            
            if (line.relationship_type === 'spouse' || line.relationship_type === 'partner') {
              color = 'rgba(236, 72, 153, 0.4)';
              width = 0.4;
            }
            
            if (isHighlighted) {
              color = color.replace(/[\d.]+\)$/, '0.8)');
              width *= 2;
            }

            return (
              <line
                key={i}
                x1={line.source.x}
                y1={line.source.y}
                x2={line.target.x}
                y2={line.target.y}
                stroke={color}
                strokeWidth={width}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        <div
          className="absolute inset-0"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center' }}
        >
          {visiblePeople.map(person => {
            const pos = positions.get(person.id);
            if (!pos) return null;

            const { size, baseColor, glowColor } = getStarVisuals(person);
            const isSelected = selectedPersonId === person.id;
            const isHovered = hoveredPersonId === person.id;
            const finalSize = isSelected ? size * 1.4 : isHovered ? size * 1.2 : size;

            return (
              <div
                key={person.id}
                className="absolute cursor-pointer transition-transform duration-300 hover:z-20"
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
                onMouseEnter={() => setHoveredPersonId(person.id)}
                onMouseLeave={() => setHoveredPersonId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPersonId(person.id);
                }}
              >
                <div style={{ width: finalSize, height: finalSize }} className="relative">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `radial-gradient(circle at 45% 40%, ${baseColor}, transparent 70%)`,
                      filter: 'blur(0.5px)',
                      boxShadow: isSelected ? `0 0 ${finalSize * 3}px ${glowColor}` : `0 0 ${finalSize}px ${glowColor}40`,
                    }}
                  />
                </div>

                {(isHovered || isSelected) && (
                  <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap z-50">
                    <div className="rounded-lg border border-amber-500/30 bg-slate-900/95 px-3 py-1.5 text-xs backdrop-blur-md">
                      <div className="font-medium text-white">{person.name}</div>
                      {person.nickname && <div className="text-[10px] text-amber-400">"{person.nickname}"</div>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Panel */}
      {selectedPerson && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[500px] max-w-[calc(100vw-2rem)] glass-card rounded-2xl p-6 border border-amber-500/30 z-50">
          <div className="flex justify-between items-start mb-4">
            <div className="flex gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                {selectedPerson.photo_url ? (
                  <img src={selectedPerson.photo_url} className="w-full h-full object-cover rounded-full" />
                ) : (
                  <span className="text-lg text-slate-400">{selectedPerson.name?.charAt(0)}</span>
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100">{selectedPerson.name}</h3>
                {selectedPerson.nickname && <p className="text-sm text-amber-400">"{selectedPerson.nickname}"</p>}
                <Badge className="mt-1 text-xs">{selectedPerson.role_type}</Badge>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedPersonId(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          {selectedPerson.about && (
            <p className="text-sm text-slate-400 mt-3">{selectedPerson.about}</p>
          )}
        </div>
      )}
    </div>
  );
}