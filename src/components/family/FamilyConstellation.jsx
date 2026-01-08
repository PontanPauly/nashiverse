import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function FamilyConstellation({ people, households, relationships }) {
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [hoveredPersonId, setHoveredPersonId] = useState(null);
  const [selectedConstellationId, setSelectedConstellationId] = useState('all');

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

  // Get constellation lines for active selection
  const constellationLines = useMemo(() => {
    if (!selectedConstellationId || selectedConstellationId === 'all') return [];

    let members = [];
    if (selectedConstellationId === 'ancestors') {
      members = ancestors;
    } else {
      members = people.filter(
        p => !p.is_deceased && p.role_type !== 'ancestor' && p.household_id === selectedConstellationId
      );
    }

    if (members.length < 2) return [];

    const sorted = [...members].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const lines = [];

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
  }, [selectedConstellationId, ancestors, people]);

  const selectedPerson = useMemo(
    () => people.find(p => p.id === selectedPersonId) || null,
    [people, selectedPersonId]
  );

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
    <div className="absolute inset-0 overflow-hidden">
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
      </div>

      {/* Universe canvas */}
      <div className="absolute inset-0">

        {/* Constellation lines */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full z-10">
          {constellationLines.map((line, index) => (
            <line
              key={line.id}
              x1={`${line.x1}%`}
              y1={`${line.y1}%`}
              x2={`${line.x2}%`}
              y2={`${line.y2}%`}
              stroke="rgba(251,191,36,0.4)"
              strokeWidth="1.5"
              style={{
                filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.5))',
                strokeDasharray: '1000',
                strokeDashoffset: '1000',
                animation: `drawLine 0.8s ease forwards ${index * 0.08}s`,
              }}
            />
          ))}
        </svg>

        {/* Family stars */}
        <div className="absolute inset-0 z-20">
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
                {/* Star core */}
                <div
                  className="absolute inset-0 rounded-full transition-all duration-300"
                  style={{
                    background: `radial-gradient(circle at 45% 40%, ${baseColor}, transparent 70%)`,
                    filter: `blur(${blur}px)`,
                    opacity: dimmed ? 0.3 : isSelected ? 1 : 0.9,
                    boxShadow: isSelected || isHovered
                      ? `0 0 ${finalSize * 2}px ${glowColor}, 0 0 ${finalSize * 3}px ${glowColor}40`
                      : `0 0 ${finalSize}px ${glowColor}30`,
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