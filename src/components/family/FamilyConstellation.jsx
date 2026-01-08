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

  // Star size based on role
  const getStarSize = (roleType) => {
    const sizes = {
      'adult': 10,
      'teen': 8,
      'child': 6,
      'ancestor': 14,
    };
    return sizes[roleType] || 10;
  };

  // Household color palette for chromatic effects
  const getStarColors = (householdId) => {
    if (!householdId) {
      return { 
        primary: '#e0e7ff', 
        secondary: '#a5b4fc',
        tertiary: '#818cf8'
      };
    }
    
    const palettes = [
      { primary: '#fef3c7', secondary: '#fde68a', tertiary: '#fcd34d' }, // yellow
      { primary: '#dbeafe', secondary: '#93c5fd', tertiary: '#60a5fa' }, // blue
      { primary: '#f3e8ff', secondary: '#d8b4fe', tertiary: '#c084fc' }, // purple
      { primary: '#fce7f3', secondary: '#fbcfe8', tertiary: '#f472b6' }, // pink
      { primary: '#d1fae5', secondary: '#6ee7b7', tertiary: '#34d399' }, // green
      { primary: '#fed7aa', secondary: '#fdba74', tertiary: '#fb923c' }, // orange
    ];
    
    const hash = householdId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return palettes[hash % palettes.length];
  };

  const size = getStarSize(data.role_type);
  const colors = getStarColors(data.household_id);
  
  // Random twinkle timing for natural effect
  const twinkleDuration = 2 + Math.random() * 3;
  const pulseDelay = Math.random() * 2;

  return (
    <motion.div 
      className="relative cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ width: size * 8, height: size * 8 }}
    >
      {/* Outer chromatic aberration ring (blue/red shift) */}
      <motion.div 
        className="absolute rounded-full"
        style={{ 
          width: size * 8,
          height: size * 8,
          background: `radial-gradient(circle, ${colors.tertiary}30 0%, transparent 60%)`,
          filter: 'blur(12px)',
        }}
        animate={{
          opacity: [0.4, 0.7, 0.4],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: twinkleDuration,
          repeat: Infinity,
          delay: pulseDelay,
          ease: "easeInOut"
        }}
      />
      
      {/* Mid-layer glow with color shift */}
      <motion.div 
        className="absolute rounded-full"
        style={{ 
          width: size * 6,
          height: size * 6,
          left: size,
          top: size,
          background: `radial-gradient(circle, ${colors.secondary} 0%, ${colors.tertiary}50 40%, transparent 70%)`,
          filter: 'blur(8px)',
        }}
        animate={{
          opacity: [0.5, 0.9, 0.5],
          scale: [0.9, 1.1, 0.9],
        }}
        transition={{
          duration: twinkleDuration * 0.8,
          repeat: Infinity,
          delay: pulseDelay + 0.1,
          ease: "easeInOut"
        }}
      />
      
      {/* Lens flare cross pattern */}
      <motion.div 
        className="absolute"
        style={{ 
          width: size * 8,
          height: 2,
          left: 0,
          top: size * 4 - 1,
          background: `linear-gradient(90deg, transparent, ${colors.primary}80, transparent)`,
          filter: 'blur(1px)',
        }}
        animate={{
          opacity: isHovered || selected ? [0.3, 0.6, 0.3] : [0.1, 0.3, 0.1],
        }}
        transition={{
          duration: twinkleDuration,
          repeat: Infinity,
          delay: pulseDelay,
        }}
      />
      
      <motion.div 
        className="absolute"
        style={{ 
          width: 2,
          height: size * 8,
          left: size * 4 - 1,
          top: 0,
          background: `linear-gradient(180deg, transparent, ${colors.primary}80, transparent)`,
          filter: 'blur(1px)',
        }}
        animate={{
          opacity: isHovered || selected ? [0.3, 0.6, 0.3] : [0.1, 0.3, 0.1],
        }}
        transition={{
          duration: twinkleDuration,
          repeat: Infinity,
          delay: pulseDelay + 0.15,
        }}
      />
      
      {/* Inner bright core */}
      <motion.div 
        className="absolute rounded-full"
        style={{ 
          width: size * 3,
          height: size * 3,
          left: size * 2.5,
          top: size * 2.5,
          background: `radial-gradient(circle, white 0%, ${colors.primary} 30%, ${colors.secondary} 60%, transparent 100%)`,
          filter: 'blur(3px)',
          boxShadow: `0 0 ${size * 2}px ${colors.primary}`,
        }}
        animate={{
          opacity: [0.8, 1, 0.8],
          scale: isHovered || selected ? [1.2, 1.4, 1.2] : [1, 1.15, 1],
        }}
        transition={{
          duration: twinkleDuration * 0.5,
          repeat: Infinity,
          delay: pulseDelay + 0.2,
          ease: "easeInOut"
        }}
      />
      
      {/* Bright center point */}
      <motion.div 
        className="absolute rounded-full"
        style={{ 
          width: size * 1.5,
          height: size * 1.5,
          left: size * 3.25,
          top: size * 3.25,
          background: 'white',
          filter: 'blur(1px)',
          boxShadow: `0 0 ${size * 3}px white`,
        }}
        animate={{
          opacity: [0.9, 1, 0.9],
          scale: isHovered || selected ? [1.3, 1.6, 1.3] : [1, 1.2, 1],
        }}
        transition={{
          duration: twinkleDuration * 0.3,
          repeat: Infinity,
          delay: pulseDelay + 0.3,
        }}
      />

      {/* Deceased indicator - dimmed star */}
      {data.is_deceased && (
        <div 
          className="absolute inset-0 rounded-full"
          style={{ 
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'brightness(0.5)',
          }}
        />
      )}

      {/* Name label */}
      <AnimatePresence>
        {(isHovered || selected) && (
          <motion.div 
            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none z-50"
            style={{ top: size * 8 + 8 }}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
          >
            <div className="px-3 py-1.5 rounded-lg glass-card border border-amber-400/50 shadow-xl">
              <p className="text-xs font-medium text-slate-100">{data.name}</p>
              {data.nickname && (
                <p className="text-xs text-amber-300">"{data.nickname}"</p>
              )}
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
          color="#475569" 
          gap={60} 
          size={0.5}
          style={{ opacity: 0.05 }}
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