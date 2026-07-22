import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

let dbInstance = null;

class MockDatabase {
  constructor() {
    this.tables = {
      contacts: [],
      chats: [],
      posts: [],
      explore_profiles: [],
      pending_posts: [],
      call_logs: [],
    };
    if (Platform.OS === "web") {
      try {
        const stored = localStorage.getItem("amani_mock_db");
        if (stored) {
          this.tables = JSON.parse(stored);
        }
      } catch (_) {}
    }
  }

  save() {
    if (Platform.OS === "web") {
      try {
        localStorage.setItem("amani_mock_db", JSON.stringify(this.tables));
      } catch (_) {}
    }
  }

  async execAsync(sql) {
    if (sql.includes("DELETE FROM")) {
      const match = sql.match(/DELETE\s+FROM\s+(\w+)/i);
      if (match && this.tables[match[1]]) {
        this.tables[match[1]] = [];
        this.save();
      }
    }
    return;
  }

  async runAsync(sql, params = []) {
    if (sql.includes("INSERT OR REPLACE INTO") || sql.includes("INSERT INTO")) {
      const tableMatch = sql.match(/(?:INSERT\s+OR\s+REPLACE|INSERT)\s+INTO\s+(\w+)/i);
      const colMatch = sql.match(/\(([^)]+)\)/);
      if (tableMatch && colMatch) {
        const tableName = tableMatch[1];
        const columns = colMatch[1].split(",").map(c => c.trim());
        const newRow = {};
        columns.forEach((col, idx) => {
          newRow[col] = params[idx];
        });

        if (!this.tables[tableName]) this.tables[tableName] = [];

        const pk = newRow.id;
        this.tables[tableName] = this.tables[tableName].filter(r => r.id !== pk);
        this.tables[tableName].push(newRow);

        if (tableName === "call_logs") {
          this.tables.call_logs.sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
          if (this.tables.call_logs.length > 15) {
            this.tables.call_logs = this.tables.call_logs.slice(0, 15);
          }
        }

        this.save();
      }
    } else if (sql.includes("UPDATE contacts")) {
      const isClear = sql.includes("unread_count = 0");
      const isIncrement = sql.includes("unread_count = unread_count + 1");
      const isUpdateTime = sql.includes("last_message_time = ?") && !isIncrement;

      if (isClear) {
        const contactId = params[0];
        const contact = this.tables.contacts.find(c => c.id === contactId);
        if (contact) {
          contact.unread_count = 0;
          this.save();
        }
      } else if (isIncrement) {
        const lastMessageTime = params[0];
        const contactId = params[1];
        const contact = this.tables.contacts.find(c => c.id === contactId);
        if (contact) {
          contact.unread_count = (Number(contact.unread_count) || 0) + 1;
          contact.last_message_time = lastMessageTime;
          this.save();
        }
      } else if (isUpdateTime) {
        const lastMessageTime = params[0];
        const contactId = params[1];
        const contact = this.tables.contacts.find(c => c.id === contactId);
        if (contact) {
          contact.last_message_time = lastMessageTime;
          this.save();
        }
      }
    }
    return { lastInsertRowId: 0, changes: 1 };
  }

  async getFirstAsync(sql, params = []) {
    const rows = await this.getAllAsync(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async getAllAsync(sql, params = []) {
    if (sql.includes("COUNT(*)")) {
      if (sql.includes("contacts WHERE is_synced = 0")) {
        const count = this.tables.contacts.filter(c => Number(c.is_synced) === 0).length;
        return [{ count }];
      }
    }
    if (sql.includes("SELECT unread_count, last_message_time FROM contacts WHERE id = ?")) {
      const contactId = params[0];
      const contact = this.tables.contacts.find(c => c.id === contactId);
      return contact ? [contact] : [];
    }

    if (sql.includes("FROM contacts")) {
      return [...this.tables.contacts].sort((a, b) => {
        const tA = Number(a.last_message_time) || 0;
        const tB = Number(b.last_message_time) || 0;
        if (tB !== tA) return tB - tA;
        return (a.name || "").localeCompare(b.name || "");
      });
    }
    if (sql.includes("FROM chats")) {
      const partnerId = params[0];
      return this.tables.chats
        .filter(c => c.partner_id === partnerId)
        .sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
    }
    if (sql.includes("FROM posts")) {
      return [...this.tables.posts].sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
    }
    if (sql.includes("FROM explore_profiles")) {
      return [...this.tables.explore_profiles].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    if (sql.includes("FROM pending_posts")) {
      return [...this.tables.pending_posts].sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
    }

    if (sql.includes("table_info")) {
      if (sql.includes("contacts")) {
        return [
          { name: "id" }, { name: "name" }, { name: "phone" }, { name: "email" }, 
          { name: "flag" }, { name: "status" }, { name: "is_synced" }, { name: "avatar" }, 
          { name: "is_unity_user" }, { name: "unread_count" }, { name: "last_message_time" }
        ];
      }
      if (sql.includes("posts")) {
        return [
          { name: "id" }, { name: "author_name" }, { name: "author_email" }, { name: "author_avatar" },
          { name: "author_flag" }, { name: "author_native_lang" }, { name: "content" }, { name: "flag" },
          { name: "time" }, { name: "image_local_path" }, { name: "image_url" }, { name: "media_type" },
          { name: "background_key" }, { name: "description" }, { name: "avatar_local_path" },
          { name: "likes" }, { name: "liked" }, { name: "comments" }, { name: "timestamp" }
        ];
      }
    }
    return [];
  }
}

let dbInitialized = false;
let dbInitPromise = null;
let dbIsInitializingSchema = false;

function sanitizeParams(params) {
  if (!params) return [];
  return params.map(val => (val === undefined ? null : val));
}

async function dbRunAsync(sql, params) {
  if (!dbInitialized && !dbIsInitializingSchema) {
    await initDatabase();
  }
  const sanitized = sanitizeParams(params);
  try {
    const db = await getDatabase();
    return await db.runAsync(sql, sanitized);
  } catch (error) {
    if (error.message && (error.message.includes("NullPointerException") || error.message.includes("released") || error.message.includes("closed"))) {
      try { if (dbInstance && dbInstance.closeAsync) await dbInstance.closeAsync(); } catch (_) {}
      dbInstance = null;
      const db = await getDatabase();
      return await db.runAsync(sql, sanitized);
    }
    throw error;
  }
}

async function dbGetFirstAsync(sql, params) {
  if (!dbInitialized && !dbIsInitializingSchema) {
    await initDatabase();
  }
  const sanitized = sanitizeParams(params);
  try {
    const db = await getDatabase();
    return await db.getFirstAsync(sql, sanitized);
  } catch (error) {
    if (error.message && (error.message.includes("NullPointerException") || error.message.includes("released") || error.message.includes("closed"))) {
      try { if (dbInstance && dbInstance.closeAsync) await dbInstance.closeAsync(); } catch (_) {}
      dbInstance = null;
      const db = await getDatabase();
      return await db.getFirstAsync(sql, sanitized);
    }
    throw error;
  }
}

async function dbGetAllAsync(sql, params) {
  if (!dbInitialized && !dbIsInitializingSchema) {
    await initDatabase();
  }
  const sanitized = sanitizeParams(params);
  try {
    const db = await getDatabase();
    return await db.getAllAsync(sql, sanitized);
  } catch (error) {
    if (error.message && (error.message.includes("NullPointerException") || error.message.includes("released") || error.message.includes("closed"))) {
      try { if (dbInstance && dbInstance.closeAsync) await dbInstance.closeAsync(); } catch (_) {}
      dbInstance = null;
      const db = await getDatabase();
      return await db.getAllAsync(sql, sanitized);
    }
    throw error;
  }
}

async function dbExecAsync(sql) {
  if (!dbInitialized && !dbIsInitializingSchema) {
    await initDatabase();
  }
  try {
    const db = await getDatabase();
    return await db.execAsync(sql);
  } catch (error) {
    if (error.message && (error.message.includes("NullPointerException") || error.message.includes("released") || error.message.includes("closed"))) {
      try { if (dbInstance && dbInstance.closeAsync) await dbInstance.closeAsync(); } catch (_) {}
      dbInstance = null;
      const db = await getDatabase();
      return await db.execAsync(sql);
    }
    throw error;
  }
}


let dbInitializing = null;

/**
 * Initializes and retrieves the local SQLite database instance.
 */
export async function getDatabase() {
  if (dbInstance) return dbInstance;

  // Prevent concurrent initialization race conditions
  if (dbInitializing) return dbInitializing;

  dbInitializing = (async () => {
    try {
      if (Platform.OS === "web") {
        dbInstance = new MockDatabase();
      } else {
        dbInstance = await SQLite.openDatabaseAsync("unity_offline.db");
      }
      return dbInstance;
    } catch (error) {
      console.warn("[Database] Failed to open SQLite database, falling back to mock database:", error);
      dbInstance = new MockDatabase();
      return dbInstance;
    } finally {
      dbInitializing = null;
    }
  })();

  return dbInitializing;
}

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



function normalizeCallLogRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    partnerId: row.partner_id || row.partnerId || "",
    partnerName: row.partner_name || row.partnerName || "User",
    partnerAvatar: row.partner_avatar || row.partnerAvatar || "",
    callType: row.call_type || row.callType || "incoming", // 'incoming' | 'outgoing' | 'missed'
    status: row.status || "ended",
    duration: Number(row.duration || 0),
    timestamp: Number(row.timestamp || Date.now()),
  };
}

/**
 * Initializes database tables.
 */
export async function initDatabase() {
  if (dbInitialized) return true;
  if (dbInitPromise) return dbInitPromise;

  dbIsInitializingSchema = true;
  dbInitPromise = (async () => {
    try {
    // Create call_logs table
    await dbExecAsync(`
      CREATE TABLE IF NOT EXISTS call_logs (
        id TEXT PRIMARY KEY,
        partner_id TEXT,
        partner_name TEXT,
        partner_avatar TEXT,
        call_type TEXT,
        status TEXT,
        duration INTEGER DEFAULT 0,
        timestamp INTEGER
      );
    `);

    // Create contacts table
    await dbExecAsync(`
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

    try {
      const contactColumns = await dbGetAllAsync("PRAGMA table_info(contacts);");
      const existingContactColumns = new Set(
        contactColumns.map((column) => column.name),
      );
      if (!existingContactColumns.has("is_unity_user")) {
        await dbRunAsync(
          "ALTER TABLE contacts ADD COLUMN is_unity_user INTEGER DEFAULT 0;",
        );
      }
      if (!existingContactColumns.has("unread_count")) {
        await dbRunAsync(
          "ALTER TABLE contacts ADD COLUMN unread_count INTEGER DEFAULT 0;",
        );
      }
      if (!existingContactColumns.has("last_message_time")) {
        await dbRunAsync(
          "ALTER TABLE contacts ADD COLUMN last_message_time INTEGER DEFAULT 0;",
        );
      }
    } catch (e) {
      console.warn("Error migrating contacts table:", e);
    }

    // Create chats table (stores only text translations, not raw voice files)
    await dbExecAsync(`
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
    await dbExecAsync(`
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

    try {
      const postColumns = await dbGetAllAsync("PRAGMA table_info(posts);");
      const existingPostColumns = new Set(
        postColumns.map((column) => column.name),
      );
      for (const [columnName, columnType] of Object.entries(
        POSTS_SCHEMA_COLUMNS,
      )) {
        if (!existingPostColumns.has(columnName)) {
          await dbRunAsync(
            `ALTER TABLE posts ADD COLUMN ${columnName} ${columnType};`,
          );
        }
      }
    } catch (e) {
      console.warn("Error migrating posts table:", e);
    }

    // Create explore_profiles table
    await dbExecAsync(`
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
    await dbExecAsync(`
      CREATE TABLE IF NOT EXISTS pending_posts (
        id TEXT PRIMARY KEY,
        payload TEXT,
        timestamp INTEGER
      );
    `);

    console.log("[Database] Database tables initialized successfully.");
    dbInitialized = true;
    return true;
  } catch (error) {
    console.error("[Database] Initialization error:", error);
    return false;
  } finally {
    dbIsInitializingSchema = false;
    dbInitPromise = null;
  }
}

/* ==========================================================================
   CONTACTS DATABASE OPERATIONS
   ========================================================================== */

export async function getContacts() {
  try {
    const rows = await dbGetAllAsync(
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
    for (const contact of contactsArray) {
      const contactId = contact.id || "";
      // Preserve existing unread_count and last_message_time if they exist in DB
      const existing = await dbGetFirstAsync("SELECT unread_count, last_message_time FROM contacts WHERE id = ?;", [contactId]);
      
      await dbRunAsync(
        `INSERT OR REPLACE INTO contacts (id, name, phone, email, flag, status, is_synced, avatar, is_unity_user, unread_count, last_message_time) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          contactId,
          contact.name || "",
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
    const result = await dbGetFirstAsync(
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
    const result = await dbGetFirstAsync(
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
    await dbRunAsync("UPDATE contacts SET unread_count = 0 WHERE id = ?;", [contactId]);
    return true;
  } catch (error) {
    console.error("[Database] clearContactUnread error:", error);
    return false;
  }
}

export async function incrementContactUnread(contactId, lastMessageTime) {
  try {
    await dbRunAsync(
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
    await dbRunAsync(
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
    return await dbGetAllAsync(
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
    await dbRunAsync(
      `INSERT OR REPLACE INTO chats (id, partner_id, text, trans_text, sender, orig_lang, trans_lang, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        chatBubble.id || "",
        chatBubble.partner_id || "",
        chatBubble.text || "",
        chatBubble.trans_text || "",
        chatBubble.sender || "user",
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
    const rows = await dbGetAllAsync(
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
    for (const post of postsArray) {
      await dbRunAsync(
        `INSERT OR REPLACE INTO posts (id, author_name, author_email, author_avatar, author_flag, author_native_lang, content, flag, time, image_local_path, image_url, media_type, background_key, description, avatar_local_path, likes, liked, comments, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          post.id || "",
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
    await dbRunAsync(
      `INSERT OR REPLACE INTO pending_posts (id, payload, timestamp) VALUES (?, ?, ?);`,
      [id || "", JSON.stringify(payload || {}), Date.now()]
    );
    return true;
  } catch (error) {
    console.error("[Database] savePendingPost error:", error);
    return false;
  }
}

export async function getPendingPosts() {
  try {
    const rows = await dbGetAllAsync("SELECT * FROM pending_posts ORDER BY timestamp ASC;");
    return rows.map(r => ({ id: r.id, payload: JSON.parse(r.payload), timestamp: r.timestamp }));
  } catch (error) {
    console.error("[Database] getPendingPosts error:", error);
    return [];
  }
}

export async function deletePendingPost(id) {
  try {
    await dbRunAsync(`DELETE FROM pending_posts WHERE id = ?;`, [id]);
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
    const rows = await dbGetAllAsync(
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
    for (const profile of profilesArray) {
      await dbRunAsync(
        `INSERT OR REPLACE INTO explore_profiles (id, name, flag, lang_name, bio, avatar_local_path) 
         VALUES (?, ?, ?, ?, ?, ?);`,
        [
          profile.id || "",
          profile.name || "",
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
   CALL LOGS DATABASE OPERATIONS
   ========================================================================== */

export async function getCallLogs() {
  try {
    const rows = await dbGetAllAsync(
      "SELECT * FROM call_logs ORDER BY timestamp DESC LIMIT 15;"
    );
    return rows.map(normalizeCallLogRow).filter(Boolean);
  } catch (error) {
    console.error("[Database] getCallLogs error:", error);
    return [];
  }
}

export async function saveCallLog(logData) {
  try {
    if (!logData) return false;
    const id = logData.id || `call_log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    await dbRunAsync(
      `INSERT OR REPLACE INTO call_logs (id, partner_id, partner_name, partner_avatar, call_type, status, duration, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        logData.partnerId || logData.partner_id || "",
        logData.partnerName || logData.partner_name || "User",
        logData.partnerAvatar || logData.partner_avatar || "",
        logData.callType || logData.type || "incoming",
        logData.status || "ended",
        Number(logData.duration || 0),
        Number(logData.timestamp || Date.now()),
      ]
    );

    // Smart Storage Cap: Keep strictly the 15 most recent calls locally to save phone storage
    await dbExecAsync(
      `DELETE FROM call_logs WHERE id NOT IN (
         SELECT id FROM call_logs ORDER BY timestamp DESC LIMIT 15
       );`
    );
    return true;
  } catch (error) {
    console.error("[Database] saveCallLog error:", error);
    return false;
  }
}

/* ==========================================================================
   CLEANUP & RESET
   ========================================================================== */

export async function clearDatabase() {
  try {
    await dbExecAsync("DELETE FROM chats;");
    await dbExecAsync("DELETE FROM contacts;");
    await dbExecAsync("DELETE FROM posts;");
    await dbExecAsync("DELETE FROM explore_profiles;");
    await dbExecAsync("DELETE FROM call_logs;");
    console.log("[Database] Database tables cleared.");
    return true;
  } catch (error) {
    console.error("[Database] clearDatabase error:", error);
    return false;
  }
}
