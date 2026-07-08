import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

// ─── Lightweight workspace auth ─────────────────────────────────────────────
// Deliberately NOT Firebase, NOT OAuth, NOT a JWT/refresh-token system.
//
// User storage: a flat users.json file rather than Neo4j nodes. Reasoning —
// identity data has a completely different access pattern and lifecycle than
// the dependency graph (no traversal, no relationships to services/vendors,
// written rarely compared to graph reads), so modeling it as graph nodes
// would only couple auth to Neo4j's availability and add write contention
// with the graph-rebuild pipeline for no benefit. A JSON file is trivial to
// inspect, reset, and reason about for a hackathon-scale user base, and it
// keeps auth fully decoupled from the RootSight domain graph.
//
// Sessions: opaque random tokens kept in an in-memory Map (userId + expiry).
// No JWT parsing/verification, no refresh flow — a session is either present
// and unexpired, or it isn't. Restarting the server invalidates all sessions,
// which is an acceptable tradeoff for demo reliability over persistence.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_FILE = path.join(__dirname, "users.json");
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const sessions = new Map();

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Node's built-in scrypt gives salted, slow-to-brute-force password hashing
// with zero extra dependencies (no bcrypt/argon2 install required).
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(candidate, "hex");
  // Constant-time compare so a failed login can't leak timing info about
  // how much of the hash matched.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Strips the password hash before a user object ever leaves the server.
function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function getSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function destroySession(token) {
  if (token) sessions.delete(token);
}

function bearerToken(req) {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : null;
}

export {
  loadUsers,
  saveUsers,
  hashPassword,
  verifyPassword,
  publicUser,
  createSession,
  getSession,
  destroySession,
  bearerToken,
};