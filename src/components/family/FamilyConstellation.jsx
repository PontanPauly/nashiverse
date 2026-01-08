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

  // Star size based on role (with depth variation)
  const getStarSize = (roleType) => {
    const depth = data.depth || 1;
    const baseSize = {
      'adult': 16,
      'teen': 14,
      'child': 12,
      'ancestor': 20,
    }[roleType] || 16;
    
    const scaledSize = baseSize * depth;
    return { width: scaledSize, height: scaledSize };
  };

  // Household color
  const getHouseholdColor = (householdId) => {
    if (!householdId) return '#94a3b8';
    const colors = ['#fbbf24', '#60a5fa', '#a78bfa', '#ec4899', '#10b981', '#f59e0b'];
    const hash = householdId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const starColor = getHouseholdColor(data.household_id);
  const starSize = getStarSize(data.role_type);
  const depth = data.depth || 1;
  const opacity = depth === 0.6 ? 0.7 : depth === 0.8 ? 0.85 : 1;

  // Unique drift animation per star
  const driftVariants = {
    animate: {
      x: [0, Math.random() * 4 - 2, 0],
      y: [0, Math.random() * 4 - 2, 0],
      transition: {
        duration: 8 + Math.random() * 4,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <motion.div 
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      variants={driftVariants}
      animate="animate"
      style={{ opacity }}
    >
      {/* Glow effect */}
      <motion.div 
        className="absolute inset-0 rounded-full blur-xl"
        style={{ 
          backgroundColor: starColor,
          transform: 'scale(3)',
        }}
        animate={{
          opacity: isHovered || selected ? 0.8 : 0.3,
          scale: isHovered || selected ? 4 : 3,
        }}
        transition={{ duration: 0.5 }}
      />
      
      {/* Shimmer effect */}
      <motion.div 
        className="absolute inset-0 rounded-full"
        style={{ 
          backgroundColor: starColor,
          transform: 'scale(2)',
          filter: 'blur(8px)'
        }}
        animate={{
          opacity: [0.2, 0.5, 0.2],
        }}
        transition={{
          duration: 3 + Math.random() * 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Star */}
      <motion.div 
        className="relative"
        animate={{
          scale: isHovered || selected ? 1.3 : 1,
          rotate: [0, 5, -5, 0],
        }}
        transition={{
          scale: { duration: 0.3 },
          rotate: { duration: 20, repeat: Infinity, ease: "easeInOut" }
        }}
      >
        <Star 
          className="cursor-pointer"
          style={{ 
            color: starColor,
            width: starSize.width,
            height: starSize.height,
            opacity: data.is_deceased ? 0.5 : 1,
          }}
          fill={starColor}
        />
      </motion.div>

      {/* Name on hover */}
      <AnimatePresence>
        {(isHovered || selected) && (
          <motion.div 
            className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none z-50"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-3 py-1.5 rounded-lg glass-card border border-slate-700/50 shadow-xl">
              <p className="text-xs font-medium text-slate-100">{data.name}</p>
              {data.nickname && (
                <p className="text-xs text-slate-400">"{data.nickname}"</p>
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

  // Create constellation nodes with depth layers
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
    const centerX = 800;
    const centerY = 400;
    const householdRadius = 300;

    // Create constellation pattern with depth
    Object.entries(householdGroups).forEach(([householdId, groupPeople], groupIndex) => {
      const totalGroups = Object.keys(householdGroups).length;
      const groupAngle = (groupIndex / totalGroups) * Math.PI * 2;
      
      // Household center point
      const householdCenterX = centerX + Math.cos(groupAngle) * householdRadius;
      const householdCenterY = centerY + Math.sin(groupAngle) * householdRadius;

      // Arrange people in orbital pattern around household center
      groupPeople.forEach((person, index) => {
        const personAngle = (index / groupPeople.length) * Math.PI * 2;
        const orbitRadius = 80 + Math.random() * 60;
        
        const x = householdCenterX + Math.cos(personAngle) * orbitRadius;
        const y = householdCenterY + Math.sin(personAngle) * orbitRadius;
        
        // Assign depth layer (0.6 = background, 0.8 = mid, 1.0 = foreground)
        const depthLayers = [0.6, 0.8, 1.0];
        const depth = depthLayers[index % 3];
        
        nodes.push({
          id: person.id,
          type: 'person',
          data: { ...person, depth },
          position: { x, y },
        });
      });
    });

    return nodes;
  }, [people, households]);

  // Create subtle relationship edges (only visible on hover)
  const initialEdges = useMemo(() => {
    if (!hoveredPerson) return [];
    
    return relationships
      .filter(rel => rel.person_id === hoveredPerson || rel.related_person_id === hoveredPerson)
      .map((rel, index) => {
        const getEdgeStyle = (relType) => {
          switch(relType) {
            case 'spouse':
              return { stroke: '#ec4899', strokeWidth: 2 };
            case 'parent':
            case 'child':
              return { stroke: '#fbbf24', strokeWidth: 1.5 };
            case 'sibling':
              return { stroke: '#a78bfa', strokeWidth: 1.5 };
            default:
              return { stroke: '#94a3b8', strokeWidth: 1 };
          }
        };

        const style = getEdgeStyle(rel.relationship_type);

        return {
          id: `edge-${index}`,
          source: rel.person_id,
          target: rel.related_person_id,
          type: 'straight',
          style: {
            ...style,
            opacity: 0.4,
          },
          animated: true,
        };
      });
  }, [relationships, hoveredPerson]);

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