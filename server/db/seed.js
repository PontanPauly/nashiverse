import { pool } from './index.js';

export async function seedFamilyData({ force = false } = {}) {
  const client = await pool.connect();
  try {
    const { rows: existing } = await client.query('SELECT COUNT(*) as count FROM households');
    if (parseInt(existing[0].count) > 0 && !force) {
      console.log('Database already has data, skipping seed');
      return { seeded: false, message: 'Data already exists' };
    }

    console.log('Seeding initial family data...');
    await client.query('BEGIN');

    if (force) {
      console.log('Force seeding — clearing existing data...');
      const tablesToClean = [
        'messages', 'conversations', 'calendar_events', 'love_notes', 'moments',
        'family_stories', 'rituals', 'packing_items', 'shared_trip_items',
        'expenses', 'activities', 'rooms', 'meals', 'trip_participants', 'trips',
        'relationships', 'people', 'households', 'join_requests', 'family_settings'
      ];
      for (const table of tablesToClean) {
        try { await client.query(`DELETE FROM ${table}`); } catch {}
      }
    }

    const hIds = {};
    const pIds = {};

    async function createHousehold(key, name, description) {
      const { rows } = await client.query(
        `INSERT INTO households (name, description) VALUES ($1, $2) RETURNING id`,
        [name, description]
      );
      hIds[key] = rows[0].id;
    }

    async function createPerson(key, data) {
      const { rows } = await client.query(
        `INSERT INTO people (name, nickname, birth_date, role_type, household_id, allergies, dietary_preferences, is_deceased, about, medical_notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          data.name,
          data.nickname || null,
          data.birth_date || null,
          data.role_type || 'adult',
          hIds[data.household] || null,
          data.allergies || null,
          data.dietary_preferences || null,
          data.is_deceased || false,
          data.about || null,
          data.medical_notes || null,
        ]
      );
      pIds[key] = rows[0].id;
    }

    async function createRelationship(personKey, relatedKey, type) {
      await client.query(
        `INSERT INTO relationships (person_id, related_person_id, relationship_type) VALUES ($1, $2, $3)`,
        [pIds[personKey], pIds[relatedKey], type]
      );
    }

    async function createCalendarEvent(title, date, eventType, personKeys, color) {
      const personIdArray = personKeys.map(k => pIds[k]).filter(Boolean);
      await client.query(
        `INSERT INTO calendar_events (title, date, event_type, person_ids, color) VALUES ($1, $2, $3, $4, $5)`,
        [title, date, eventType, personIdArray, color]
      );
    }

    await createHousehold('randy_nancy', 'Randy & Nancy Nash', 'The Nash family homestead — where it all began');
    await createHousehold('angela_brian', 'Angela & Brian Goldsberry', 'The Goldsberry household');
    await createHousehold('james_lisa', 'James & Lisa Nash', 'The James Nash family');
    await createHousehold('jonathan_nicole', 'Jonathan & Nicole Nash', 'Jonathan and Nicole\'s place');
    await createHousehold('andrew', 'Andrew Nash', 'Andrew\'s household');
    await createHousehold('matthew_megan', 'Matthew & Megan Nash', 'Matt and Megan\'s home');
    await createHousehold('paul', 'Paul Nash', 'Paul\'s place');
    await createHousehold('craig_annie', 'Craig & Annie Nash', 'The Craig Nash household');
    await createHousehold('karen_lynn', 'Karen & Lynn Humpert', 'The Humpert household');

    await createPerson('randy', {
      name: 'Randy Nash', nickname: 'Dad', birth_date: '1963-03-15',
      role_type: 'adult', household: 'randy_nancy',
      about: 'Patriarch of the Nash family. The oldest of three siblings.',
      medical_notes: 'Blood pressure medication — lisinopril 10mg daily',
      allergies: ['sulfa drugs'],
    });
    await createPerson('nancy', {
      name: 'Nancy Nash', nickname: 'Mom', birth_date: '1964-07-22',
      role_type: 'adult', household: 'randy_nancy',
      about: 'Heart of the family. Keeps everyone connected.',
      dietary_preferences: ['low sodium'],
      allergies: ['penicillin'],
    });

    await createPerson('aunt_karen', {
      name: 'Karen Humpert', birth_date: '1966-11-08',
      role_type: 'adult', household: 'karen_lynn',
      is_deceased: true,
      about: 'Randy\'s younger sister. Deeply missed by the family.',
    });
    await createPerson('lynn', {
      name: 'Lynn Humpert', birth_date: '1964-09-14',
      role_type: 'adult', household: 'karen_lynn',
      about: 'Karen\'s husband.',
    });
    await createPerson('craig', {
      name: 'Craig Nash', birth_date: '1965-05-20',
      role_type: 'adult', household: 'craig_annie',
      about: 'Randy\'s brother. The middle Nash sibling.',
    });
    await createPerson('annie', {
      name: 'Annie Nash', birth_date: '1966-03-28',
      role_type: 'adult', household: 'craig_annie',
      about: 'Craig\'s wife.',
    });
    await createPerson('maddison', {
      name: 'Maddison Nash', birth_date: '1998-08-10',
      role_type: 'adult', household: 'craig_annie',
      about: 'Craig and Annie\'s daughter.',
    });

    await createPerson('angela', {
      name: 'Angela Goldsberry', nickname: 'Ang', birth_date: '1984-01-10',
      role_type: 'adult', household: 'angela_brian',
      about: 'The oldest Nash sibling. Married to Brian.',
      dietary_preferences: ['gluten-free'],
    });
    await createPerson('brian', {
      name: 'Brian Goldsberry', birth_date: '1982-09-03',
      role_type: 'adult', household: 'angela_brian',
      about: 'Angela\'s husband.',
      allergies: ['shellfish'],
    });

    await createPerson('james', {
      name: 'James Nash', birth_date: '1985-06-18',
      role_type: 'adult', household: 'james_lisa',
      about: 'Second oldest Nash sibling. Married to Lisa.',
    });
    await createPerson('lisa', {
      name: 'Lisa Nash', birth_date: '1987-02-14',
      role_type: 'adult', household: 'james_lisa',
      about: 'James\'s wife.',
      allergies: ['tree nuts'],
      dietary_preferences: ['vegetarian'],
    });

    await createPerson('jonathan', {
      name: 'Jonathan Nash', nickname: 'Jon', birth_date: '1986-04-25',
      role_type: 'adult', household: 'jonathan_nicole',
      about: 'Third Nash sibling. Married to Nicole.',
    });
    await createPerson('nicole', {
      name: 'Nicole Nash', birth_date: '1986-08-12',
      role_type: 'adult', household: 'jonathan_nicole',
      about: 'Jonathan\'s wife.',
      medical_notes: 'Seasonal allergies — cetirizine as needed',
      allergies: ['pollen', 'dust mites'],
    });

    await createPerson('andrew', {
      name: 'Andrew Nash', nickname: 'Drew', birth_date: '1987-10-30',
      role_type: 'adult', household: 'andrew',
      about: 'Fourth Nash sibling. Single dad of two.',
      allergies: ['dairy'],
      dietary_preferences: ['dairy-free'],
    });

    await createPerson('matthew', {
      name: 'Matthew Nash', nickname: 'Matt', birth_date: '1995-02-07',
      role_type: 'adult', household: 'matthew_megan',
      about: 'Paul\'s twin brother. Married to Megan.',
    });
    await createPerson('megan', {
      name: 'Megan Nash', birth_date: '1994-06-19',
      role_type: 'adult', household: 'matthew_megan',
      about: 'Matthew\'s wife.',
      dietary_preferences: ['pescatarian'],
    });

    await createPerson('paul', {
      name: 'Paul Nash', birth_date: '1995-02-07',
      role_type: 'adult', household: 'paul',
      about: 'The youngest Nash sibling. Matthew\'s twin.',
    });

    await createPerson('martin', {
      name: 'Martin Folker', birth_date: '2003-03-22',
      role_type: 'adult', household: 'angela_brian',
      about: 'Angela\'s oldest. No kids of his own yet.',
      allergies: ['peanuts'],
    });
    await createPerson('ava', {
      name: 'Ava Goldsberry', birth_date: '2004-08-15',
      role_type: 'adult', household: 'angela_brian',
      about: 'Angela and Brian\'s daughter.',
    });
    await createPerson('nash_g', {
      name: 'Nash Goldsberry', birth_date: '2007-12-01',
      role_type: 'teen', household: 'angela_brian',
      about: 'The youngest Goldsberry.',
    });

    await createPerson('mason', {
      name: 'Mason Nash', birth_date: '2014-04-11',
      role_type: 'child', household: 'james_lisa',
      allergies: ['bee stings'],
      medical_notes: 'Carries EpiPen for bee sting allergy',
    });
    await createPerson('harvey', {
      name: 'Harvey Nash', birth_date: '2015-09-28',
      role_type: 'child', household: 'james_lisa',
    });
    await createPerson('vivian', {
      name: 'Vivian Nash', birth_date: '2018-05-16',
      role_type: 'child', household: 'james_lisa',
      dietary_preferences: ['no spicy food'],
    });
    await createPerson('ethan', {
      name: 'Ethan Nash', birth_date: '2020-01-09',
      role_type: 'child', household: 'james_lisa',
      allergies: ['eggs'],
    });

    await createPerson('emmett', {
      name: 'Emmett Nash', birth_date: '2012-07-14',
      role_type: 'teen', household: 'andrew',
      about: 'Andrew\'s oldest.',
    });
    await createPerson('ella', {
      name: 'Ella Nash', birth_date: '2014-03-05',
      role_type: 'child', household: 'andrew',
      about: 'Andrew\'s daughter.',
      dietary_preferences: ['vegetarian'],
    });

    await createRelationship('randy', 'nancy', 'partner');
    await createRelationship('nancy', 'randy', 'partner');

    await createRelationship('randy', 'aunt_karen', 'sibling');
    await createRelationship('aunt_karen', 'randy', 'sibling');
    await createRelationship('randy', 'craig', 'sibling');
    await createRelationship('craig', 'randy', 'sibling');
    await createRelationship('aunt_karen', 'craig', 'sibling');
    await createRelationship('craig', 'aunt_karen', 'sibling');
    await createRelationship('craig', 'annie', 'partner');
    await createRelationship('annie', 'craig', 'partner');
    await createRelationship('craig', 'maddison', 'parent');
    await createRelationship('annie', 'maddison', 'parent');
    await createRelationship('aunt_karen', 'lynn', 'partner');
    await createRelationship('lynn', 'aunt_karen', 'partner');

    const nashChildren = ['angela', 'james', 'jonathan', 'andrew', 'matthew', 'paul'];
    for (const child of nashChildren) {
      await createRelationship('randy', child, 'parent');
      await createRelationship('nancy', child, 'parent');
    }
    for (let i = 0; i < nashChildren.length; i++) {
      for (let j = i + 1; j < nashChildren.length; j++) {
        await createRelationship(nashChildren[i], nashChildren[j], 'sibling');
        await createRelationship(nashChildren[j], nashChildren[i], 'sibling');
      }
    }

    await createRelationship('angela', 'brian', 'partner');
    await createRelationship('brian', 'angela', 'partner');
    for (const child of ['martin', 'ava', 'nash_g']) {
      await createRelationship('angela', child, 'parent');
      await createRelationship('brian', child, 'parent');
    }
    await createRelationship('martin', 'ava', 'sibling');
    await createRelationship('ava', 'martin', 'sibling');
    await createRelationship('martin', 'nash_g', 'sibling');
    await createRelationship('nash_g', 'martin', 'sibling');
    await createRelationship('ava', 'nash_g', 'sibling');
    await createRelationship('nash_g', 'ava', 'sibling');

    await createRelationship('james', 'lisa', 'partner');
    await createRelationship('lisa', 'james', 'partner');
    const jamesKids = ['mason', 'harvey', 'vivian', 'ethan'];
    for (const child of jamesKids) {
      await createRelationship('james', child, 'parent');
      await createRelationship('lisa', child, 'parent');
    }
    for (let i = 0; i < jamesKids.length; i++) {
      for (let j = i + 1; j < jamesKids.length; j++) {
        await createRelationship(jamesKids[i], jamesKids[j], 'sibling');
        await createRelationship(jamesKids[j], jamesKids[i], 'sibling');
      }
    }

    await createRelationship('jonathan', 'nicole', 'partner');
    await createRelationship('nicole', 'jonathan', 'partner');

    for (const child of ['emmett', 'ella']) {
      await createRelationship('andrew', child, 'parent');
    }
    await createRelationship('emmett', 'ella', 'sibling');
    await createRelationship('ella', 'emmett', 'sibling');

    await createRelationship('matthew', 'megan', 'partner');
    await createRelationship('megan', 'matthew', 'partner');

    await createCalendarEvent('Randy\'s Birthday', '2026-03-15', 'birthday', ['randy'], '#f59e0b');
    await createCalendarEvent('Nancy\'s Birthday', '2026-07-22', 'birthday', ['nancy'], '#ec4899');
    await createCalendarEvent('Angela\'s Birthday', '2026-01-10', 'birthday', ['angela'], '#ec4899');
    await createCalendarEvent('James\'s Birthday', '2026-06-18', 'birthday', ['james'], '#3b82f6');
    await createCalendarEvent('Jonathan\'s Birthday', '2026-04-25', 'birthday', ['jonathan'], '#3b82f6');
    await createCalendarEvent('Andrew\'s Birthday', '2026-10-30', 'birthday', ['andrew'], '#3b82f6');
    await createCalendarEvent('Matthew & Paul\'s Birthday', '2026-02-07', 'birthday', ['matthew', 'paul'], '#8b5cf6');
    await createCalendarEvent('Megan\'s Birthday', '2026-06-19', 'birthday', ['megan'], '#ec4899');
    await createCalendarEvent('Nash Family Reunion', '2026-07-04', 'gathering', [], '#10b981');
    await createCalendarEvent('Thanksgiving Dinner', '2026-11-26', 'gathering', [], '#f59e0b');
    await createCalendarEvent('Christmas Gathering', '2026-12-25', 'gathering', [], '#ef4444');

    await client.query(
      `INSERT INTO family_settings (family_name, tagline) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      ['The Nash Family', 'Our connected universe']
    );

    await client.query('COMMIT');
    const { rows: peopleCount } = await client.query('SELECT COUNT(*) as count FROM people');
    const { rows: householdCount } = await client.query('SELECT COUNT(*) as count FROM households');
    const { rows: relCount } = await client.query('SELECT COUNT(*) as count FROM relationships');
    console.log(`Seed complete: ${peopleCount[0].count} people, ${householdCount[0].count} households, ${relCount[0].count} relationships`);
    return {
      seeded: true,
      message: `Seeded ${peopleCount[0].count} people, ${householdCount[0].count} households, ${relCount[0].count} relationships`
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error);
    throw error;
  } finally {
    client.release();
  }
}
