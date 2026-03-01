import express from 'express';
import { pool } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

async function isAdmin(userId) {
  const { rows: userRows } = await pool.query(`SELECT role, email FROM users WHERE id = $1`, [userId]);
  if (!userRows.length) return false;
  if (userRows[0].role === 'admin') return true;
  const { rows: settingsRows } = await pool.query(`SELECT admin_emails FROM family_settings LIMIT 1`);
  const adminEmails = settingsRows[0]?.admin_emails || [];
  return adminEmails.includes(userRows[0].email);
}

async function requireAdminRole(req) {
  const admin = await isAdmin(req.session.userId);
  if (!admin) throw new Error('Admin privileges required');
}

const functionHandlers = {
  async exportFamilyData(req) {
    await requireAdminRole(req);
    const tables = [
      'people', 'households', 'relationships', 'trips', 'trip_participants',
      'meals', 'rooms', 'activities', 'expenses', 'packing_items',
      'shared_trip_items', 'moments', 'love_notes', 'family_stories',
      'family_settings', 'rituals', 'conversations', 'messages', 'calendar_events'
    ];
    const result = {};
    for (const table of tables) {
      try {
        const { rows } = await pool.query(`SELECT * FROM ${table}`);
        result[table] = rows;
      } catch {
        result[table] = [];
      }
    }
    return { data: result };
  },

  async makeAdmin(req) {
    const userId = req.session.userId;
    const { rows: userCount } = await pool.query(`SELECT COUNT(*) as count FROM users`);
    const { rows: adminCount } = await pool.query(`SELECT COUNT(*) as count FROM users WHERE role = 'admin'`);
    const isFirstUser = parseInt(userCount[0].count) <= 1 || parseInt(adminCount[0].count) === 0;

    if (!isFirstUser) {
      await requireAdminRole(req);
    }

    await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [userId]);
    const { rows } = await pool.query(`SELECT email FROM users WHERE id = $1`, [userId]);
    if (rows.length > 0) {
      await pool.query(`
        UPDATE family_settings
        SET admin_emails = array_append(
          COALESCE(admin_emails, ARRAY[]::TEXT[]),
          $1
        )
        WHERE NOT ($1 = ANY(COALESCE(admin_emails, ARRAY[]::TEXT[])))
      `, [rows[0].email]);
    }
    return { data: { success: true, role: 'admin' } };
  },

  async cleanupTestData(req) {
    const isProduction = process.env.NODE_ENV === 'production';
    const allowDestructive = process.env.ALLOW_DESTRUCTIVE_ADMIN === 'true';
    if (isProduction && !allowDestructive) {
      throw new Error('Destructive operations are not allowed in production');
    }
    await requireAdminRole(req);
    const tablesToClean = [
      'messages', 'conversations', 'calendar_events', 'love_notes', 'moments',
      'family_stories', 'rituals', 'packing_items', 'shared_trip_items',
      'expenses', 'activities', 'rooms', 'meals', 'trip_participants', 'trips',
      'relationships', 'people', 'households', 'join_requests', 'family_settings'
    ];
    for (const table of tablesToClean) {
      try {
        await pool.query(`DELETE FROM ${table}`);
      } catch {
      }
    }
    return { data: { success: true, message: 'Test data cleaned up' } };
  },

  async getFamilyInsights() {
    return { data: { insight: 'Family insights feature coming soon! This will provide AI-powered observations about your family universe.' } };
  }
};

router.post('/:functionName', requireAuth, async (req, res) => {
  try {
    const { functionName } = req.params;
    const handler = functionHandlers[functionName];
    if (!handler) {
      return res.status(404).json({ error: `Function '${functionName}' not found` });
    }
    const result = await handler(req);
    res.json(result);
  } catch (error) {
    console.error(`Function ${req.params.functionName} error:`, error);
    const statusCode = error.message === 'Admin privileges required' ? 403 : 500;
    res.status(statusCode).json({ error: error.message || 'Function execution failed' });
  }
});

export default router;
