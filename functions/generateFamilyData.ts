import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user's person record
    const people = await base44.asServiceRole.entities.Person.list();
    const myPerson = people.find(p => p.linked_user_email === user.email);

    // Delete all people except current user's
    const peopleToDelete = people.filter(p => p.id !== myPerson?.id);
    for (const person of peopleToDelete) {
      await base44.asServiceRole.entities.Person.delete(person.id);
    }

    // Delete all relationships
    const relationships = await base44.asServiceRole.entities.Relationship.list();
    for (const rel of relationships) {
      await base44.asServiceRole.entities.Relationship.delete(rel.id);
    }

    // Delete all households
    const households = await base44.asServiceRole.entities.Household.list();
    for (const household of households) {
      await base44.asServiceRole.entities.Household.delete(household.id);
    }

    // Make current user admin
    await base44.asServiceRole.entities.User.update(user.id, { role: 'admin' });

    // Generate realistic family data using AI
    const familyData = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate realistic family data for 50 people across 4 generations. Include:
      - 12 households with creative family names
      - Mix of ancestors (generation 0), adults (generation 1-2), teens, and children
      - Varied birth years appropriate for each generation
      - Some people should be deceased (ancestors mainly)
      - Realistic mix of allergies (peanuts, shellfish, etc.) - maybe 15% have allergies
      - Dietary preferences (vegetarian, vegan, pescatarian) - maybe 20% have preferences
      - Some have nicknames, some don't
      - Varied "about" descriptions (hobbies, personalities)
      - Medical notes for those with serious conditions (maybe 5%)
      - Mix of star patterns and customizations
      - Clear parent-child relationships spanning 4 generations
      - Spouse/partner relationships
      - Sibling relationships
      
      Return a detailed family structure with proper generational hierarchy.`,
      response_json_schema: {
        type: "object",
        properties: {
          households: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                color: { type: "string" }
              }
            }
          },
          people: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                nickname: { type: "string" },
                birth_year: { type: "number" },
                role_type: { type: "string" },
                is_deceased: { type: "boolean" },
                death_year: { type: "number" },
                household_index: { type: "number" },
                allergies: { type: "array", items: { type: "string" } },
                dietary_preferences: { type: "array", items: { type: "string" } },
                medical_notes: { type: "string" },
                about: { type: "string" },
                star_pattern: { type: "string" },
                star_intensity: { type: "number" },
                star_flare_count: { type: "number" }
              }
            }
          },
          relationships: {
            type: "array",
            items: {
              type: "object",
              properties: {
                person_index: { type: "number" },
                related_person_index: { type: "number" },
                relationship_type: { type: "string" }
              }
            }
          }
        }
      }
    });

    // Create households first
    const householdIds = [];
    for (const household of familyData.households) {
      const created = await base44.asServiceRole.entities.Household.create(household);
      householdIds.push(created.id);
    }

    // Create people
    const personIds = [];
    for (const person of familyData.people) {
      const personData = {
        name: person.name,
        nickname: person.nickname || null,
        birth_year: person.birth_year,
        role_type: person.role_type,
        is_deceased: person.is_deceased || false,
        death_date: person.death_year ? `${person.death_year}-01-01` : null,
        household_id: householdIds[person.household_index] || householdIds[0],
        allergies: person.allergies || [],
        dietary_preferences: person.dietary_preferences || [],
        medical_notes: person.medical_notes || null,
        about: person.about || null,
        star_pattern: person.star_pattern || 'classic',
        star_intensity: person.star_intensity || 5,
        star_flare_count: person.star_flare_count || 8
      };
      
      const created = await base44.asServiceRole.entities.Person.create(personData);
      personIds.push(created.id);
    }

    // Update current user's person to be in a household if exists
    if (myPerson && householdIds.length > 0) {
      await base44.asServiceRole.entities.Person.update(myPerson.id, {
        household_id: householdIds[0]
      });
    }

    // Create relationships
    for (const rel of familyData.relationships) {
      await base44.asServiceRole.entities.Relationship.create({
        person_id: personIds[rel.person_index],
        related_person_id: personIds[rel.related_person_index],
        relationship_type: rel.relationship_type
      });
    }

    return Response.json({ 
      success: true, 
      message: `Generated ${familyData.people.length} people across ${familyData.households.length} households with ${familyData.relationships.length} relationships` 
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});