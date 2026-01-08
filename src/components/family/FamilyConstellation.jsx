import React, { useMemo, useState, useRef, useEffect } from 'react';
import { X, Users, Heart, Baby, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Force-directed graph simulation
class ForceSimulation {
  constructor(nodes, edges, width, height) {
    this.nodes = nodes.map(n => ({
      ...n,
      x: n.x || width / 2 + (Math.random() - 0.5) * 200,
      y: n.y || height / 2 + (Math.random() - 0.5) * 200,
      vx: 0,
      vy: 0,
    }));
    this.edges = edges;
    this.width = width;
    this.height = height;
  }

  tick(alpha = 0.3) {
    // Repulsion between all nodes
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const a = this.nodes[i];
        const b = this.nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 3000 / (dist * dist);
        
        a.vx -= (dx / dist) * force * alpha;
        a.vy -= (dy / dist) * force * alpha;
        b.vx += (dx / dist) * force * alpha;
        b.vy += (dy / dist) * force * alpha;
      }
    }

    // Attraction along edges
    this.edges.forEach(edge => {
      const source = this.nodes.find(n => n.id === edge.source);
      const target = this.nodes.find(n => n.id === edge.target);
      if (!source || !target) return;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      
      const optimalDist = edge.type === 'partner' ? 80 : edge.type === 'parent' ? 120 : 100;
      const force = (dist - optimalDist) * 0.1 * (edge.strength || 1);
      
      source.vx += (dx / dist) * force * alpha;
      source.vy += (dy / dist) * force * alpha;
      target.vx -= (dx / dist) * force * alpha;
      target.vy -= (dy / dist) * force * alpha;
    });

    // Center gravity
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    this.nodes.forEach(node => {
      const dx = centerX - node.x;
      const dy = centerY - node.y;
      node.vx += dx * 0.01 * alpha;
      node.vy += dy * 0.01 * alpha;
    });

    // Apply velocities with damping
    this.nodes.forEach(node => {
      node.x += node.vx;
      node.y += node.vy;
      node.vx *= 0.85;
      node.vy *= 0.85;

      // Boundary constraints
      const padding = 50;
      node.x = Math.max(padding, Math.min(this.width - padding, node.x));
      node.y = Math.max(padding, Math.min(this.height - padding, node.y));
    });

    return this.nodes;
  }
}

export default function FamilyConstellation({ people, households, relationships }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 600 });
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [hoveredPersonId, setHoveredPersonId] = useState(null);
  const [filterMode, setFilterMode] = useState('all');
  const [selectedHouseholdId, setSelectedHouseholdId] = useState(null);
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [nodePositions, setNodePositions] = useState({});
  const simulationRef = useRef(null);
  const animationRef = useRef(null);

  // Measure container
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Build graph edges from relationships
  const edges = useMemo(() => {
    if (!relationships || !people) return [];
    
    const edgeList = [];
    const processed = new Set();

    relationships.forEach(rel => {
      const key = [rel.person_id, rel.related_person_id].sort().join('-');
      if (processed.has(key)) return;
      processed.add(key);

      let strength = 1;
      if (rel.relationship_type === 'partner' || rel.relationship_type === 'spouse') {
        strength = 2;
      } else if (rel.relationship_type === 'parent' || rel.relationship_type === 'child') {
        strength = 1.5;
      }

      edgeList.push({
        source: rel.person_id,
        target: rel.related_person_id,
        type: rel.relationship_type,
        strength,
      });
    });

    return edgeList;
  }, [relationships, people]);

  // Filter people based on mode
  const filteredPeople = useMemo(() => {
    if (!people) return [];
    
    if (filterMode === 'ancestors') {
      return people.filter(p => p.is_deceased || p.role_type === 'ancestor');
    }
    if (filterMode === 'living') {
      return people.filter(p => !p.is_deceased && p.role_type !== 'ancestor');
    }
    if (filterMode === 'household' && selectedHouseholdId) {
      return people.filter(p => p.household_id === selectedHouseholdId);
    }
    if (filterMode === 'connections' && selectedPersonId) {
      // Show selected person and all directly connected people
      const connected = new Set([selectedPersonId]);
      edges.forEach(edge => {
        if (edge.source === selectedPersonId) connected.add(edge.target);
        if (edge.target === selectedPersonId) connected.add(edge.source);
      });
      return people.filter(p => connected.has(p.id));
    }
    return people;
  }, [people, filterMode, selectedHouseholdId, selectedPersonId, edges]);

  // Initialize and run simulation
  useEffect(() => {
    if (!filteredPeople.length || !dimensions.width) return;

    const nodes = filteredPeople.map(p => ({
      id: p.id,
      data: p,
      x: nodePositions[p.id]?.x,
      y: nodePositions[p.id]?.y,
    }));

    const relevantEdges = edges.filter(e => 
      filteredPeople.find(p => p.id === e.source) && 
      filteredPeople.find(p => p.id === e.target)
    );

    simulationRef.current = new ForceSimulation(nodes, relevantEdges, dimensions.width, dimensions.height);

    let iterations = 0;
    const maxIterations = 300;

    const animate = () => {
      if (iterations < maxIterations && simulationRef.current && !draggedNodeId) {
        const alpha = Math.max(0.01, 1 - iterations / maxIterations);
        const updated = simulationRef.current.tick(alpha);
        
        const newPositions = {};
        updated.forEach(node => {
          newPositions[node.id] = { x: node.x, y: node.y };
        });
        setNodePositions(newPositions);
        
        iterations++;
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [filteredPeople, edges, dimensions, draggedNodeId]);

  // Handle node drag
  const handleMouseDown = (personId, e) => {
    e.stopPropagation();
    setDraggedNodeId(personId);
  };

  const handleMouseMove = (e) => {
    if (!draggedNodeId || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setNodePositions(prev => ({
      ...prev,
      [draggedNodeId]: { x, y }
    }));
  };

  const handleMouseUp = () => {
    setDraggedNodeId(null);
  };

  useEffect(() => {
    if (draggedNodeId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggedNodeId]);

  // Get relationship label
  const getRelationshipLabel = (type) => {
    const labels = {
      partner: '💑 Partner',
      spouse: '💍 Spouse',
      parent: '👪 Parent',
      child: '👶 Child',
      sibling: '👫 Sibling',
      grandparent: '👴 Grandparent',
      grandchild: '👧 Grandchild',
    };
    return labels[type] || type;
  };

  // Get star visuals
  const getStarVisuals = (person) => {
    const isAncestor = person.is_deceased || person.role_type === 'ancestor';
    const isChild = person.role_type === 'child';
    const isTeen = person.role_type === 'teen';

    let size = 18;
    if (isChild) size = 14;
    else if (isTeen) size = 16;
    else if (isAncestor) size = 20;

    const baseColor = isAncestor ? '#FBBF77' : '#60A5FA';
    const glowColor = isAncestor ? '#FDBA74' : '#93C5FD';

    return { size, baseColor, glowColor };
  };

  const selectedPerson = people?.find(p => p.id === selectedPersonId);

  // Get connections for selected person
  const selectedConnections = useMemo(() => {
    if (!selectedPersonId || !edges) return [];
    return edges.filter(e => e.source === selectedPersonId || e.target === selectedPersonId);
  }, [selectedPersonId, edges]);

  if (!people || people.length === 0) {
    return (
      <div className="relative w-full h-[600px] rounded-2xl bg-gradient-to-b from-[#050716] via-[#050816] to-[#03040d] flex items-center justify-center">
        <div className="text-center">
          <Users className="w-16 h-16 text-slate-700 mx-auto mb-4" />
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
        <div className="absolute inset-0 bg-gradient-to-b from-[#000000] via-[#020206] to-[#030308]" />
        
        {/* Star field */}
        <div className="absolute inset-0 opacity-60">
          <div 
            className="absolute inset-0" 
            style={{
              backgroundImage: `
                radial-gradient(1px 1px at 20% 10%, white, transparent),
                radial-gradient(1px 1px at 80% 20%, white, transparent),
                radial-gradient(0.5px 0.5px at 40% 30%, white, transparent),
                radial-gradient(1px 1px at 60% 40%, white, transparent),
                radial-gradient(0.5px 0.5px at 15% 50%, white, transparent)
              `,
              backgroundSize: '200% 200%',
            }}
          />
        </div>

        {/* Nebula clouds */}
        <div className="absolute inset-0 opacity-25">
          <div 
            className="absolute w-[800px] h-[800px] rounded-full"
            style={{
              top: '10%',
              left: '15%',
              background: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.4) 0%, transparent 70%)',
              filter: 'blur(100px)',
            }}
          />
          <div 
            className="absolute w-[700px] h-[700px] rounded-full"
            style={{
              bottom: '15%',
              right: '20%',
              background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.35) 0%, transparent 70%)',
              filter: 'blur(120px)',
            }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="absolute top-20 right-4 z-50 glass-card rounded-xl px-4 py-3 border border-slate-700/50 backdrop-blur-xl space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-medium">View:</span>
          <Select value={filterMode} onValueChange={setFilterMode}>
            <SelectTrigger className="w-36 h-8 text-xs bg-slate-800/90 border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">Whole Family</SelectItem>
              <SelectItem value="living">Living Members</SelectItem>
              <SelectItem value="ancestors">Ancestors</SelectItem>
              <SelectItem value="household">By Household</SelectItem>
              {selectedPersonId && <SelectItem value="connections">Connections</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        {filterMode === 'household' && (
          <Select value={selectedHouseholdId} onValueChange={setSelectedHouseholdId}>
            <SelectTrigger className="w-full h-8 text-xs bg-slate-800/90 border-slate-700">
              <SelectValue placeholder="Select household" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {households.map(h => (
                <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="pt-2 border-t border-slate-700/50 text-xs text-slate-500">
          <p>{filteredPeople.length} members</p>
          <p className="text-[10px] mt-1">Drag stars to rearrange</p>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="absolute inset-0 z-20">
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Connection lines */}
          {filteredPeople.map(person => {
            if (!nodePositions[person.id]) return null;
            const personEdges = edges.filter(e => 
              (e.source === person.id || e.target === person.id) &&
              filteredPeople.find(p => p.id === e.source) &&
              filteredPeople.find(p => p.id === e.target)
            );

            return personEdges.map(edge => {
              const sourcePos = nodePositions[edge.source];
              const targetPos = nodePositions[edge.target];
              if (!sourcePos || !targetPos) return null;

              const isSelected = selectedPersonId === edge.source || selectedPersonId === edge.target;
              const isHovered = hoveredPersonId === edge.source || hoveredPersonId === edge.target;

              let color = 'rgba(251, 191, 36, 0.15)';
              let width = 1;

              if (edge.type === 'partner' || edge.type === 'spouse') {
                color = 'rgba(236, 72, 153, 0.3)';
                width = 1.5;
              } else if (edge.type === 'parent' || edge.type === 'child') {
                color = 'rgba(59, 130, 246, 0.25)';
                width = 1.2;
              }

              if (isSelected || isHovered) {
                color = color.replace(/[\d.]+\)$/, '0.6)');
                width *= 1.5;
              }

              return (
                <line
                  key={`${edge.source}-${edge.target}`}
                  x1={sourcePos.x}
                  y1={sourcePos.y}
                  x2={targetPos.x}
                  y2={targetPos.y}
                  stroke={color}
                  strokeWidth={width}
                  strokeLinecap="round"
                />
              );
            });
          })}
        </svg>

        {/* Stars */}
        {filteredPeople.map(person => {
          const pos = nodePositions[person.id];
          if (!pos) return null;

          const { size, baseColor, glowColor } = getStarVisuals(person);
          const isSelected = selectedPersonId === person.id;
          const isHovered = hoveredPersonId === person.id;
          const isDragging = draggedNodeId === person.id;

          const finalSize = isSelected ? size * 1.3 : isHovered ? size * 1.15 : size;

          return (
            <div
              key={person.id}
              className={cn(
                "absolute cursor-grab active:cursor-grabbing transition-all duration-200",
                isDragging && "z-50"
              )}
              style={{
                left: pos.x,
                top: pos.y,
                transform: 'translate(-50%, -50%)',
              }}
              onMouseEnter={() => setHoveredPersonId(person.id)}
              onMouseLeave={() => setHoveredPersonId(null)}
              onMouseDown={(e) => handleMouseDown(person.id, e)}
              onClick={() => setSelectedPersonId(person.id)}
            >
              <div
                className="relative"
                style={{ width: finalSize, height: finalSize }}
              >
                {/* Core */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `radial-gradient(circle at 45% 40%, ${baseColor}, transparent 70%)`,
                    filter: 'blur(0.6px)',
                    boxShadow: isSelected || isHovered
                      ? `0 0 ${finalSize * 2}px ${glowColor}, 0 0 ${finalSize * 3}px ${glowColor}40`
                      : `0 0 ${finalSize}px ${glowColor}30`,
                  }}
                />

                {/* Pulse for selected */}
                {isSelected && (
                  <div
                    className="absolute inset-0 rounded-full animate-pulse"
                    style={{
                      width: finalSize * 3,
                      height: finalSize * 3,
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: `radial-gradient(circle, ${glowColor}30 0%, transparent 70%)`,
                    }}
                  />
                )}
              </div>

              {/* Label on hover */}
              {(isHovered || isSelected) && (
                <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap animate-in fade-in zoom-in-95 duration-200 z-50">
                  <div className="rounded-lg border border-amber-500/30 bg-slate-900/95 px-3 py-1.5 text-xs text-white shadow-lg backdrop-blur-md">
                    <div className="font-medium">{person.name}</div>
                    {person.nickname && (
                      <div className="text-[10px] text-amber-400/80">"{person.nickname}"</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Person Panel */}
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
                <Badge className="mt-2 bg-blue-500/20 text-blue-400 border-blue-500/30">
                  {selectedPerson.role_type}
                </Badge>
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

          {/* Connections */}
          {selectedConnections.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-slate-400">Connections ({selectedConnections.length})</h4>
              <div className="space-y-1">
                {selectedConnections.slice(0, 5).map((edge, i) => {
                  const otherId = edge.source === selectedPersonId ? edge.target : edge.source;
                  const otherPerson = people.find(p => p.id === otherId);
                  if (!otherPerson) return null;

                  return (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-xs">{getRelationshipLabel(edge.type)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-300 hover:text-amber-400 h-auto py-1"
                        onClick={() => setSelectedPersonId(otherId)}
                      >
                        {otherPerson.name}
                      </Button>
                    </div>
                  );
                })}
                {selectedConnections.length > 5 && (
                  <p className="text-xs text-slate-500">+ {selectedConnections.length - 5} more</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}