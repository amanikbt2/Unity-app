import * as SQLite from "expo-sqlite";

let dbInstance = null;

const POSTS_SCHEMA_COLUMNS = {
  author_email: "TEXT",
  author_avatar: "TEXT",
  author_flag: "TEXT",
  author_native_lang: "TEXT",
  image_url: "TEXT",
  media_type: "TEXT",
  background_key: "TEXT",
  description: "TEXT",
  comments: "TEXT DEFAULT '[]'",
};

function parseJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizePostRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    authorName: row.author_name || row.authorName || "",
    authorEmail: row.author_email || row.authorEmail || "",
    authorAvatar:
      row.author_avatar || row.authorAvatar || row.avatar_local_path || "",
    authorFlag: row.author_flag || row.authorFlag || row.flag || "",
    authorNativeLang: row.author_native_lang || row.authorNativeLang || "",
    content: row.content || "",
    flag: row.flag || row.author_flag || "🌍",
    time: row.time || "",
    image: row.image_url || row.image_local_path || "",
    imageUrl: row.image_url || "",
    image_local_path: row.image_local_path || "",
    mediaType:
      row.media_type ||
      row.mediaType ||
      (row.image_url || row.image_local_path ? "image" : "text"),
    backgroundKey: row.background_key || row.backgroundKey || "",
    description: row.description || "",
    avatar: row.author_avatar || row.avatar_local_path || "",
    avatar_local_path: row.avatar_local_path || "",
    likes: Number(row.likes || 0),
    liked: Boolean(row.liked),
    comments: parseJsonArray(row.comments),
    timestamp: Number(row.timestamp || Date.now()),
  };
}

function normalizeContactRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || "",
    phone: row.phone || "",
    email: row.email || "",
    flag: row.flag || "🌍",
    status: row.status || "",
    is_synced: Boolean(row.is_synced),
    avatar: row.avatar || "",
    langName: row.lang_name || row.langName || "",
    isUnityUser: Boolean(row.is_unity_user),
    unreadCount: Number(row.unread_count || 0),
    lastMessageTime: Number(row.last_message_time || 0),
  };
}

function normalizeExploreRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || "",
    flag: row.flag || "🌍",
    langName: row.lang_name || row.langName || "",
    bio: row.bio || "",
    avatar: row.avatar_local_path || row.avatar || "",
    avatar_local_path: row.avatar_local_path || "",
  };
}

/**
 * Initializes and retrieves the local SQLite database instance.
 */
export async function getDatabase() {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync("unity_offline.db");
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
        avatar TEXT,
        is_unity_user INTEGER DEFAULT 0,
        unread_count INTEGER DEFAULT 0,
        last_message_time INTEGER DEFAULT 0
      );
    `);

    const contactColumns = await db.getAllAsync("PRAGMA table_info(contacts);");
    const existingContactColumns = new Set(
      contactColumns.map((column) => column.name),
    );
    if (!existingContactColumns.has("is_unity_user")) {
      await db.execAsync(
        "ALTER TABLE contacts ADD COLUMN is_unity_user INTEGER DEFAULT 0;",
      );
    }
    if (!existingContactColumns.has("unread_count")) {
      await db.execAsync(
        "ALTER TABLE contacts ADD COLUMN unread_count INTEGER DEFAULT 0;",
      );
    }
    if (!existingContactColumns.has("last_message_time")) {
      await db.execAsync(
        "ALTER TABLE contacts ADD COLUMN last_message_time INTEGER DEFAULT 0;",
      );
    }

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
        author_email TEXT,
        author_avatar TEXT,
        author_flag TEXT,
        author_native_lang TEXT,
        content TEXT,
        flag TEXT,
        time TEXT,
        image_local_path TEXT,
        image_url TEXT,
        media_type TEXT,
        background_key TEXT,
        description TEXT,
        avatar_local_path TEXT,
        likes INTEGER,
        liked INTEGER,
        comments TEXT DEFAULT '[]',
        timestamp INTEGER
      );
    `);

    const postColumns = await db.getAllAsync("PRAGMA table_info(posts);");
    const existingPostColumns = new Set(
      postColumns.map((column) => column.name),
    );
    for (const [columnName, columnType] of Object.entries(
      POSTS_SCHEMA_COLUMNS,
    )) {
      if (!existingPostColumns.has(columnName)) {
        await db.execAsync(
          `ALTER TABLE posts ADD COLUMN ${columnName} ${columnType};`,
        );
      }
    }

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

    // Create pending_posts table for offline queue
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS pending_posts (
        id TEXT PRIMARY KEY,
        payload TEXT,
        timestamp INTEGER
      );
    `);

    console.log("[Database] Database tables initialized successfully.");
    return true;
  } catch (error) {
    console.error("[Database] Initialization error:", error);
    return false;
  }
}

/* ==========================================================================
   CONTACTS DATABASE OPERATIONS
   ========================================================================== */

export async function getContacts() {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync(
      "SELECT * FROM contacts ORDER BY last_message_time DESC, name ASC;",
    );
    return rows.map(normalizeContactRow).filter(Boolean);
  } catch (error) {
    console.error("[Database] getContacts error:", error);
    return [];
  }
}

export async function saveContacts(contactsArray) {
  try {
    const db = await getDatabase();
    for (const contact of contactsArray) {
      // Preserve existing unread_count and last_message_time if they exist in DB
      const existing = await db.getFirstAsync("SELECT unread_count, last_message_time FROM contacts WHERE id = ?;", [contact.id]);
      
      await db.runAsync(
        `INSERT OR REPLACE INTO contacts (id, name, phone, email, flag, status, is_synced, avatar, is_unity_user, unread_count, last_message_time) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          contact.id,
          contact.name,
          contact.phone || "",
          contact.email || "",
          contact.flag || "🌍",
          contact.status || "",
          contact.is_synced ? 1 : 0,
          contact.avatar || "",
          contact.isUnityUser ? 1 : 0,
          existing ? existing.unread_count : 0,
          existing ? existing.last_message_time : 0,
        ],
      );
    }
    return true;
  } catch (error) {
    console.error("[Database] saveContacts error:", error);
    return false;
  }
}

/**
 * Checks if there are any unsynced contacts in the database.
 * Returns true if unsynced contacts exist, false otherwise.
 */
export async function hasUnsyncedContacts() {
  try {
    const db = await getDatabase();
    const result = await db.getFirstAsync(
      "SELECT COUNT(*) as count FROM contacts WHERE is_synced = 0;",
    );
    return result && result.count > 0;
  } catch (error) {
    console.error("[Database] hasUnsyncedContacts error:", error);
    return false;
  }
}

/**
 * Gets the count of unsynced contacts in the database.
 */
export async function getUnsyncedContactsCount() {
  try {
    const db = await getDatabase();
    const result = await db.getFirstAsync(
      "SELECT COUNT(*) as count FROM contacts WHERE is_synced = 0;",
    );
    return result ? result.count : 0;
  } catch (error) {
    console.error("[Database] getUnsyncedContactsCount error:", error);
    return 0;
  }
}

export async function clearContactUnread(contactId) {
  try {
    const db = await getDatabase();
    await db.runAsync("UPDATE contacts SET unread_count = 0 WHERE id = ?;", [contactId]);
    return true;
  } catch (error) {
    console.error("[Database] clearContactUnread error:", error);
    return false;
  }
}

export async function incrementContactUnread(contactId, lastMessageTime) {
  try {
    const db = await getDatabase();
    await db.runAsync(
      "UPDATE contacts SET unread_count = unread_count + 1, last_message_time = ? WHERE id = ?;",
      [lastMessageTime || Date.now(), contactId]
    );
    return true;
  } catch (error) {
    console.error("[Database] incrementContactUnread error:", error);
    return false;
  }
}

export async function updateContactLastMessageTime(contactId, lastMessageTime) {
  try {
    const db = await getDatabase();
    await db.runAsync(
      "UPDATE contacts SET last_message_time = ? WHERE id = ?;",
      [lastMessageTime || Date.now(), contactId]
    );
    return true;
  } catch (error) {
    console.error("[Database] updateContactLastMessageTime error:", error);
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
      "SELECT * FROM chats WHERE partner_id = ? ORDER BY timestamp ASC;",
      [partnerId],
    );
  } catch (error) {
    console.error("[Database] getChats error:", error);
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
        chatBubble.trans_text || "",
        chatBubble.sender, // 'user' or 'partner'
        chatBubble.orig_lang || "",
        chatBubble.trans_lang || "",
        chatBubble.timestamp || Date.now(),
      ],
    );
    return true;
  } catch (error) {
    console.error("[Database] saveChat error:", error);
    return false;
  }
}

/* ==========================================================================
   POSTS DATABASE OPERATIONS
   ========================================================================== */

export async function getPosts() {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync(
      "SELECT * FROM posts ORDER BY timestamp DESC;",
    );
    return rows.map(normalizePostRow).filter(Boolean);
  } catch (error) {
    console.error("[Database] getPosts error:", error);
    return [];
  }
}

export async function savePosts(postsArray) {
  try {
    const db = await getDatabase();
    for (const post of postsArray) {
      await db.runAsync(
        `INSERT OR REPLACE INTO posts (id, author_name, author_email, author_avatar, author_flag, author_native_lang, content, flag, time, image_local_path, image_url, media_type, background_key, description, avatar_local_path, likes, liked, comments, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          post.id,
          post.authorName || "",
          post.authorEmail || "",
          post.authorAvatar || "",
          post.authorFlag || post.flag || "??",
          post.authorNativeLang || "",
          post.content || "",
          post.flag || "??",
          post.time || "",
          post.image_local_path || "",
          post.imageUrl || post.image || "",
          post.mediaType ||
            (post.imageUrl || post.image || post.image_local_path
              ? "image"
              : "text"),
          post.backgroundKey || "",
          post.description || "",
          post.avatar_local_path || "",
          post.likes || 0,
          post.liked ? 1 : 0,
          JSON.stringify(post.comments || []),
          post.timestamp || Date.now(),
        ],
      );
    }
    return true;
  } catch (error) {
    console.error("[Database] savePosts error:", error);
    return false;
  }
}

export async function savePendingPost(id, payload) {
  try {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO pending_posts (id, payload, timestamp) VALUES (?, ?, ?);`,
      [id, JSON.stringify(payload), Date.now()]
    );
    return true;
  } catch (error) {
    console.error("[Database] savePendingPost error:", error);
    return false;
  }
}

export async function getPendingPosts() {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync("SELECT * FROM pending_posts ORDER BY timestamp ASC;");
    return rows.map(r => ({ id: r.id, payload: JSON.parse(r.payload), timestamp: r.timestamp }));
  } catch (error) {
    console.error("[Database] getPendingPosts error:", error);
    return [];
  }
}

export async function deletePendingPost(id) {
  try {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM pending_posts WHERE id = ?;`, [id]);
    return true;
  } catch (error) {
    console.error("[Database] deletePendingPost error:", error);
    return false;
  }
}

/* ==========================================================================
   EXPLORE PROFILES DATABASE OPERATIONS
   ========================================================================== */

export async function getExploreProfiles() {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync(
      "SELECT * FROM explore_profiles ORDER BY name ASC;",
    );
    return rows.map(normalizeExploreRow).filter(Boolean);
  } catch (error) {
    console.error("[Database] getExploreProfiles error:", error);
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
          profile.flag || "🌍",
          profile.langName || "",
          profile.bio || "",
          profile.avatar_local_path || "",
        ],
      );
    }
    return true;
  } catch (error) {
    console.error("[Database] saveExploreProfiles error:", error);
    return false;
  }
}

/* ==========================================================================
   CLEANUP & RESET
   ========================================================================== */

export async function clearDatabase() {
  try {
    const db = await getDatabase();
    await db.execAsync("DELETE FROM chats;");
    await db.execAsync("DELETE FROM contacts;");
    await db.execAsync("DELETE FROM posts;");
    await db.execAsync("DELETE FROM explore_profiles;");
    console.log("[Database] Database tables cleared.");
    return true;
  } catch (error) {
    console.error("[Database] clearDatabase error:", error);
    return false;
  }
}
