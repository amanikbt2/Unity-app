import * as SQLite from 'expo-sqlite';

let dbInstance = null;

/**
 * Initializes and retrieves the local SQLite database instance.
 */
export async function getDatabase() {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('unity_offline.db');
  }
  return dbInstance;
}

/**
 * Initializes database tables.
 */
export async function initDatabase() {
  try {
    const db = await getDatabase();
    
    // Create contacts table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        name TEXT,
        phone TEXT,
        email TEXT,
        flag TEXT,
        status TEXT,
        is_synced INTEGER DEFAULT 0,
        avatar TEXT
      );
    `);

    // Create chats table (stores only text translations, not raw voice files)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        partner_id TEXT,
        text TEXT,
        trans_text TEXT,
        sender TEXT,
        orig_lang TEXT,
        trans_lang TEXT,
        timestamp INTEGER
      );
    `);

    // Create posts table for TikTok-style offline scrolling feed
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        author_name TEXT,
        content TEXT,
        flag TEXT,
        time TEXT,
        image_local_path TEXT,
        avatar_local_path TEXT,
        likes INTEGER,
        liked INTEGER,
        timestamp INTEGER
      );
    `);

    // Create explore_profiles table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS explore_profiles (
        id TEXT PRIMARY KEY,
        name TEXT,
        flag TEXT,
        lang_name TEXT,
        bio TEXT,
        avatar_local_path TEXT
      );
    `);

    console.log('[Database] Database tables initialized successfully.');
    return true;
  } catch (error) {
    console.error('[Database] Initialization error:', error);
    return false;
  }
}

/* ==========================================================================
   CONTACTS DATABASE OPERATIONS
   ========================================================================== */

export async function getContacts() {
  try {
    const db = await getDatabase();
    return await db.getAllAsync('SELECT * FROM contacts ORDER BY name ASC;');
  } catch (error) {
    console.error('[Database] getContacts error:', error);
    return [];
  }
}

export async function saveContacts(contactsArray) {
  try {
    const db = await getDatabase();
    for (const contact of contactsArray) {
      await db.runAsync(
        `INSERT OR REPLACE INTO contacts (id, name, phone, email, flag, status, is_synced, avatar) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          contact.id,
          contact.name,
          contact.phone || '',
          contact.email || '',
          contact.flag || '🌍',
          contact.status || '',
          contact.is_synced ? 1 : 0,
          contact.avatar || ''
        ]
      );
    }
    return true;
  } catch (error) {
    console.error('[Database] saveContacts error:', error);
    return false;
  }
}

/* ==========================================================================
   CHATS DATABASE OPERATIONS (TEXT ONLY)
   ========================================================================== */

export async function getChats(partnerId) {
  try {
    const db = await getDatabase();
    return await db.getAllAsync(
      'SELECT * FROM chats WHERE partner_id = ? ORDER BY timestamp ASC;',
      [partnerId]
    );
  } catch (error) {
    console.error('[Database] getChats error:', error);
    return [];
  }
}

export async function saveChat(chatBubble) {
  try {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO chats (id, partner_id, text, trans_text, sender, orig_lang, trans_lang, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        chatBubble.id,
        chatBubble.partner_id,
        chatBubble.text,
        chatBubble.trans_text || '',
        chatBubble.sender, // 'user' or 'partner'
        chatBubble.orig_lang || '',
        chatBubble.trans_lang || '',
        chatBubble.timestamp || Date.now()
      ]
    );
    return true;
  } catch (error) {
    console.error('[Database] saveChat error:', error);
    return false;
  }
}

/* ==========================================================================
   POSTS DATABASE OPERATIONS
   ========================================================================== */

export async function getPosts() {
  try {
    const db = await getDatabase();
    return await db.getAllAsync('SELECT * FROM posts ORDER BY timestamp DESC;');
  } catch (error) {
    console.error('[Database] getPosts error:', error);
    return [];
  }
}

export async function savePosts(postsArray) {
  try {
    const db = await getDatabase();
    for (const post of postsArray) {
      await db.runAsync(
        `INSERT OR REPLACE INTO posts (id, author_name, content, flag, time, image_local_path, avatar_local_path, likes, liked, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          post.id,
          post.authorName,
          post.content,
          post.flag || '🇺🇸',
          post.time || '',
          post.image_local_path || '',
          post.avatar_local_path || '',
          post.likes || 0,
          post.liked ? 1 : 0,
          post.timestamp || Date.now()
        ]
      );
    }
    return true;
  } catch (error) {
    console.error('[Database] savePosts error:', error);
    return false;
  }
}

/* ==========================================================================
   EXPLORE PROFILES DATABASE OPERATIONS
   ========================================================================== */

export async function getExploreProfiles() {
  try {
    const db = await getDatabase();
    return await db.getAllAsync('SELECT * FROM explore_profiles ORDER BY name ASC;');
  } catch (error) {
    console.error('[Database] getExploreProfiles error:', error);
    return [];
  }
}

export async function saveExploreProfiles(profilesArray) {
  try {
    const db = await getDatabase();
    for (const profile of profilesArray) {
      await db.runAsync(
        `INSERT OR REPLACE INTO explore_profiles (id, name, flag, lang_name, bio, avatar_local_path) 
         VALUES (?, ?, ?, ?, ?, ?);`,
        [
          profile.id,
          profile.name,
          profile.flag || '🌍',
          profile.langName || '',
          profile.bio || '',
          profile.avatar_local_path || ''
        ]
      );
    }
    return true;
  } catch (error) {
    console.error('[Database] saveExploreProfiles error:', error);
    return false;
  }
}

/* ==========================================================================
   CLEANUP & RESET
   ========================================================================== */

export async function clearDatabase() {
  try {
    const db = await getDatabase();
    await db.execAsync('DELETE FROM chats;');
    await db.execAsync('DELETE FROM contacts;');
    await db.execAsync('DELETE FROM posts;');
    await db.execAsync('DELETE FROM explore_profiles;');
    console.log('[Database] Database tables cleared.');
    return true;
  } catch (error) {
    console.error('[Database] clearDatabase error:', error);
    return false;
  }
}
