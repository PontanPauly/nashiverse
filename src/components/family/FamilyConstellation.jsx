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

  // Star size and shape based on role
  const getStarConfig = (roleType) => {
    const configs = {
      'adult': { size: 24, points: 5, brightness: 1 },
      'teen': { size: 20, points: 4, brightness: 0.95 },
      'child': { size: 16, points: 6, brightness: 0.9 },
      'ancestor': { size: 32, points: 8, brightness: 1.1 },
    };
    return configs[roleType] || configs['adult'];
  };

  // Household color with more vibrant palette
  const getHouseholdColor = (householdId) => {
    if (!householdId) return '#94a3b8';
    const colors = ['#fcd34d', '#60a5fa', '#c084fc', '#f472b6', '#34d399', '#fb923c'];
    const hash = householdId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const starColor = getHouseholdColor(data.household_id);
  const starConfig = getStarConfig(data.role_type);

  // Unique drift animation
  const driftVariants = {
    animate: {
      x: [0, Math.random() * 6 - 3, 0],
      y: [0, Math.random() * 6 - 3, 0],
      transition: {
        duration: 10 + Math.random() * 5,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  // Multi-pointed star path
  const createStarPath = (points, size) => {
    const outerRadius = size;
    const innerRadius = size * 0.4;
    const step = (Math.PI * 2) / points;
    let path = '';
    
    for (let i = 0; i < points * 2; i++) {
      const angle = i * step / 2 - Math.PI / 2;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const x = size + Math.cos(angle) * radius;
      const y = size + Math.sin(angle) * radius;
      path += `${i === 0 ? 'M' : 'L'} ${x},${y} `;
    }
    path += 'Z';
    return path;
  };

  return (
    <motion.div 
      className="relative cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      variants={driftVariants}
      animate="animate"
    >
      {/* Outer glow ring */}
      <motion.div 
        className="absolute rounded-full blur-2xl"
        style={{ 
          backgroundColor: starColor,
          inset: -starConfig.size * 1.5,
        }}
        animate={{
          opacity: isHovered || selected ? 0.6 : 0.2,
          scale: isHovered || selected ? 1.4 : 1,
        }}
        transition={{ duration: 0.4 }}
      />
      
      {/* Middle shimmer */}
      <motion.div 
        className="absolute rounded-full blur-md"
        style={{ 
          backgroundColor: starColor,
          inset: -starConfig.size * 0.8,
        }}
        animate={{
          opacity: [0.3, 0.7, 0.3],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 4 + Math.random() * 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Core star */}
      <motion.svg 
        width={starConfig.size * 2}
        height={starConfig.size * 2}
        viewBox={`0 0 ${starConfig.size * 2} ${starConfig.size * 2}`}
        className="relative drop-shadow-2xl"
        animate={{
          scale: isHovered || selected ? 1.4 : 1,
          rotate: data.is_deceased ? 0 : [0, 360],
        }}
        transition={{
          scale: { duration: 0.3 },
          rotate: { duration: 60, repeat: Infinity, ease: "linear" }
        }}
      >
        <defs>
          <radialGradient id={`gradient-${data.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity={starConfig.brightness} />
            <stop offset="50%" stopColor={starColor} stopOpacity="1" />
            <stop offset="100%" stopColor={starColor} stopOpacity={data.is_deceased ? "0.3" : "0.8"} />
          </radialGradient>
          <filter id={`glow-${data.id}`}>
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <path
          d={createStarPath(starConfig.points, starConfig.size)}
          fill={`url(#gradient-${data.id})`}
          filter={`url(#glow-${data.id})`}
          style={{ opacity: data.is_deceased ? 0.5 : 1 }}
        />
      </motion.svg>

      {/* Name label */}
      <AnimatePresence>
        {(isHovered || selected) && (
          <motion.div 
            className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none z-50"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
          >
            <div className="px-4 py-2 rounded-xl glass-card border-2 border-amber-400/50 shadow-2xl">
              <p className="text-sm font-bold text-slate-100">{data.name}</p>
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