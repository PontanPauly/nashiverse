import express from 'express';
import { pool } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const entityToTable = {
  Person: 'people',
  Trip: 'trips',
  Household: 'households',
  Relationship: 'relationships',
  TripParticipant: 'trip_participants',
  Meal: 'meals',
  Room: 'rooms',
  Activity: 'activities',
  Expense: 'expenses',
  PackingItem: 'packing_items',
  SharedTripItem: 'shared_trip_items',
  Moment: 'moments',
  LoveNote: 'love_notes',
  FamilyStory: 'family_stories',
  FamilySettings: 'family_settings',
  FamilySetting: 'family_settings',
  JoinRequest: 'join_requests',
  Ritual: 'rituals',
  Conversation: 'conversations',
  Message: 'messages',
  User: 'users',
  // Lowercase versions for direct table access
  people: 'people',
  trips: 'trips',
  households: 'households',
  relationships: 'relationships',
  trip_participants: 'trip_participants',
  meals: 'meals',
  rooms: 'rooms',
  activities: 'activities',
  expenses: 'expenses',
  packing_items: 'packing_items',
  shared_trip_items: 'shared_trip_items',
  moments: 'moments',
  love_notes: 'love_notes',
  family_stories: 'family_stories',
  family_settings: 'family_settings',
  join_requests: 'join_requests',
  rituals: 'rituals',
  conversations: 'conversations',
  messages: 'messages',
  users: 'users'
};

function getTableName(entityType) {
  return entityToTable[entityType] || entityType.toLowerCase() + 's';
}

router.get('/:type', requireAuth, async (req, res) => {
  try {
    const { type } = req.params;
    const { sort, limit } = req.query;
    const tableName = getTableName(type);

    let query = `SELECT * FROM ${tableName}`;
    const params = [];

    if (sort) {
      const sortFields = sort.split(',').map(field => {
        if (field.startsWith('-')) {
          return `${field.substring(1)} DESC`;
        }
        return `${field} ASC`;
      });
      query += ` ORDER BY ${sortFields.join(', ')}`;
    }

    if (limit) {
      params.push(parseInt(limit, 10));
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
    const tableName = getTableName(type);
    const filters = { ...req.query };

    delete filters.sort;
    delete filters.limit;

    let query = `SELECT * FROM ${tableName}`;
    const conditions = [];
    const params = [];

    Object.entries(filters).forEach(([key, value]) => {
      params.push(value);
      conditions.push(`${key} = $${params.length}`);
    });

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    if (req.query.sort) {
      const sortFields = req.query.sort.split(',').map(field => {
        if (field.startsWith('-')) {
          return `${field.substring(1)} DESC`;
        }
        return `${field} ASC`;
      });
      query += ` ORDER BY ${sortFields.join(', ')}`;
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
    const tableName = getTableName(type);
    const data = req.body;

    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
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
    const tableName = getTableName(type);
    const data = req.body;

    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

    values.push(id);
    const query = `UPDATE ${tableName} SET ${setClause} WHERE id = $${values.length} RETURNING *`;
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
    const tableName = getTableName(type);

    const result = await pool.query(`DELETE FROM ${tableName} WHERE id = $1 RETURNING *`, [id]);

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
