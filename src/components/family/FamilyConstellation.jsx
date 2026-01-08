import React, { useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const PersonNode = ({ data, selected }) => {
  const [isHovered, setIsHovered] = useState(false);
  const pattern = data.star_pattern || 'classic';
  const intensity = (data.star_intensity || 5) / 10;
  const flareCount = data.star_flare_count || 8;
  
  const getStarSize = (roleType) => {
    const sizes = { 'adult': 6, 'teen': 5, 'child': 4, 'ancestor': 8 };
    return sizes[roleType] || 6;
  };

  const getStarColors = (householdId) => {
    if (!householdId) return { core: '#ffffff', glow: '#a5b4fc' };
    const palettes = [
      { core: '#fef3c7', glow: '#f59e0b' },
      { core: '#dbeafe', glow: '#3b82f6' },
      { core: '#f3e8ff', glow: '#a855f7' },
      { core: '#fce7f3', glow: '#ec4899' },
      { core: '#d1fae5', glow: '#10b981' },
      { core: '#fed7aa', glow: '#f97316' },
    ];
    const hash = householdId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return palettes[hash % palettes.length];
  };

  const size = getStarSize(data.role_type);
  const colors = getStarColors(data.household_id);

  return (
    <motion.div 
      className="relative cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ width: size * 3, height: size * 3 }}
      whileHover={{ scale: 1.3 }}
    >
      {/* Main glow */}
      <motion.div 
        className="absolute rounded-full"
        style={{ 
          width: size * 3,
          height: size * 3,
          background: `radial-gradient(circle, ${colors.glow}60 0%, ${colors.glow}30 40%, transparent 70%)`,
          filter: 'blur(8px)',
        }}
        animate={{ 
          opacity: [0.4, 0.7, 0.4],
          scale: [0.9, 1.1, 0.9],
        }}
        transition={{ duration: 3 + Math.random(), repeat: Infinity }}
      />
      
      {/* Core star */}
      <motion.div 
        className="absolute rounded-full"
        style={{ 
          width: size * 2,
          height: size * 2,
          left: size * 0.5,
          top: size * 0.5,
          background: `radial-gradient(circle, ${colors.core} 0%, ${colors.glow} 70%, transparent 100%)`,
          boxShadow: `0 0 ${size * 2}px ${colors.glow}`,
        }}
        animate={{ 
          opacity: [0.8, 1, 0.8],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Bright center */}
      <div 
        className="absolute rounded-full bg-white"
        style={{ 
          width: size * (0.8 + intensity),
          height: size * (0.8 + intensity),
          left: size * (1.5 - intensity * 0.5),
          top: size * (1.5 - intensity * 0.5),
          boxShadow: `0 0 ${size * 3}px white`,
        }}
      />

      {data.is_deceased && (
        <div className="absolute inset-0 rounded-full" style={{ background: 'rgba(0,0,0,0.6)' }} />
      )}

      <AnimatePresence>
        {(isHovered || selected) && (
          <motion.div 
            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none z-50"
            style={{ top: size * 3 + 8 }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            <div className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-amber-400/40 backdrop-blur-sm">
              <p className="text-xs font-medium text-white">{data.name}</p>
              {data.nickname && <p className="text-xs text-amber-300">"{data.nickname}"</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const nodeTypes = {
  person: PersonNode,
};

export default function FamilyConstellation({ people, households, relationships }) {
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [hoveredPerson, setHoveredPerson] = useState(null);

  // Create beautiful constellation patterns
  const initialNodes = useMemo(() => {
    const householdGroups = {};
    
    // Group people by household
    people.forEach(person => {
      const householdId = person.household_id || 'unassigned';
      if (!householdGroups[householdId]) {
        householdGroups[householdId] = [];
      }
      householdGroups[householdId].push(person);
    });

    const nodes = [];
    const viewportWidth = 1600;
    const viewportHeight = 900;
    const totalGroups = Object.keys(householdGroups).length;

    // Create organic constellation clusters
    Object.entries(householdGroups).forEach(([householdId, groupPeople], groupIndex) => {
      // Position household clusters in a spiral galaxy pattern
      const spiralAngle = groupIndex * 1.618 * Math.PI; // Golden angle
      const spiralRadius = 200 + groupIndex * 150;
      
      const clusterCenterX = viewportWidth / 2 + Math.cos(spiralAngle) * spiralRadius;
      const clusterCenterY = viewportHeight / 2 + Math.sin(spiralAngle) * spiralRadius;

      // Create constellation shape for each household
      groupPeople.forEach((person, index) => {
        let x, y;
        
        if (groupPeople.length === 1) {
          // Single star
          x = clusterCenterX;
          y = clusterCenterY;
        } else if (groupPeople.length === 2) {
          // Binary star system
          const offset = 80;
          x = clusterCenterX + (index === 0 ? -offset : offset);
          y = clusterCenterY;
        } else if (groupPeople.length <= 5) {
          // Pentagon/circular pattern
          const angle = (index / groupPeople.length) * Math.PI * 2 - Math.PI / 2;
          const radius = 100;
          x = clusterCenterX + Math.cos(angle) * radius;
          y = clusterCenterY + Math.sin(angle) * radius;
        } else {
          // Larger families: concentric rings
          const ring = Math.floor(index / 6);
          const posInRing = index % 6;
          const totalInRing = Math.min(6, groupPeople.length - ring * 6);
          const angle = (posInRing / totalInRing) * Math.PI * 2;
          const radius = 100 + ring * 80;
          x = clusterCenterX + Math.cos(angle) * radius;
          y = clusterCenterY + Math.sin(angle) * radius;
        }
        
        // Add slight organic variation
        x += (Math.random() - 0.5) * 30;
        y += (Math.random() - 0.5) * 30;
        
        nodes.push({
          id: person.id,
          type: 'person',
          data: { ...person, householdIndex: groupIndex },
          position: { x, y },
        });
      });
    });

    return nodes;
  }, [people, households]);

  // Always show constellation lines between household members and relationships
  const initialEdges = useMemo(() => {
    const edges = [];
    
    // Create household constellation lines (always visible)
    const householdGroups = {};
    people.forEach(person => {
      const householdId = person.household_id || 'unassigned';
      if (!householdGroups[householdId]) {
        householdGroups[householdId] = [];
      }
      householdGroups[householdId].push(person);
    });
    
    Object.values(householdGroups).forEach(groupPeople => {
      if (groupPeople.length > 1) {
        // Connect household members with subtle lines
        for (let i = 0; i < groupPeople.length; i++) {
          for (let j = i + 1; j < groupPeople.length; j++) {
            edges.push({
              id: `household-${groupPeople[i].id}-${groupPeople[j].id}`,
              source: groupPeople[i].id,
              target: groupPeople[j].id,
              type: 'straight',
              style: {
                stroke: '#475569',
                strokeWidth: 1,
                opacity: hoveredPerson === groupPeople[i].id || hoveredPerson === groupPeople[j].id ? 0.4 : 0.15,
              },
            });
          }
        }
      }
    });
    
    // Add relationship lines (highlighted on hover)
    relationships.forEach((rel, index) => {
      const isHovered = hoveredPerson === rel.person_id || hoveredPerson === rel.related_person_id;
      
      const getEdgeStyle = (relType) => {
        switch(relType) {
          case 'spouse':
            return { stroke: '#f472b6', strokeWidth: 3, animated: true };
          case 'parent':
          case 'child':
            return { stroke: '#fcd34d', strokeWidth: 2.5, animated: true };
          case 'sibling':
            return { stroke: '#c084fc', strokeWidth: 2.5, animated: true };
          default:
            return { stroke: '#60a5fa', strokeWidth: 2, animated: true };
        }
      };

      const style = getEdgeStyle(rel.relationship_type);

      edges.push({
        id: `rel-${index}`,
        source: rel.person_id,
        target: rel.related_person_id,
        type: 'smoothstep',
        style: {
          ...style,
          opacity: isHovered ? 0.8 : 0.3,
        },
        animated: isHovered,
      });
    });

    return edges;
  }, [relationships, hoveredPerson, people]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update edges when hoveredPerson changes
  useEffect(() => {
    setEdges(initialEdges);
  }, [hoveredPerson, initialEdges, setEdges]);

  const onNodeClick = (event, node) => {
    if (node.type === 'person') {
      setSelectedPerson(node.data);
    }
  };

  const onNodeMouseEnter = (event, node) => {
    if (node.type === 'person') {
      setHoveredPerson(node.id);
    }
  };

  const onNodeMouseLeave = () => {
    setHoveredPerson(null);
  };

  return (
    <div className="fixed inset-0 z-0">
      {/* Deep space background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950" />
      
      {/* Distant stars */}
      <div className="absolute inset-0" style={{
        backgroundImage: `
          radial-gradient(1px 1px at 20% 30%, white, transparent),
          radial-gradient(1px 1px at 60% 70%, white, transparent),
          radial-gradient(0.5px 0.5px at 50% 50%, white, transparent),
          radial-gradient(0.5px 0.5px at 80% 10%, white, transparent),
          radial-gradient(1px 1px at 90% 60%, white, transparent),
          radial-gradient(0.5px 0.5px at 33% 90%, white, transparent)`,
        backgroundSize: '200% 200%',
        opacity: 0.4,
      }} />
      
      {/* Nebula clouds */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-blue-600 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-indigo-500 rounded-full blur-[80px]" />
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
        style={{
          background: 'transparent',
        }}
        proOptions={{ hideAttribution: true }}
        panOnScroll={false}
        zoomOnScroll={true}
        zoomOnDoubleClick={true}
        panOnDrag={true}
      >
        <Background 
          color="#94a3b8" 
          gap={80} 
          size={0.3}
          style={{ opacity: 0.03 }}
        />
      </ReactFlow>

      {/* Person Detail Card */}
      <AnimatePresence>
        {selectedPerson && (
          <motion.div 
            className="fixed top-1/2 left-1/2 z-50 w-96"
            initial={{ opacity: 0, scale: 0.8, x: '-50%', y: '-50%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.8, x: '-50%', y: '-50%' }}
            transition={{ duration: 0.3 }}
          >
            <div className="glass-card rounded-2xl p-6 border-2 border-amber-500/30 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                  {selectedPerson.photo_url ? (
                    <img src={selectedPerson.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-medium text-slate-400">
                      {selectedPerson.name?.charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-100">{selectedPerson.name}</h3>
                  {selectedPerson.nickname && (
                    <p className="text-sm text-slate-400">"{selectedPerson.nickname}"</p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedPerson(null)}
                className="text-slate-400 hover:text-slate-100"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-500">Role:</span>
                <span className="text-slate-200 ml-2 capitalize">{selectedPerson.role_type}</span>
              </div>
              
              {selectedPerson.birth_date && (
                <div>
                  <span className="text-slate-500">Birth Date:</span>
                  <span className="text-slate-200 ml-2">{selectedPerson.birth_date}</span>
                </div>
              )}

              {selectedPerson.about && (
                <div>
                  <p className="text-slate-500 mb-1">About:</p>
                  <p className="text-slate-300">{selectedPerson.about}</p>
                </div>
              )}

              {selectedPerson.is_deceased && (
                <div className="pt-2 border-t border-slate-700">
                  <div className="flex items-center gap-2 text-amber-400">
                    <Star className="w-4 h-4" />
                    <span className="text-sm">In loving memory</span>
                  </div>
                </div>
              )}
              </div>
              </div>
              </motion.div>
              )}
              </AnimatePresence>

      {/* Click to dismiss overlay */}
      <AnimatePresence>
        {selectedPerson && (
          <motion.div 
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedPerson(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}