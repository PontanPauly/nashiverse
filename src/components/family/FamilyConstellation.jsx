import React, { useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { User, Baby, UserCheck, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const PersonNode = ({ data }) => {
  const getRoleIcon = (roleType) => {
    switch(roleType) {
      case 'adult': return User;
      case 'teen': return UserCheck;
      case 'child': return Baby;
      case 'ancestor': return Star;
      default: return User;
    }
  };

  const RoleIcon = getRoleIcon(data.role_type);

  return (
    <div className={cn(
      "px-4 py-3 rounded-xl border-2 transition-all cursor-pointer hover:scale-105",
      "glass-card",
      data.is_deceased ? "opacity-60 border-slate-600" : "border-amber-500/50"
    )}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
          {data.photo_url ? (
            <img src={data.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-medium text-slate-400">
              {data.name?.charAt(0)}
            </span>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-100">{data.name}</span>
            {data.is_deceased && <Star className="w-3 h-3 text-amber-400" />}
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <RoleIcon className="w-3 h-3" />
            <span>{data.role_type}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const nodeTypes = {
  person: PersonNode,
};

export default function FamilyConstellation({ people, households, relationships }) {
  // Create nodes from people
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
    let yOffset = 0;

    // Create nodes for each household group
    Object.entries(householdGroups).forEach(([householdId, groupPeople], groupIndex) => {
      const household = households.find(h => h.id === householdId);
      const householdName = household?.name || 'Unassigned';
      
      // Add household label node
      nodes.push({
        id: `household-${householdId}`,
        type: 'default',
        data: { label: householdName },
        position: { x: 50, y: yOffset },
        style: {
          background: 'rgba(251, 191, 36, 0.1)',
          border: '2px solid rgba(251, 191, 36, 0.3)',
          borderRadius: '12px',
          padding: '8px 16px',
          color: '#fbbf24',
          fontSize: '14px',
          fontWeight: '600',
        },
        draggable: false,
      });

      yOffset += 60;

      // Position people in this household
      groupPeople.forEach((person, index) => {
        const xOffset = 50 + (index % 4) * 250;
        const yRow = Math.floor(index / 4);
        
        nodes.push({
          id: person.id,
          type: 'person',
          data: person,
          position: { x: xOffset, y: yOffset + yRow * 100 },
        });
      });

      yOffset += Math.ceil(groupPeople.length / 4) * 100 + 100;
    });

    return nodes;
  }, [people, households]);

  // Create edges from relationships
  const initialEdges = useMemo(() => {
    return relationships.map((rel, index) => {
      const getEdgeStyle = (relType) => {
        switch(relType) {
          case 'spouse':
            return { stroke: '#ec4899', strokeWidth: 3 };
          case 'parent':
          case 'child':
            return { stroke: '#60a5fa', strokeWidth: 2 };
          case 'sibling':
            return { stroke: '#a78bfa', strokeWidth: 2 };
          default:
            return { stroke: '#94a3b8', strokeWidth: 1.5 };
        }
      };

      const style = getEdgeStyle(rel.relationship_type);

      return {
        id: `edge-${index}`,
        source: rel.person_id,
        target: rel.related_person_id,
        type: 'smoothstep',
        animated: rel.relationship_type === 'spouse',
        style,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: style.stroke,
        },
        label: rel.relationship_type,
        labelStyle: { 
          fill: '#cbd5e1', 
          fontSize: 10,
          fontWeight: 500,
        },
        labelBgStyle: { 
          fill: '#1e293b', 
          fillOpacity: 0.8,
        },
      };
    });
  }, [relationships]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="w-full h-[calc(100vh-250px)] glass-card rounded-2xl overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Background 
          color="#475569" 
          gap={20} 
          size={1}
          style={{ opacity: 0.2 }}
        />
        <Controls 
          className="bg-slate-800 border-slate-700"
          style={{ button: { background: '#1e293b', color: '#cbd5e1' } }}
        />
        <MiniMap 
          nodeColor={(node) => {
            if (node.type === 'person') {
              return node.data.is_deceased ? '#475569' : '#fbbf24';
            }
            return '#fbbf24';
          }}
          className="bg-slate-800/80 border border-slate-700"
          maskColor="rgba(15, 23, 42, 0.6)"
        />
      </ReactFlow>
    </div>
  );
}