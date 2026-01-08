import React, { useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const PersonNode = ({ data, selected }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Star size based on role
  const getStarSize = (roleType) => {
    switch(roleType) {
      case 'adult': return 'w-4 h-4';
      case 'teen': return 'w-3.5 h-3.5';
      case 'child': return 'w-3 h-3';
      case 'ancestor': return 'w-5 h-5';
      default: return 'w-4 h-4';
    }
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

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glow effect */}
      <div 
        className={cn(
          "absolute inset-0 rounded-full blur-xl transition-opacity duration-500",
          isHovered || selected ? "opacity-60" : "opacity-30"
        )}
        style={{ 
          backgroundColor: starColor,
          transform: 'scale(3)',
        }}
      />
      
      {/* Star */}
      <div className="relative">
        <Star 
          className={cn(
            starSize,
            "transition-all duration-300 cursor-pointer",
            isHovered || selected ? "scale-125" : "scale-100",
            data.is_deceased && "opacity-50"
          )}
          style={{ color: starColor }}
          fill={starColor}
        />
      </div>

      {/* Name on hover */}
      {(isHovered || selected) && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none">
          <div className="px-3 py-1.5 rounded-lg glass-card border border-slate-700/50">
            <p className="text-xs font-medium text-slate-100">{data.name}</p>
            {data.nickname && (
              <p className="text-xs text-slate-400">"{data.nickname}"</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const nodeTypes = {
  person: PersonNode,
};

export default function FamilyConstellation({ people, households, relationships }) {
  const [selectedPerson, setSelectedPerson] = useState(null);

  // Create constellation nodes
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

    // Create constellation pattern
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
        
        nodes.push({
          id: person.id,
          type: 'person',
          data: person,
          position: { x, y },
        });
      });
    });

    return nodes;
  }, [people, households]);

  // Create subtle relationship edges (hidden by default)
  const initialEdges = useMemo(() => {
    return relationships.map((rel, index) => {
      const getEdgeStyle = (relType) => {
        switch(relType) {
          case 'spouse':
            return { stroke: '#ec4899', strokeWidth: 2, strokeDasharray: '5,5' };
          case 'parent':
          case 'child':
            return { stroke: '#60a5fa', strokeWidth: 1.5, strokeDasharray: '3,3' };
          case 'sibling':
            return { stroke: '#a78bfa', strokeWidth: 1.5, strokeDasharray: '3,3' };
          default:
            return { stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '2,2' };
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
          opacity: 0.2,
        },
        animated: false,
      };
    });
  }, [relationships]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = (event, node) => {
    if (node.type === 'person') {
      setSelectedPerson(node.data);
    }
  };

  return (
    <div className="fixed inset-0 z-0">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
        style={{
          background: 'transparent',
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background 
          color="#475569" 
          gap={60} 
          size={0.5}
          style={{ opacity: 0.1 }}
        />
      </ReactFlow>

      {/* Person Detail Card */}
      {selectedPerson && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-96">
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
        </div>
      )}

      {/* Click to dismiss overlay */}
      {selectedPerson && (
        <div 
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setSelectedPerson(null)}
        />
      )}
    </div>
  );
}