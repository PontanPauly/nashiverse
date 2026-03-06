import express from 'express';
import { pool } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const entityConfig = {
  Person: {
    table: 'people',
    columns: ['id', 'name', 'nickname', 'photo_url', 'birth_date', 'birth_year', 'death_date', 'role_type', 'household_id', 'household_status', 'linked_user_email', 'allergies', 'dietary_preferences', 'is_deceased', 'about', 'medical_notes', 'star_profile', 'guardian_ids', 'star_pattern', 'star_intensity', 'star_flare_count', 'created_at']
  },
  Trip: {
    table: 'trips',
    columns: ['id', 'name', 'location', 'description', 'start_date', 'end_date', 'cover_image_url', 'planner_ids', 'visibility', 'status', 'created_at']
  },
  Household: {
    table: 'households',
    columns: ['id', 'name', 'description', 'created_at']
  },
  Relationship: {
    table: 'relationships',
    columns: ['id', 'person_id', 'related_person_id', 'relationship_type', 'subtype']
  },
  TripParticipant: {
    table: 'trip_participants',
    columns: ['id', 'trip_id', 'person_id', 'status', 'room_id']
  },
  Meal: {
    table: 'meals',
    columns: ['id', 'trip_id', 'date', 'meal_type', 'title', 'description', 'chef_ids', 'location', 'notes']
  },
  Room: {
    table: 'rooms',
    columns: ['id', 'trip_id', 'name', 'capacity', 'notes', 'assigned_person_ids']
  },
  Activity: {
    table: 'activities',
    columns: ['id', 'trip_id', 'name', 'date', 'time', 'location', 'description', 'organizer_ids']
  },
  Expense: {
    table: 'expenses',
    columns: ['id', 'trip_id', 'description', 'amount', 'paid_by_person_id', 'category', 'date', 'split_among_ids']
  },
  PackingItem: {
    table: 'packing_items',
    columns: ['id', 'trip_id', 'person_id', 'item', 'category', 'is_packed']
  },
  SharedTripItem: {
    table: 'shared_trip_items',
    columns: ['id', 'trip_id', 'item', 'assigned_to_person_id', 'is_confirmed']
  },
  Moment: {
    table: 'moments',
    columns: ['id', 'content', 'media_urls', 'media_type', 'trip_id', 'tagged_person_ids', 'captured_date', 'author_person_id', 'created_date']
  },
  LoveNote: {
    table: 'love_notes',
    columns: ['id', 'content', 'from_person_id', 'to_person_id', 'trip_id', 'created_date']
  },
  FamilyStory: {
    table: 'family_stories',
    columns: ['id', 'title', 'content', 'author_person_id', 'related_person_ids', 'era', 'created_date']
  },
  FamilySettings: {
    table: 'family_settings',
    columns: ['id', 'family_name', 'invite_code', 'timezone', 'tagline', 'admin_emails', 'planner_emails', 'created_at']
  },
  FamilySetting: {
    table: 'family_settings',
    columns: ['id', 'family_name', 'invite_code', 'timezone', 'tagline', 'admin_emails', 'planner_emails', 'created_at']
  },
  JoinRequest: {
    table: 'join_requests',
    columns: ['id', 'email', 'message', 'status', 'reviewed_by_email', 'reviewed_at', 'created_at']
  },
  Ritual: {
    table: 'rituals',
    columns: ['id', 'name', 'description', 'frequency', 'assigned_person_ids', 'household_id', 'next_occurrence', 'category', 'created_at']
  },
  Conversation: {
    table: 'conversations',
    columns: ['id', 'participant_ids', 'created_date']
  },
  Message: {
    table: 'messages',
    columns: ['id', 'conversation_id', 'from_person_id', 'content', 'is_read', 'created_date']
  },
  CalendarEvent: {
    table: 'calendar_events',
    columns: ['id', 'title', 'description', 'date', 'event_type', 'person_ids', 'is_recurring', 'color', 'created_at']
  }
};

const lowercaseMap = {};
for (const [key, config] of Object.entries(entityConfig)) {
  lowercaseMap[key] = config;
  lowercaseMap[config.table] = config;
}

function getConfig(entityType) {
  return lowercaseMap[entityType] || null;
}

function isValidColumn(col) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col);
}

function filterColumns(data, allowedColumns) {
  const filtered = {};
  for (const [key, value] of Object.entries(data)) {
    if (allowedColumns.includes(key) && key !== 'id') {
      filtered[key] = value;
    }
  }
  return filtered;
}

router.get('/:type', requireAuth, async (req, res) => {
  try {
    const { type } = req.params;
    const config = getConfig(type);
    if (!config) {
      return res.status(403).json({ error: `Entity type '${type}' is not allowed` });
    }

    let query = `SELECT * FROM ${config.table}`;
    const params = [];

    if (req.query.sort) {
      const sortFields = req.query.sort.split(',').map(field => {
        const desc = field.startsWith('-');
        const col = desc ? field.substring(1) : field;
        if (!isValidColumn(col) || !config.columns.includes(col)) return null;
        return `${col} ${desc ? 'DESC' : 'ASC'}`;
      }).filter(Boolean);
      if (sortFields.length > 0) {
        query += ` ORDER BY ${sortFields.join(', ')}`;
      }
    }

    if (req.query.limit) {
      params.push(parseInt(req.query.limit, 10));
      query += ` LIMIT $${params.length}`;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('List entities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:type/filter', requireAuth, async (req, res) => {
  try {
    const { type } = req.params;
    const config = getConfig(type);
    if (!config) {
      return res.status(403).json({ error: `Entity type '${type}' is not allowed` });
    }

    const filters = { ...req.query };
    delete filters.sort;
    delete filters.limit;

    let query = `SELECT * FROM ${config.table}`;
    const conditions = [];
    const params = [];

    Object.entries(filters).forEach(([key, value]) => {
      if (isValidColumn(key) && config.columns.includes(key)) {
        params.push(value);
        conditions.push(`${key} = $${params.length}`);
      }
    });

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    if (req.query.sort) {
      const sortFields = req.query.sort.split(',').map(field => {
        const desc = field.startsWith('-');
        const col = desc ? field.substring(1) : field;
        if (!isValidColumn(col) || !config.columns.includes(col)) return null;
        return `${col} ${desc ? 'DESC' : 'ASC'}`;
      }).filter(Boolean);
      if (sortFields.length > 0) {
        query += ` ORDER BY ${sortFields.join(', ')}`;
      }
    }

    if (req.query.limit) {
      params.push(parseInt(req.query.limit, 10));
      query += ` LIMIT $${params.length}`;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Filter entities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:type', requireAuth, async (req, res) => {
  try {
    const { type } = req.params;
    const config = getConfig(type);
    if (!config) {
      return res.status(403).json({ error: `Entity type '${type}' is not allowed` });
    }

    const data = filterColumns(req.body, config.columns);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid columns provided' });
    }

    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    const query = `INSERT INTO ${config.table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const result = await pool.query(query, values);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create entity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:type/:id', requireAuth, async (req, res) => {
  try {
    const { type, id } = req.params;
    const config = getConfig(type);
    if (!config) {
      return res.status(403).json({ error: `Entity type '${type}' is not allowed` });
    }

    const data = filterColumns(req.body, config.columns);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid columns provided' });
    }

    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

    values.push(id);
    const query = `UPDATE ${config.table} SET ${setClause} WHERE id = $${values.length} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update entity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:type/:id', requireAuth, async (req, res) => {
  try {
    const { type, id } = req.params;
    const config = getConfig(type);
    if (!config) {
      return res.status(403).json({ error: `Entity type '${type}' is not allowed` });
    }

    const result = await pool.query(`DELETE FROM ${config.table} WHERE id = $1 RETURNING *`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    res.json({ message: 'Entity deleted successfully', deleted: result.rows[0] });
  } catch (error) {
    console.error('Delete entity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
