import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function LineageView({ people, relationships, onPersonClick }) {
  const [expanded, setExpanded] = useState(new Set());

  const toggleExpand = (personId) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(personId)) {
      newExpanded.delete(personId);
    } else {
      newExpanded.add(personId);
    }
    setExpanded(newExpanded);
  };

  // Build relationship map
  const relationshipMap = useMemo(() => {
    const map = {
      parents: new Map(), // child -> [parent1, parent2]
      children: new Map(), // parent -> [child1, child2, ...]
      partners: new Map(), // person -> partner
    };

    relationships.forEach(rel => {
      if (rel.relationship_type === 'parent') {
        // rel.person_id is parent, rel.related_person_id is child
        if (!map.children.has(rel.person_id)) {
          map.children.set(rel.person_id, []);
        }
        map.children.get(rel.person_id).push(rel.related_person_id);

        if (!map.parents.has(rel.related_person_id)) {
          map.parents.set(rel.related_person_id, []);
        }
        map.parents.get(rel.related_person_id).push(rel.person_id);
      } else if (rel.relationship_type === 'partner') {
        map.partners.set(rel.person_id, rel.related_person_id);
        map.partners.set(rel.related_person_id, rel.person_id);
      }
    });

    return map;
  }, [relationships]);

  // Find root people (no parents)
  const roots = useMemo(() => {
    return people.filter(p => !relationshipMap.parents.has(p.id))
      .sort((a, b) => {
        // Ancestors first, then by name
        if (a.is_deceased !== b.is_deceased) return a.is_deceased ? -1 : 1;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [people, relationshipMap]);

  const PersonNode = ({ person, level = 0 }) => {
    const children = relationshipMap.children.get(person.id) || [];
    const partnerId = relationshipMap.partners.get(person.id);
    const partner = partnerId ? people.find(p => p.id === partnerId) : null;
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(person.id);

    const roleColor = 
      person.role_type === 'adult' ? 'text-blue-400' :
      person.role_type === 'teen' ? 'text-purple-400' :
      person.role_type === 'child' ? 'text-green-400' :
      'text-amber-400';

    return (
      <div className="relative">
        <div 
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer group",
            level > 0 && "ml-8"
          )}
          style={{ marginLeft: level > 0 ? `${level * 2}rem` : 0 }}
        >
          {/* Expand button */}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(person.id);
              }}
              className="text-slate-500 hover:text-slate-300"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}
          {!hasChildren && <div className="w-4" />}

          {/* Person info */}
          <div 
            className="flex items-center gap-3 flex-1"
            onClick={() => onPersonClick(person)}
          >
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
              {person.photo_url ? (
                <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-medium text-slate-400">
                  {person.name?.charAt(0)}
                </span>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className={cn("font-medium", roleColor)}>{person.name}</h3>
                {partner && (
                  <>
                    <span className="text-slate-600">&</span>
                    <h3 className={cn("font-medium", roleColor)}>{partner.name}</h3>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs border-slate-700 text-slate-500">
                  {person.role_type}
                </Badge>
                {hasChildren && (
                  <span className="text-xs text-slate-600">
                    {children.length} {children.length === 1 ? 'child' : 'children'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="mt-1">
            {children.map(childId => {
              const child = people.find(p => p.id === childId);
              if (!child) return null;
              return (
                <PersonNode
                  key={child.id}
                  person={child}
                  level={level + 1}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (roots.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center">
        <Users className="w-16 h-16 text-slate-700 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-200 mb-2">No Family Connections Yet</h2>
        <p className="text-slate-500 max-w-md mx-auto">
          Add relationships between family members to see the lineage tree.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="space-y-2">
        {roots.map(person => (
          <PersonNode key={person.id} person={person} level={0} />
        ))}
      </div>
    </div>
  );
}