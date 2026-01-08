import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    // Delete all data entities
    const entitiesToClear = [
      'Moment',
      'LoveNote',
      'Activity',
      'SharedTripItem',
      'ShoppingItem',
      'PackingItem',
      'Expense',
      'Meal',
      'Room',
      'TripParticipant',
      'Trip',
      'FamilyStory',
      'Ritual',
      'CalendarEvent',
      'Message',
      'Conversation',
      'Relationship',
      'Person',
      'Household',
      'JoinRequest',
      'FamilySettings',
    ];

    const results = {};

    for (const entity of entitiesToClear) {
      const records = await base44.asServiceRole.entities[entity].list();
      results[entity] = { total: records.length, deleted: 0 };

      for (const record of records) {
        await base44.asServiceRole.entities[entity].delete(record.id);
        results[entity].deleted++;
      }
    }

    return Response.json({
      success: true,
      message: 'All test data cleared',
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});