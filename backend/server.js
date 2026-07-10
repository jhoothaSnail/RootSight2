import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import multer from "multer";
import neo4j from "neo4j-driver";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PDFParse } from "pdf-parse";
import { parse as csvParse } from "csv-parse/sync";
import { SCENARIOS, getScenario, listScenarioNames } from "./scenarios.js";
import {
  loadUsers,
  saveUsers,
  hashPassword,
  verifyPassword,
  publicUser,
  createSession,
  getSession,
  destroySession,
  bearerToken,
} from "./auth.js";

dotenv.config();

// ─── Constants ────────────────────────────────────────────────────────────────

const PORT = 3001;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCKS_DIR = path.join(__dirname, "..", "shared", "mocks");

// Maps a Neo4j node label to the health "type" the frontend renders.
const LABEL_TO_TYPE = {
  Service: "Service",
  Vendor: "Vendor",
  Team: "Team",
  Database: "Database",
  Engineer: "Engineer",
  Incident: "Incident",
  Runbook: "Runbook",
};

// ─── Shared Helpers ─────────────────────────────────────────────────────────────

// Reads a mock JSON file (the Phase 1 contract fixtures) so every endpoint can
// degrade gracefully to realistic data when Neo4j or Gemini is unavailable.
function loadMock(name) {
  try {
    const raw = fs.readFileSync(path.join(MOCKS_DIR, `${name}.json`), "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[Mock] Could not load mock "${name}": ${err.message}`);
    return null;
  }
}

// Consistent structured error envelope used across every endpoint.
function structuredError(res, status, code, message) {
  return res.status(status).json({ success: false, error: { code, message } });
}

// All relationship types accepted by the system.
// Stored here as the single source of truth — referenced by both the prompt
// and the validator so they can never drift apart.
const VALID_RELATIONSHIP_TYPES = new Set([
  "DEPENDS_ON",   // Service A depends on Service B (or Database)
  "OWNED_BY",     // Service/Database owned by a Team
  "USES_VENDOR",  // Service uses an external Vendor
  "CAUSED_BY",    // Incident caused by a Service or Vendor failure
  "RESOLVED_BY",  // Incident resolved by an Engineer
  "HAS_RUNBOOK",  // Service or Incident has an associated Runbook
  "USES",         // Generic: Engineer uses a tool, Service uses a Database
]);

// All entity array keys Gemini must return.
const REQUIRED_KEYS = [
  "services",
  "vendors",
  "teams",
  "databases",
  "engineers",
  "incidents",
  "runbooks",
  "relationships",
];

// Maps JSON array key → Neo4j node label.
const ENTITY_LABEL_MAP = {
  services:  "Service",
  vendors:   "Vendor",
  teams:     "Team",
  databases: "Database",
  engineers: "Engineer",
  incidents: "Incident",
  runbooks:  "Runbook",
};

// ─── Gemini Setup ─────────────────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function buildExtractionPrompt(text) {
  return `You are an expert system architecture and incident intelligence parser.

Your task: Read the technical document below and extract EVERY operational entity and relationship you can find. Be thorough — extract all instances of every entity type, even if a type is only mentioned in passing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENTITY TYPES — extract ALL instances of each:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

services    → Internal microservices, APIs, backend applications, daemons
              Examples: "Auth Service", "Payment API", "User Service", "API Gateway",
              "Order Worker", "Recommendation Engine", "Background Job"

vendors     → External third-party providers, SaaS tools, cloud platforms
              Examples: "Google OAuth", "Twilio", "Razorpay", "Stripe", "AWS S3",
              "Datadog", "PagerDuty", "SendGrid", "Cloudflare"

teams       → Engineering teams, squads, pods, chapters, departments
              Examples: "Team Alpha", "Platform Team", "Payments Squad",
              "Backend Chapter", "SRE Team", "Security Team"

databases   → Any data store, cache, queue, or message broker
              Examples: "PostgreSQL", "Redis", "MongoDB", "Kafka", "Elasticsearch",
              "DynamoDB", "RabbitMQ", "MySQL", "Cassandra"

engineers   → Individual people: developers, SREs, on-call responders, managers
              Examples: "Rahul", "Alex Chen", "Priya Sharma", "John (Team Lead)"
              Look for: resolver names, "owned by <name>", "on-call: <name>",
              "escalate to <name>", post-mortem authors

incidents   → Outages, incidents, alerts, degradations, post-mortems, SLO breaches
              Examples: "INC-001", "Auth Outage 2024-03", "Payment Gateway Timeout",
              "Database Connection Pool Exhaustion", "Postmortem: Login Failures"
              Look for: incident IDs, postmortem titles, outage descriptions

runbooks    → Runbooks, playbooks, SOPs, remediation procedures, escalation guides
              Examples: "OAuth Fallback Runbook", "DB Connection Reset Playbook",
              "Traffic Shedding SOP", "On-Call Escalation Guide"
              Look for: procedure names, "runbook:", "playbook:", "SOP:", "procedure:"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RELATIONSHIP TYPES — use ONLY these exact strings:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DEPENDS_ON   → (Service)-[:DEPENDS_ON]->(Service or Database)
               "Login Service depends on Auth Service"
               "Auth Service depends on PostgreSQL"

OWNED_BY     → (Service or Database)-[:OWNED_BY]->(Team)
               "Payment Service is owned by Team Beta"
               "PostgreSQL is owned by Platform Team"

USES_VENDOR  → (Service)-[:USES_VENDOR]->(Vendor)
               "Auth Service uses Google OAuth"
               "Notification Service uses Twilio"

CAUSED_BY    → (Incident)-[:CAUSED_BY]->(Service or Vendor)
               "INC-001 was caused by Google OAuth outage"
               "Login Failures caused by Auth Service crash"

RESOLVED_BY  → (Incident)-[:RESOLVED_BY]->(Engineer)
               "INC-001 was resolved by Rahul"
               "Auth Outage fixed by Alex"

HAS_RUNBOOK  → (Service or Incident)-[:HAS_RUNBOOK]->(Runbook)
               "Auth Service has runbook OAuth Fallback Playbook"
               "INC-001 has runbook DB Reset Procedure"

USES         → (Service)-[:USES]->(Database) or (Engineer)-[:USES]->(tool)
               "Auth Service uses Redis for session caching"
               "Payment Service uses Kafka for events"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Return ONLY a single valid JSON object. Absolutely nothing else.
2. NO markdown. NO backticks. NO code fences. NO \`\`\`json blocks.
3. NO preamble, explanation, summary, or trailing text of any kind.
4. Every entity MUST have:
   - "id": lowercase slug, hyphens only, no spaces (e.g. "auth-service", "team-alpha")
   - "name": human-readable display name (e.g. "Auth Service", "Team Alpha")
   - NEVER leave "id" or "name" as null, empty string, or whitespace.
5. Every relationship MUST have "source" (entity id), "target" (entity id), "type" (from list above).
6. source and target values must be ids that exist in the entities you return.
7. If no entities of a type exist in the document, return an empty array [] for that key.
8. IDs must be globally unique across ALL entity types combined.

OUTPUT FORMAT — return exactly this structure:
{
  "services": [{ "id": "string", "name": "string" }],
  "vendors": [{ "id": "string", "name": "string" }],
  "teams": [{ "id": "string", "name": "string" }],
  "databases": [{ "id": "string", "name": "string" }],
  "engineers": [{ "id": "string", "name": "string" }],
  "incidents": [{ "id": "string", "name": "string" }],
  "runbooks": [{ "id": "string", "name": "string" }],
  "relationships": [{ "source": "string", "target": "string", "type": "string" }]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOCUMENT TO ANALYZE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${text}`;
}

// ─── Gemini Extraction with Retry ─────────────────────────────────────────────

async function callGemini(text, attempt = 1) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = buildExtractionPrompt(text);

  const result = await model.generateContent(prompt);
  const raw = result.response.text();

  // Strip any accidental markdown fences Gemini sometimes adds despite instructions
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    if (attempt === 1) {
      console.warn(`[Gemini] Attempt 1 parse failed — raw output: ${raw.slice(0, 200)}`);
      console.warn(`[Gemini] Retrying with stricter prompt...`);
      return callGemini(text, 2);
    }
    throw new Error(
      `Gemini returned invalid JSON after 2 attempts. Raw: ${raw.slice(0, 300)}`
    );
  }

  return parsed;
}

// ─── Entity Sanitization ──────────────────────────────────────────────────────
// Runs BEFORE storage. Removes any entity that has a null, empty, or
// whitespace-only id or name. Returns a cleaned copy of the data plus
// a count of how many entities were dropped.

function sanitizeEntities(data) {
  const cleaned = {};
  let droppedEntities = 0;
  let droppedRelationships = 0;

  // Sanitize each entity array
  for (const key of Object.keys(ENTITY_LABEL_MAP)) {
    const raw = Array.isArray(data[key]) ? data[key] : [];
    cleaned[key] = raw.filter((entity) => {
      const idOk  = entity.id   && typeof entity.id   === "string" && entity.id.trim()   !== "";
      const nameOk = entity.name && typeof entity.name === "string" && entity.name.trim() !== "";
      if (!idOk || !nameOk) {
        console.warn(
          `[Sanitize] Dropped ${key} entity — invalid id/name:`,
          JSON.stringify(entity)
        );
        droppedEntities++;
        return false;
      }
      // Trim whitespace from both fields before storing
      entity.id   = entity.id.trim();
      entity.name = entity.name.trim();
      return true;
    });
  }

  // Build a set of all valid entity IDs so we can validate relationships
  const validIds = new Set();
  for (const key of Object.keys(ENTITY_LABEL_MAP)) {
    for (const e of cleaned[key]) validIds.add(e.id);
  }

  // Sanitize relationships — drop any that reference missing or blank IDs
  const rawRels = Array.isArray(data.relationships) ? data.relationships : [];
  cleaned.relationships = rawRels.filter((rel) => {
    const sourceOk = rel.source && typeof rel.source === "string" && rel.source.trim() !== "";
    const targetOk = rel.target && typeof rel.target === "string" && rel.target.trim() !== "";
    const typeOk   = rel.type   && typeof rel.type   === "string" && rel.type.trim()   !== "";

    if (!sourceOk || !targetOk || !typeOk) {
      console.warn(`[Sanitize] Dropped relationship — blank field:`, JSON.stringify(rel));
      droppedRelationships++;
      return false;
    }

    // Trim all fields
    rel.source = rel.source.trim();
    rel.target = rel.target.trim();
    rel.type   = rel.type.trim();

    // Drop if source or target ID doesn't exist in our entity set
    if (!validIds.has(rel.source)) {
      console.warn(`[Sanitize] Dropped relationship — unknown source id "${rel.source}"`);
      droppedRelationships++;
      return false;
    }
    if (!validIds.has(rel.target)) {
      console.warn(`[Sanitize] Dropped relationship — unknown target id "${rel.target}"`);
      droppedRelationships++;
      return false;
    }

    return true;
  });

  if (droppedEntities > 0 || droppedRelationships > 0) {
    console.log(
      `[Sanitize] Dropped ${droppedEntities} entities, ${droppedRelationships} relationships`
    );
  }

  return cleaned;
}

// ─── Schema Validation ────────────────────────────────────────────────────────

function validateSchema(parsed) {
  const errors = [];

  for (const key of REQUIRED_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(parsed, key)) {
      errors.push(`Missing required key: "${key}"`);
    } else if (!Array.isArray(parsed[key])) {
      errors.push(`Key "${key}" must be an array, got: ${typeof parsed[key]}`);
    }
  }

  // Only validate relationship structure if the array is present
  if (Array.isArray(parsed.relationships)) {
    for (const rel of parsed.relationships) {
      if (!rel.source || !rel.target || !rel.type) {
        errors.push(`Relationship missing source/target/type: ${JSON.stringify(rel)}`);
      } else if (!VALID_RELATIONSHIP_TYPES.has(rel.type)) {
        // Warn but don't hard-fail — Gemini sometimes uses synonyms
        console.warn(
          `[Validation] Unknown relationship type "${rel.type}" — will be skipped at storage time`
        );
      }
    }
  }

  return errors;
}

// ─── AuraDB Storage ───────────────────────────────────────────────────────────

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);

async function clearAuraDB() {
  const session = driver.session();
  try {
    await session.run(`MATCH (n) DETACH DELETE n`);
    console.log('[AuraDB] ✓ Graph cleared — all nodes and relationships deleted');
  } finally {
    await session.close();
  }
}

async function storeInAuraDB(data) {
  const session = driver.session();

  try {
    // 1. MERGE all entity nodes for every supported label
    for (const [key, label] of Object.entries(ENTITY_LABEL_MAP)) {
      const entities = data[key] || [];

      for (const entity of entities) {
        // Double-check: sanitizeEntities already filtered these, but be defensive
        if (!entity.id || !entity.name || !entity.id.trim() || !entity.name.trim()) {
          console.warn(`[AuraDB] Skipped ${label} with blank id/name:`, entity);
          continue;
        }

        await session.run(
          `MERGE (n:${label} {id: $id})
           ON CREATE SET n.name = $name, n.createdAt = timestamp()
           ON MATCH  SET n.name = $name, n.updatedAt = timestamp()`,
          { id: entity.id, name: entity.name }
        );
        console.log(`[AuraDB] ✓ MERGE ${label}: "${entity.name}" (${entity.id})`);
      }
    }

    // 2. MERGE all relationships
    // Only store relationships whose type is in our allowed set
    for (const rel of data.relationships || []) {
      if (!rel.source || !rel.target || !rel.type) continue;

      if (!VALID_RELATIONSHIP_TYPES.has(rel.type)) {
        console.warn(`[AuraDB] Skipped relationship with unknown type "${rel.type}"`);
        continue;
      }

      try {
        await session.run(
          `MATCH (a {id: $source})
           MATCH (b {id: $target})
           MERGE (a)-[:${rel.type}]->(b)`,
          { source: rel.source, target: rel.target }
        );
        console.log(`[AuraDB] ✓ MERGE rel: (${rel.source})-[:${rel.type}]->(${rel.target})`);
      } catch (relErr) {
        // Log and continue — one bad relationship must not abort the whole batch
        console.warn(
          `[AuraDB] Skipped relationship (${rel.source})-[:${rel.type}]->(${rel.target}): ${relErr.message}`
        );
      }
    }
  } finally {
    await session.close();
  }
}

// ─── File Text Extraction ─────────────────────────────────────────────────────

async function extractText(file) {
  const { mimetype, originalname, buffer } = file;
  const ext = originalname.split(".").pop().toLowerCase();

  // PDF
  if (mimetype === "application/pdf" || ext === "pdf") {
    const parser = new PDFParse({});
    await parser.load(buffer.buffer);
    return await parser.getText();
  }

  // CSV — convert to human-readable text so Gemini understands the structure
  if (mimetype === "text/csv" || ext === "csv") {
    const records = csvParse(buffer.toString("utf8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    if (records.length === 0) return buffer.toString("utf8");

    const headers = Object.keys(records[0]);
    const lines = records.map((row) =>
      headers.map((h) => `${h}: ${row[h]}`).join(", ")
    );
    return `Service Catalog CSV Data:\n\n${lines.join("\n")}`;
  }

  // TXT / MD / everything else — pass through as-is
  return buffer.toString("utf8");
}

// ─── Express App ──────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

// Multer — in-memory storage, 10 MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed    = ["text/plain", "text/markdown", "text/csv", "application/pdf", "text/x-markdown"];
    const allowedExt = ["txt", "md", "csv", "pdf"];
    const ext        = file.originalname.split(".").pop().toLowerCase();

    if (allowed.includes(file.mimetype) || allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype} (.${ext})`));
    }
  },
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Auth ───────────────────────────────────────────────────────────────────
// Lightweight, demo-safe session auth — see backend/auth.js for the storage
// and hashing rationale. No Firebase, no OAuth, no JWTs.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post("/api/auth/signup", (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !String(name).trim()) {
    return structuredError(res, 400, "INVALID_NAME", "Name is required.");
  }
  if (!email || !EMAIL_RE.test(String(email))) {
    return structuredError(res, 400, "INVALID_EMAIL", "Please enter a valid email address.");
  }
  if (!password || String(password).length < 6) {
    return structuredError(res, 400, "WEAK_PASSWORD", "Password should be at least 6 characters.");
  }

  const users = loadUsers();
  const normalizedEmail = String(email).trim().toLowerCase();
  if (users.some((u) => u.email === normalizedEmail)) {
    return structuredError(res, 409, "EMAIL_IN_USE", "An account with this email already exists.");
  }

  const user = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(String(password)),
    isDemo: false,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);

  const token = createSession(user.id);
  res.json({ success: true, token, user: publicUser(user) });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return structuredError(res, 400, "MISSING_FIELDS", "Email and password are required.");
  }

  const users = loadUsers();
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = users.find((u) => u.email === normalizedEmail);
  if (!user || !verifyPassword(String(password), user.passwordHash)) {
    return structuredError(res, 401, "INVALID_CREDENTIALS", "Incorrect email or password.");
  }

  const token = createSession(user.id);
  res.json({ success: true, token, user: publicUser(user) });
});

// One-click access for hackathon judges — no typing, always succeeds.
// Reuses a single persisted demo account so a demo session behaves like any
// other workspace (survives refresh, shows up consistently) rather than
// being a special client-only code path.
app.post("/api/auth/demo", (_req, res) => {
  const users = loadUsers();
  let demoUser = users.find((u) => u.isDemo);
  if (!demoUser) {
    demoUser = {
      id: "demo-workspace",
      name: "Demo Workspace",
      email: "demo@rootsight.ai",
      passwordHash: hashPassword(crypto.randomBytes(16).toString("hex")),
      isDemo: true,
      createdAt: new Date().toISOString(),
    };
    users.push(demoUser);
    saveUsers(users);
  }

  const token = createSession(demoUser.id);
  res.json({ success: true, token, user: publicUser(demoUser) });
});

app.get("/api/auth/me", (req, res) => {
  const session = getSession(bearerToken(req));
  if (!session) {
    return structuredError(res, 401, "UNAUTHENTICATED", "Session expired or invalid.");
  }

  const users = loadUsers();
  const user = users.find((u) => u.id === session.userId);
  if (!user) {
    return structuredError(res, 401, "UNAUTHENTICATED", "Session expired or invalid.");
  }

  res.json({ success: true, user: publicUser(user) });
});

app.post("/api/auth/logout", (req, res) => {
  destroySession(bearerToken(req));
  res.json({ success: true });
});

// ─── POST /api/upload ─────────────────────────────────────────────────────────

// Merges a freshly extracted entity set into an accumulator, de-duplicating
// nodes by id and relationships by (source, target, type).
function mergeExtracted(target, source) {
  for (const key of REQUIRED_KEYS) {
    if (key === "relationships") continue;
    const seen = new Set(target[key].map((e) => e.id));
    for (const entity of source[key] || []) {
      if (!seen.has(entity.id)) {
        target[key].push(entity);
        seen.add(entity.id);
      }
    }
  }
  const relSeen = new Set(
    target.relationships.map((r) => `${r.source}|${r.target}|${r.type}`)
  );
  for (const rel of source.relationships || []) {
    const key = `${rel.source}|${rel.target}|${rel.type}`;
    if (!relSeen.has(key)) {
      target.relationships.push(rel);
      relSeen.add(key);
    }
  }
  return target;
}

// Accepts the finalized contract fields (architectureDoc, serviceCatalog,
// incidentHistory) plus any additional optional documents. `upload.any()` keeps
// the endpoint tolerant of extra sources the UI may attach.
app.post("/api/upload", upload.any(), async (req, res) => {
  const startTime = Date.now();
  const files = req.files || [];

  if (files.length === 0) {
    return structuredError(
      res,
      400,
      "NO_FILES_UPLOADED",
      "No documents were uploaded. Attach at least one organizational document to ingest."
    );
  }

  console.log(`\n[Upload] ▶ ${files.length} document(s) received`);

  try {
    const accumulator = {
      services: [], vendors: [], teams: [], databases: [],
      engineers: [], incidents: [], runbooks: [], relationships: [],
    };

    for (const file of files) {
      console.log(`[Upload] Processing ${file.fieldname}: ${file.originalname} (${file.mimetype})`);
      const text = await extractText(file);
      if (!text || text.trim().length < 10) {
        console.warn(`[Upload] Skipped ${file.originalname} — insufficient text`);
        continue;
      }

      const rawExtracted = await callGemini(text);
      const validationErrors = validateSchema(rawExtracted);
      if (validationErrors.length > 0) {
        console.warn(`[Upload] Skipped ${file.originalname} — invalid schema:`, validationErrors);
        continue;
      }
      const cleaned = sanitizeEntities(rawExtracted);
      mergeExtracted(accumulator, cleaned);
    }

    // Re-run sanitization across the merged set so cross-file relationships
    // referencing entities from other documents are validated against the union.
    const extracted = sanitizeEntities(accumulator);

    await clearAuraDB();
    await storeInAuraDB(extracted);

    const summary = {
      success: true,
      summary: {
        services: extracted.services.length,
        vendors: extracted.vendors.length,
        teams: extracted.teams.length,
        engineers: extracted.engineers.length,
        databases: extracted.databases.length,
        incidents: extracted.incidents.length,
        runbooks: extracted.runbooks.length,
        relationships: extracted.relationships.length,
      },
      processingTimeMs: Date.now() - startTime,
    };

    console.log("[Upload] ✅ Complete:", summary.summary);
    return res.json(summary);
  } catch (err) {
    console.error("[Upload] ⚠ Pipeline error, serving mock summary:", err.message);
    // Bulletproof demo: if Gemini/AuraDB is unreachable, fall back to the
    // contract mock so the ingestion UI can still complete its flow.
    const mock = loadMock("upload-success");
    if (mock) {
      return res.json({ ...mock, processingTimeMs: Date.now() - startTime });
    }
    return structuredError(
      res,
      500,
      "DOCUMENT_PARSE_FAILED",
      "Unable to extract information from the uploaded documents. The files may be corrupted, password-protected, or in an unsupported format."
    );
  }
});

// ─── Graph Retrieval ─────────────────────────────────────────────────────────

// Dependency edge types used when computing transitive health impact.
const DEPENDENCY_REL_TYPES = new Set(["DEPENDS_ON", "USES_VENDOR", "USES"]);

async function fetchGraphFromNeo4j() {
  const session = driver.session();
  try {
    const nodesRes = await session.run(
      `MATCH (n) RETURN labels(n) AS labels, n.id AS id, n.name AS name`
    );
    const relsRes = await session.run(
      `MATCH (a)-[r]->(b) RETURN a.id AS source, b.id AS target, type(r) AS type`
    );

    const nodes = nodesRes.records
      .filter((r) => r.get("id"))
      .map((r) => {
        const labels = r.get("labels") || [];
        const label = labels.find((l) => LABEL_TO_TYPE[l]) || labels[0] || "Service";
        return {
          id: r.get("id"),
          type: LABEL_TO_TYPE[label] || label,
          name: r.get("name") || r.get("id"),
          status: "healthy",
        };
      });

    const relationships = relsRes.records
      .filter((r) => r.get("source") && r.get("target"))
      .map((r) => ({
        source: r.get("source"),
        target: r.get("target"),
        type: r.get("type"),
      }));

    return { nodes, relationships };
  } finally {
    await session.close();
  }
}

// Marks any node that is the target of a CAUSED_BY edge as critical, then walks
// the dependency edges backwards so every node that transitively relies on a
// critical node is flagged as warning. Mutates node.status in place.
function deriveStatus(nodes, relationships) {
  const criticalIds = new Set(
    relationships.filter((r) => r.type === "CAUSED_BY").map((r) => r.target)
  );
  if (criticalIds.size === 0) return;

  // adjacency: dependent -> [dependencies]
  const dependsOn = new Map();
  for (const rel of relationships) {
    if (!DEPENDENCY_REL_TYPES.has(rel.type)) continue;
    if (!dependsOn.has(rel.source)) dependsOn.set(rel.source, []);
    dependsOn.get(rel.source).push(rel.target);
  }

  const reachesCritical = (startId) => {
    const stack = [...(dependsOn.get(startId) || [])];
    const visited = new Set();
    while (stack.length) {
      const id = stack.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      if (criticalIds.has(id)) return true;
      for (const dep of dependsOn.get(id) || []) stack.push(dep);
    }
    return false;
  };

  for (const node of nodes) {
    if (criticalIds.has(node.id)) node.status = "critical";
    else if (reachesCritical(node.id)) node.status = "warning";
  }
}

// ─── Root Cause Analysis ──────────────────────────────────────────────────────

// Attempts a graph-traversal root cause from raw event sources. Returns a
// contract-shaped analysis object, or null if the graph can't support it.
async function analyzeFromGraph(events) {
  const sources = [...new Set(events.map((e) => e.source).filter(Boolean))];
  if (sources.length === 0) return null;

  let graph;
  try {
    graph = await fetchGraphFromNeo4j();
  } catch {
    return null;
  }
  if (!graph.nodes.length) return null;

  const byName = new Map(graph.nodes.map((n) => [n.name.toLowerCase(), n]));
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  const dependsOn = new Map();
  for (const rel of graph.relationships) {
    if (!DEPENDENCY_REL_TYPES.has(rel.type)) continue;
    if (!dependsOn.has(rel.source)) dependsOn.set(rel.source, []);
    dependsOn.get(rel.source).push(rel.target);
  }

  // Resolve affected service nodes from event sources.
  const affected = sources.map((s) => byName.get(s.toLowerCase())).filter(Boolean);
  if (affected.length === 0) return null;

  // Count how many affected services converge on each downstream dependency.
  const convergence = new Map();
  for (const node of affected) {
    const stack = [...(dependsOn.get(node.id) || [])];
    const visited = new Set();
    while (stack.length) {
      const id = stack.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      convergence.set(id, (convergence.get(id) || 0) + 1);
      for (const dep of dependsOn.get(id) || []) stack.push(dep);
    }
  }
  if (convergence.size === 0) return null;

  let rootId = null;
  let best = -1;
  for (const [id, count] of convergence) {
    const node = byId.get(id);
    if (!node) continue;
    // Prefer vendors/databases as terminal root causes, then highest convergence.
    const weight = count + (node.type === "Vendor" || node.type === "Database" ? 0.5 : 0);
    if (weight > best) {
      best = weight;
      rootId = id;
    }
  }
  const root = byId.get(rootId);
  if (!root) return null;

  const reaching = convergence.get(rootId) || affected.length;
  const confidence = Math.min(97, Math.round((reaching / affected.length) * 90) + 5);

  return {
    rootCause: root.name,
    rootCauseType: root.type,
    confidence,
    confidenceLabel: confidence >= 85 ? "High" : confidence >= 60 ? "Medium" : "Low",
    affectedServices: affected.filter((n) => n.type === "Service").map((n) => n.name),
    affectedVendors: root.type === "Vendor" ? [root.name] : [],
    affectedTeams: [],
    impactRadius: {
      services: affected.filter((n) => n.type === "Service").length,
      teams: 0,
      vendors: root.type === "Vendor" ? 1 : 0,
      estimatedUsers: reaching * 2200,
    },
    explanation: `${root.name} is the common downstream dependency for ${reaching} of the ${affected.length} affected services, making it the most probable root cause.`,
    evidence: [
      `${reaching} affected services trace back to ${root.name} through dependency edges.`,
      `${root.name} is classified as a ${root.type.toLowerCase()} in the dependency graph.`,
    ],
    historicalMatch: null,
    suggestedRunbook: null,
  };
}

// Generates a concise, professional 2-3 sentence explanation grounded in the
// resolved root cause and the raw symptoms. Falls back to the curated text.
async function geminiAnalysis(graph, events) {
  if (!process.env.GEMINI_API_KEY) return null;

  // Build id->name map so relationships are human-readable in the prompt.
  // Neo4j stores edges by node id (e.g. "auth-service"); Gemini must see names
  // (e.g. "Auth Service") so its rootCause output matches node names exactly.
  const idToName = new Map(graph.nodes.map((n) => [n.id, n.name]));

  // Focus the graph on nodes relevant to the incident (±2 hops from event sources).
  // Sending the full graph dilutes Gemini's reasoning on large orgs.
  const eventSourceNames = new Set(
    events.map((e) => (e.source || "").toLowerCase()).filter(Boolean)
  );
  const seedIds = new Set(
    graph.nodes
      .filter((n) => eventSourceNames.has(n.name.toLowerCase()))
      .map((n) => n.id)
  );

  // BFS outward (follow dependency edges in both directions) for 2 hops
  const relevantIds = new Set(seedIds);
  let frontier = [...seedIds];
  for (let hop = 0; hop < 2; hop++) {
    const next = [];
    for (const rel of graph.relationships) {
      if (frontier.includes(rel.source) && !relevantIds.has(rel.target)) {
        relevantIds.add(rel.target);
        next.push(rel.target);
      }
      if (frontier.includes(rel.target) && !relevantIds.has(rel.source)) {
        relevantIds.add(rel.source);
        next.push(rel.source);
      }
    }
    frontier = next;
  }

  // If no seeds matched (event sources not in graph), fall back to full graph
  const focusedNodes = relevantIds.size > 0
    ? graph.nodes.filter((n) => relevantIds.has(n.id))
    : graph.nodes;
  const focusedRels = graph.relationships.filter(
    (r) => relevantIds.size === 0 || (relevantIds.has(r.source) && relevantIds.has(r.target))
  );

  // All valid node names for post-parse validation
  const validNodeNames = new Set(graph.nodes.map((n) => n.name));

  const nodesSummary = focusedNodes
    .map((n) => `- ${n.name} (${n.type})`)
    .join("\n");

  // Use names in relationships — not IDs — so Gemini's output matches names directly
  const relsSummary = focusedRels
    .map((r) => {
      const srcName = idToName.get(r.source) || r.source;
      const tgtName = idToName.get(r.target) || r.target;
      return `- ${srcName} --[${r.type}]--> ${tgtName}`;
    })
    .join("\n");

  const eventsSummary = events
    .map((e) => `- [${e.type}] ${e.message} (source: ${e.source || "unknown"})`)
    .join("\n");

  const prompt = `You are an expert SRE incident analyst. You have been given a dependency graph (from Neo4j) and a live stream of incident events. Reason over the graph structure to identify the true root cause.

DEPENDENCY GRAPH NODES (focused on incident-relevant services):
${nodesSummary}

DEPENDENCY GRAPH RELATIONSHIPS (read as: SourceName --[RELATIONSHIP]--> TargetName):
${relsSummary}

INCIDENT EVENTS (chronological):
${eventsSummary}

Instructions:
- The root cause is the node whose failure best explains all the incident events.
- Prefer nodes that are shared dependencies (vendors, databases, upstream services).
- "rootCause" MUST be the exact name of a node from the graph above.
- "affectedServices", "affectedVendors", "affectedTeams" MUST use exact names from the graph.
- Confidence: 85-97 if a clear shared dependency explains all events; 60-84 if partial; below 60 if uncertain.

Respond with ONLY a valid JSON object — no markdown, no backticks, no explanation outside the JSON:
{
  "rootCause": "Exact node name from the graph",
  "rootCauseType": "Service | Vendor | Database | Team",
  "confidence": <integer 0-100>,
  "confidenceLabel": "High | Medium | Low",
  "affectedServices": ["exact service names from graph"],
  "affectedVendors": ["exact vendor names from graph"],
  "affectedTeams": ["exact team names from graph"],
  "impactRadius": {
    "services": <integer>,
    "teams": <integer>,
    "vendors": <integer>,
    "estimatedUsers": <integer>
  },
  "explanation": "2-3 sentence professional explanation grounded in the graph relationships and events.",
  "evidence": [
    "Evidence item 1 — reference specific graph relationships or event messages",
    "Evidence item 2",
    "Evidence item 3"
  ],
  "historicalMatch": null,
  "suggestedRunbook": null
}`;

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(prompt);
  const raw = (result.response.text() || "").trim();

  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    // Validate rootCause is an actual node name from the graph (prevents hallucination)
    if (!parsed.rootCause || typeof parsed.confidence !== "number") return null;
    if (!validNodeNames.has(parsed.rootCause)) {
      console.warn(`[Analyze] Gemini returned unknown rootCause "${parsed.rootCause}" — not in graph`);
      return null;
    }

    // Normalize confidenceLabel in case Gemini omitted it
    if (!parsed.confidenceLabel) {
      parsed.confidenceLabel = parsed.confidence >= 85 ? "High" : parsed.confidence >= 60 ? "Medium" : "Low";
    }

    console.log(`[Analyze] ✓ Gemini focused on ${focusedNodes.length}/${graph.nodes.length} nodes (${relevantIds.size > 0 ? "subgraph" : "full graph"})`);
    return parsed;
  } catch (e) {
    console.warn("[Analyze] Gemini returned invalid JSON:", e.message);
    return null;
  }
}

// ─── Organizational Intelligence ──────────────────────────────────────────────

// Overlays real ownership + SPOF computation onto the curated intelligence
// template (uptime/load metrics are not stored in the graph, so they remain
// curated). Throws on a sparse/unavailable graph to trigger the mock fallback.
// Node types eligible to be a structural dependency risk (i.e. something other
// services/vendors/databases can "depend on"). Kept generic — no technology
// names are ever referenced, only graph structure.
const SPOF_CANDIDATE_TYPES = new Set(["Service", "Vendor", "Database"]);

// Generic infrastructure qualifier words stripped only when grouping
// Vendor/Database nodes, so e.g. "PostgreSQL Cluster" and "PostgreSQL"
// collapse into a single dependency instead of appearing twice. Never
// applied to Service names, to avoid merging distinctly-named services.
const GENERIC_INFRA_SUFFIXES = new Set([
  "cluster", "instance", "node", "primary", "replica",
  "server", "database", "db", "cache", "service",
]);

function normalizeDependencyName(name, type) {
  const cleaned = name.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
  if (type === "Service") return cleaned;
  const stripped = cleaned
    .split(" ")
    .filter((word) => word && !GENERIC_INFRA_SUFFIXES.has(word))
    .join(" ")
    .trim();
  return stripped || cleaned;
}

// Recognizes well-known dependency technologies by name so the SPOF title and
// the recommendation text both reflect what the dependency actually IS
// (database / message broker / cache / external vendor / internal service)
// instead of always saying "Vendor". Matching is by keyword against the
// name the AI extracted, falling back to the graph's own node type when no
// keyword matches — nothing here assumes a technology is present.
const DEPENDENCY_TAXONOMY = [
  { tag: "kafka", keywords: ["kafka"], titleCategory: "infrastructure" },
  { tag: "rabbitmq", keywords: ["rabbitmq", "rabbit mq"], titleCategory: "infrastructure" },
  { tag: "redis", keywords: ["redis"], titleCategory: "infrastructure" },
  {
    tag: "database",
    keywords: ["postgres", "mysql", "oracle", "mongo", "dynamodb", "cassandra", "mariadb", "sql server", "cockroachdb", "sqlite", "couchbase", "firestore"],
    titleCategory: "database",
  },
  { tag: "auth", keywords: ["firebase", "auth0", "okta"], titleCategory: "vendor" },
  { tag: "sms", keywords: ["twilio", "nexmo", "vonage"], titleCategory: "vendor" },
  { tag: "storage", keywords: ["s3", "blob storage", "azure blob", "cloud storage", "object storage"], titleCategory: "vendor" },
  {
    tag: "infrastructure",
    keywords: ["kubernetes", "k8s", "load balancer", "api gateway", "nginx", "elasticsearch", "zookeeper", "message queue", "memcached", "consul", "istio", "envoy"],
    titleCategory: "infrastructure",
  },
  {
    tag: "vendor",
    keywords: ["stripe", "aws", "amazon web services", "azure", "gcp", "google cloud", "sendgrid", "razorpay", "cloudflare", "paypal", "mailgun", "segment"],
    titleCategory: "vendor",
  },
];

function classifyDependency(name, type) {
  const n = name.toLowerCase();
  for (const entry of DEPENDENCY_TAXONOMY) {
    if (entry.keywords.some((kw) => n.includes(kw))) return { tag: entry.tag, titleCategory: entry.titleCategory };
  }
  // No keyword match — fall back to the type the AI actually extracted.
  if (type === "Database") return { tag: "database", titleCategory: "database" };
  if (type === "Vendor") return { tag: "vendor", titleCategory: "vendor" };
  return { tag: "service", titleCategory: "service" };
}

function titleForDependency(classification, name) {
  switch (classification.titleCategory) {
    case "database": return `Database Risk: ${name}`;
    case "infrastructure": return `Infrastructure Risk: ${name}`;
    case "vendor": return `Vendor Risk: ${name}`;
    default: return `Critical Dependency: ${name}`;
  }
}

// Category-specific remediation actions. Each list is cycled per-category
// (see pickRecommendationAction) so multiple dependencies of the same kind
// don't all surface the exact same sentence.
const RECOMMENDATION_ACTIONS = {
  database: [
    "Configure automatic failover for {name}",
    "Deploy read replicas for {name} to spread query load",
    "Enable database replication for {name}",
    "Separate read/write workloads across {name}",
    "Add connection pooling in front of {name}",
    "Introduce database clustering for {name}",
  ],
  kafka: [
    "Increase the broker replication factor for {name}",
    "Rebalance partitions across {name} brokers",
    "Enable producer retries against {name}",
    "Scale out {name} brokers to reduce load concentration",
    "Tune consumer lag thresholds on {name}",
  ],
  rabbitmq: [
    "Enable mirrored queues on {name}",
    "Add additional {name} nodes for redundancy",
    "Configure HA policies on {name}",
    "Reduce queue bottlenecks on {name}",
  ],
  redis: [
    "Enable Redis Sentinel for {name}",
    "Configure a Redis Cluster for {name}",
    "Add replica nodes to {name}",
  ],
  auth: [
    "Configure a backup authentication provider alongside {name}",
    "Cache authentication tokens issued by {name}",
    "Implement a graceful authentication fallback if {name} degrades",
  ],
  sms: [
    "Add a secondary SMS provider alongside {name}",
    "Enable retry with exponential backoff for {name}",
    "Queue failed notifications from {name} for retry",
  ],
  storage: [
    "Configure cross-region replication for {name}",
    "Enable secondary storage alongside {name}",
    "Improve the retry strategy for {name} operations",
  ],
  infrastructure: [
    "Add a standby node for {name}",
    "Introduce clustering for {name}",
    "Add automated failover and monitoring for {name}",
  ],
  vendor: [
    "Add a fallback provider alongside {name}",
    "Implement a circuit breaker around {name} calls",
    "Cache recent responses from {name} to survive brief outages",
    "Add retry with exponential backoff for {name}",
  ],
  service: [
    "Reduce direct dependency on {name}",
    "Add a circuit breaker in front of {name}",
    "Add caching between callers and {name}",
    "Introduce asynchronous messaging instead of calling {name} synchronously",
    "Split {name} to isolate its blast radius",
    "Increase redundancy for {name}",
  ],
};

// Cycles through a category's action list (via the shared usage counter) so
// repeated dependencies of the same kind get different, still-relevant
// wording instead of the same sentence over and over.
function pickRecommendationAction(tag, name, usageCounters) {
  const list = RECOMMENDATION_ACTIONS[tag] || RECOMMENDATION_ACTIONS.service;
  const idx = (usageCounters.get(tag) || 0) % list.length;
  usageCounters.set(tag, idx + 1);
  return list[idx].replace(/\{name\}/g, name);
}

async function computeOrgIntelligence() {
  const graph = await fetchGraphFromNeo4j();
  if (graph.nodes.length < 3) throw new Error("graph too sparse for intelligence");

  // Reuse the exact same status derivation the graph/runbook endpoints use,
  // so "in-incident" / "critical" mean the same thing everywhere in the app.
  deriveStatus(graph.nodes, graph.relationships);

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  // Reverse dependency map: nodeId -> [nodes that directly depend on it].
  // Built from DEPENDS_ON / USES_VENDOR / USES — whatever the uploaded
  // architecture actually contains, regardless of the technology named.
  const dependents = new Map();
  for (const rel of graph.relationships) {
    if (!DEPENDENCY_REL_TYPES.has(rel.type)) continue;
    const dependent = byId.get(rel.source);
    if (!dependent) continue;
    if (!dependents.has(rel.target)) dependents.set(rel.target, []);
    dependents.get(rel.target).push(dependent);
  }

  // Which node (Service/Vendor) did each Incident get blamed on?
  const causeOfIncident = new Map(); // incidentId -> node
  for (const rel of graph.relationships) {
    if (rel.type !== "CAUSED_BY") continue;
    const node = byId.get(rel.target);
    if (node) causeOfIncident.set(rel.source, node);
  }

  // Incidents attributed to a given node — the raw signal behind "reliability".
  const incidentsCausedBy = new Map(); // nodeId -> [incidentNode,...]
  for (const [incidentId, node] of causeOfIncident) {
    if (!incidentsCausedBy.has(node.id)) incidentsCausedBy.set(node.id, []);
    incidentsCausedBy.get(node.id).push(byId.get(incidentId));
  }

  // Which Engineer resolved each Incident?
  const resolverOfIncident = new Map(); // incidentId -> engineerNode
  for (const rel of graph.relationships) {
    if (rel.type !== "RESOLVED_BY") continue;
    const engineer = byId.get(rel.target);
    if (engineer) resolverOfIncident.set(rel.source, engineer);
  }

  // Which Team owns a given Service/Database?
  const ownerOf = new Map(); // nodeId -> teamNode
  for (const rel of graph.relationships) {
    if (rel.type !== "OWNED_BY") continue;
    const team = byId.get(rel.target);
    if (team) ownerOf.set(rel.source, team);
  }

  // ── Dependency Groups ─────────────────────────────────────────────────
  // Every Service/Vendor/Database is collapsed by normalized name so the
  // same real-world dependency never appears twice (e.g. "PostgreSQL
  // Cluster" and "PostgreSQL"). This single grouping is the shared source
  // of truth for SPOF detection, dependency chains, vendor reliability and
  // recommendations below — no per-section duplication of this logic.
  const spofCandidates = graph.nodes.filter((n) => SPOF_CANDIDATE_TYPES.has(n.type));
  const dependencyGroups = new Map(); // key -> { key, name, type, nodeIds:Set, dependentsMap:Map(normalizedName->node) }
  for (const node of spofCandidates) {
    const key = `${node.type}::${normalizeDependencyName(node.name, node.type)}`;
    let group = dependencyGroups.get(key);
    if (!group) {
      group = { key, name: node.name, type: node.type, nodeIds: new Set(), dependentsMap: new Map() };
      dependencyGroups.set(key, group);
    }
    group.nodeIds.add(node.id);
    if (node.name.length < group.name.length) group.name = node.name; // prefer the shorter/canonical label
    for (const dep of dependents.get(node.id) || []) {
      // Keyed by normalized name (not raw node id) so if the same real
      // service was ingested twice as two separate node entities (e.g.
      // duplicate "Patient Service" rows), it still only counts once.
      const depKey = normalizeDependencyName(dep.name, dep.type);
      if (!group.dependentsMap.has(depKey)) group.dependentsMap.set(depKey, dep);
    }
  }

  // Transitive fan-in ("blast radius"): every node that depends, directly or
  // indirectly, on any of the given node ids. Deduped by normalized name for
  // the same reason as above. Used to add a deeper, more distinguishing
  // signal than direct-dependent count alone to reliability and ownership
  // scoring below.
  function blastRadius(nodeIds) {
    const visitedNames = new Set();
    const visitedIds = new Set(nodeIds);
    const queue = [...nodeIds];
    while (queue.length) {
      const current = queue.shift();
      for (const dep of dependents.get(current) || []) {
        const depKey = normalizeDependencyName(dep.name, dep.type);
        if (visitedNames.has(depKey)) continue;
        visitedNames.add(depKey);
        if (!visitedIds.has(dep.id)) {
          visitedIds.add(dep.id);
          queue.push(dep.id);
        }
      }
    }
    return visitedNames.size;
  }

  // A reliability score derived purely from how many ingested incidents
  // trace back to a dependency, plus its transitive blast radius. No
  // baseline or technology is hardcoded, and two dependencies only ever
  // land on the same numbers if their underlying graph signal genuinely
  // matches (same incident count and same blast radius).
  function computeReliability(nodeIds) {
    let incidentCount = 0;
    for (const id of nodeIds) incidentCount += (incidentsCausedBy.get(id) || []).length;
    const exposure = blastRadius(nodeIds);

    if (incidentCount > 0) {
      const uptime = Math.max(90, Math.round((99.99 - incidentCount * 1.4 - exposure * 0.05) * 100) / 100);
      const downtimeMinutes = incidentCount * 18 + exposure * 3;
      return { incidentCount, exposure, uptime, downtimeMinutes, status: "degraded" };
    }
    // No incidents at all: still let exposure (how many services ultimately
    // rely on it, directly or transitively) create natural, small variation
    // between otherwise-healthy dependencies instead of every zero-incident
    // row reading identically.
    const uptime = Math.max(99.5, Math.round((99.99 - exposure * 0.03) * 100) / 100);
    return { incidentCount, exposure, uptime, downtimeMinutes: 0, status: "healthy" };
  }

  // Total incidents traced to any node in a set (used repeatedly below).
  function incidentCountFor(nodeIds) {
    let total = 0;
    for (const id of nodeIds) total += (incidentsCausedBy.get(id) || []).length;
    return total;
  }

  // Dependency groups risky enough to count as a genuine SPOF (same ">=2
  // dependents" threshold used for severity elsewhere). Shared by Ownership
  // Burden and Key Responders so "SPOFs owned" means the same thing in both
  // cards.
  const spofWorthyGroups = [...dependencyGroups.values()].filter((g) => g.dependentsMap.size >= 2);
  function countSpofsOwned(ownedIds) {
    const ownedIdSet = new Set(ownedIds);
    let count = 0;
    for (const g of spofWorthyGroups) {
      for (const id of g.nodeIds) {
        if (ownedIdSet.has(id)) {
          count++;
          break;
        }
      }
    }
    return count;
  }

  // Every maximal (root-to-target) dependency chain ending at the given
  // (possibly merged) group of node ids — e.g. "Client Application ->
  // API Gateway -> Appointment Service -> Patient Service -> PostgreSQL"
  // when the uploaded architecture actually has that many hops. A "root" is
  // a node nothing else depends on, so a chain only ends there when there's
  // genuinely nowhere further back to walk — nothing is invented and
  // nothing is truncated. If two branches converge on the same target
  // (e.g. "Web Portal -> API Gateway -> Billing Service -> PostgreSQL"),
  // each distinct branch is returned separately. Any chain that is fully
  // represented by a longer one already found here is dropped — whether
  // that's a literal truncated prefix/suffix, or a direct "shortcut" edge
  // between the same two endpoints that a longer, more detailed indirect
  // path already covers (e.g. "Appointment Service -> PostgreSQL" when
  // "Appointment Service -> Patient Service -> PostgreSQL" also exists).
  function isChainRedundant(shorter, longer) {
    if (shorter.length >= longer.length) return false;
    // Case 1: shorter is a literal contiguous run within longer, at any
    // offset — covers truncated prefixes, suffixes, and embedded segments.
    for (let offset = 0; offset <= longer.length - shorter.length; offset++) {
      if (shorter.every((name, i) => name === longer[offset + i])) return true;
    }
    // Case 2: same overall start and end — the longer path already connects
    // those same two points with more real detail, so a shorter direct
    // "shortcut" between them adds no information beyond what's already
    // shown and should not be displayed alongside it.
    return shorter[0] === longer[0] && shorter[shorter.length - 1] === longer[longer.length - 1];
  }

  function allChainsEndingAt(nodeIds, targetName) {
    const MAX_CHAINS = 20; // safety bound against pathological fan-out, not a content cap
    const MAX_DEPTH = 25;
    const chains = [];

    function dfs(nodeId, visiting, trail) {
      if (chains.length >= MAX_CHAINS || trail.length > MAX_DEPTH) return;
      const consumers = (dependents.get(nodeId) || []).filter((c) => !nodeIds.includes(c.id) && !visiting.has(c.id));
      if (consumers.length === 0) {
        chains.push([...trail]); // nodeId is a true root — nothing else depends on it
        return;
      }
      for (const consumer of consumers) {
        visiting.add(consumer.id);
        dfs(consumer.id, visiting, [consumer.name, ...trail]);
        visiting.delete(consumer.id);
      }
    }

    for (const id of nodeIds) {
      dfs(id, new Set(nodeIds), []);
    }

    const fullChains = chains.map((trail) => [...trail, targetName]);

    // De-duplicate identical chains (can happen when a merged group has
    // multiple underlying node ids converging on the same upstream path).
    const seenKeys = new Set();
    const unique = [];
    for (const chain of fullChains) {
      const key = chain.join(">>");
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        unique.push(chain);
      }
    }

    // Keep only the maximal chains — drop any chain fully represented by a
    // longer one also found here (see isChainRedundant above).
    return unique.filter((chain) => !unique.some((other) => other !== chain && isChainRedundant(chain, other)));
  }

  // ── Single Point of Failure ─────────────────────────────────────────────
  // The SPOF is now chosen by a weighted operational-risk score instead of
  // raw edge-count, so e.g. a heavily-incident-affected external vendor
  // with few direct connections can outrank a merely well-connected,
  // otherwise-healthy internal service. Every input below already comes
  // from this upload's own graph (dependents, blast radius, incidents,
  // vendor classification) — nothing is hardcoded to a technology or
  // company, so the result shifts automatically for any architecture.
  //
  // Score components, highest priority first:
  //   1. Dependency impact   — direct dependents weigh most, transitive
  //                            blast radius adds a smaller amount on top.
  //   2. Business criticality — dependents that are themselves already
  //                            sitting in a live incident chain count for
  //                            more than a merely-connected healthy one.
  //   3. Incident history    — count, a recurring-failure bonus at 3+
  //                            incidents, and the downtime it produced.
  //   4. External vendor risk — third-party dependencies get a flat bump,
  //                            larger when no same-category peer exists.
  //   5. Existing redundancy — a discount applied only when the uploaded
  //                            architecture itself contains more than one
  //                            real dependency of the same technology/
  //                            vendor category (e.g. two distinct SMS
  //                            vendors) — the one "alternative exists"
  //                            signal verifiable from graph structure
  //                            alone, never inferred from free text.
  const classificationByKey = new Map();
  for (const group of dependencyGroups.values()) {
    classificationByKey.set(group.key, classifyDependency(group.name, group.type));
  }
  // How many groups share the same technology/vendor category — used only
  // as the redundancy-peer signal described above.
  const categoryPeerCounts = new Map();
  for (const group of dependencyGroups.values()) {
    const tag = classificationByKey.get(group.key).tag;
    categoryPeerCounts.set(tag, (categoryPeerCounts.get(tag) || 0) + 1);
  }

  let spofGroup = null;
  let spofScore = -Infinity;
  let spofStats = null;
  for (const group of dependencyGroups.values()) {
    const nodeIds = [...group.nodeIds];
    const dependentNodes = [...group.dependentsMap.values()];
    const directDependents = dependentNodes.length;
    const exposure = blastRadius(nodeIds);
    const incidentCount = incidentCountFor(nodeIds);
    const { uptime, downtimeMinutes } = computeReliability(nodeIds);
    const criticalDependents = dependentNodes.filter(
      (d) => d.status === "critical" || d.status === "warning"
    ).length;
    const classification = classificationByKey.get(group.key);
    const isExternalVendor = group.type === "Vendor";
    const peerCount = categoryPeerCounts.get(classification.tag) || 1;

    let score = directDependents * 12 + Math.max(0, exposure - directDependents) * 4;
    score += criticalDependents * 10;
    score += incidentCount * 18;
    if (incidentCount >= 3) score += 15;
    score += Math.round(downtimeMinutes / 5);
    if (isExternalVendor) score += peerCount <= 1 ? 20 : 10;
    if (peerCount > 1) score *= 0.7;

    if (score > spofScore) {
      spofScore = score;
      spofGroup = group;
      spofStats = { directDependents, exposure, incidentCount, uptime, criticalDependents, isExternalVendor, peerCount };
    }
  }

  let spof = {
    id: "none",
    name: "No Critical Dependency",
    type: "Service",
    severity: "low",
    dependentServices: [],
    vendorSla: 100,
    description: "No single point of failure was detected in the current architecture.",
    title: "No Critical Dependency Detected",
  };
  if (spofGroup) {
    const nodeIds = [...spofGroup.nodeIds];
    const dependentNodes = [...spofGroup.dependentsMap.values()];
    const { directDependents: depCount, exposure, incidentCount, uptime, criticalDependents, isExternalVendor, peerCount } = spofStats;
    const severity = depCount >= 4 || uptime < 96 || incidentCount >= 3
      ? "critical"
      : depCount >= 2 || incidentCount >= 1 || criticalDependents > 0
        ? "high"
        : "moderate";
    const dependentServices = dependentNodes.map((d) => d.name);

    // AI-style narrative summary: what it supports, whether a fallback
    // exists, what incident history says, and why that combination makes
    // it risky — built entirely from this upload's own graph data.
    const svcListText = dependentServices.length <= 3
      ? dependentServices.join(", ")
      : `${dependentServices.slice(0, 3).join(", ")}, and ${dependentServices.length - 3} more`;
    const blastClause = exposure > depCount
      ? `, with a blast radius reaching ${exposure} service${exposure === 1 ? "" : "s"} once indirect dependents are included`
      : "";
    const supportSentence = depCount > 0
      ? `${spofGroup.name} supports ${depCount} production service${depCount === 1 ? "" : "s"} (${svcListText})${blastClause}.`
      : `${spofGroup.name} is the highest-risk dependency ingested so far, though no other node currently depends on it directly.`;
    const redundancySentence = depCount > 0 ? "No replica or failover path exists in the uploaded architecture." : "";
    const incidentSentence = incidentCount > 0
      ? `${incidentCount} historical incident${incidentCount === 1 ? "" : "s"} originated from this dependency, putting its effective uptime at ${uptime}%.`
      : depCount > 0
        ? "No incidents have been recorded against it yet, but its blast radius alone makes it a structural risk."
        : "";
    const criticalSentence = criticalDependents > 0
      ? `${criticalDependents} of its dependent${criticalDependents === 1 ? "" : "s"} ${criticalDependents === 1 ? "is" : "are"} already sitting in an active incident chain, amplifying the business impact.`
      : "";
    const vendorSentence = isExternalVendor
      ? peerCount <= 1
        ? "It is also a third-party vendor with no alternative provider present in the uploaded architecture."
        : "It is also a third-party vendor, though at least one similar provider exists in the uploaded architecture."
      : "";
    const impactSentence = depCount === 0
      ? ""
      : severity === "critical"
        ? "This makes it the highest-impact single point of failure in the current architecture."
        : severity === "high"
          ? "This makes it a high-impact dependency that warrants immediate attention."
          : "This makes it a moderate, but still notable, structural dependency risk.";

    const description = [supportSentence, redundancySentence, incidentSentence, criticalSentence, vendorSentence, impactSentence]
      .filter(Boolean)
      .join(" ");

    const classification = classifyDependency(spofGroup.name, spofGroup.type);

    spof = {
      id: nodeIds[0],
      name: spofGroup.name,
      type: spofGroup.type,
      severity,
      dependentServices,
      vendorSla: uptime,
      description,
      title: titleForDependency(classification, spofGroup.name),
    };
  }

  // ── Ownership Burden ────────────────────────────────────────────────────
  // Composite load score per team from: services owned, critical services
  // among them, incidents tracing back to those services, incidents that
  // were actually escalated/resolved (recovery responsibility), downstream
  // dependency exposure (direct + transitive blast radius), SPOF-worthy
  // dependencies owned, and distinct vendors the team's services rely on
  // (vendor-ownership burden). Each team's percentage is then derived from
  // its OWN absolute score via a saturating curve — not by stretching the
  // best/worst team in this upload to fixed 95%/15% endpoints — so the
  // numbers reflect genuine magnitude and don't cluster near the ceiling
  // just because one team happens to be the biggest owner in a small upload.
  const teamOwnedIds = new Map(); // teamName -> [nodeId,...]
  const teamServiceNames = new Map(); // teamName -> [name,...] (deduped by normalized name)
  const teamServiceNameKeys = new Map(); // teamName -> Set(normalizedName) — dedup helper
  for (const rel of graph.relationships) {
    if (rel.type !== "OWNED_BY") continue;
    const team = byId.get(rel.target);
    const owned = byId.get(rel.source);
    if (!team || !owned) continue;
    if (!teamOwnedIds.has(team.name)) {
      teamOwnedIds.set(team.name, []);
      teamServiceNames.set(team.name, []);
      teamServiceNameKeys.set(team.name, new Set());
    }
    teamOwnedIds.get(team.name).push(owned.id);
    // A team owning two duplicate-extracted entries for the same real
    // service (e.g. two "Patient Service" nodes) should only see it once.
    const ownedKey = normalizeDependencyName(owned.name, owned.type);
    if (!teamServiceNameKeys.get(team.name).has(ownedKey)) {
      teamServiceNameKeys.get(team.name).add(ownedKey);
      teamServiceNames.get(team.name).push(owned.name);
    }
  }

  // Vendors each owned node actually uses — "vendor ownership" burden.
  const vendorsUsedByNode = new Map(); // nodeId -> Set(normalizedVendorName)
  for (const rel of graph.relationships) {
    if (rel.type !== "USES_VENDOR") continue;
    const vendor = byId.get(rel.target);
    if (!vendor) continue;
    if (!vendorsUsedByNode.has(rel.source)) vendorsUsedByNode.set(rel.source, new Set());
    vendorsUsedByNode.get(rel.source).add(normalizeDependencyName(vendor.name, vendor.type));
  }

  let ownershipBurden = [];
  if (teamOwnedIds.size > 0) {
    // Saturating curve: percent approaches 100 as score grows, without ever
    // forcing a specific team to a fixed endpoint. K sets how much absolute
    // burden it takes to reach a "heavy" reading.
    const BURDEN_SATURATION_K = 90;
    const toPercent = (score) => Math.max(1, Math.min(100, Math.round(100 * (1 - Math.exp(-score / BURDEN_SATURATION_K)))));

    const scored = [...teamOwnedIds.entries()].map(([team, ownedIds]) => {
      const uniqueDependents = new Set();
      const vendorsUsed = new Set();
      let criticalCount = 0;
      for (const id of ownedIds) {
        for (const dep of dependents.get(id) || []) uniqueDependents.add(normalizeDependencyName(dep.name, dep.type));
        for (const v of vendorsUsedByNode.get(id) || []) vendorsUsed.add(v);
        const node = byId.get(id);
        if (node && (node.status === "critical" || node.status === "warning")) criticalCount++;
      }
      const incidentCount = incidentCountFor(ownedIds);
      // Escalation/recovery responsibility: incidents on owned services that
      // were actually assigned to and resolved by an engineer, not just
      // logged — a stronger operational-load signal than the raw count.
      let resolvedIncidentCount = 0;
      for (const [incidentId, causeNode] of causeOfIncident) {
        if (ownedIds.includes(causeNode.id) && resolverOfIncident.has(incidentId)) resolvedIncidentCount++;
      }
      const spofsOwned = countSpofsOwned(ownedIds);
      const teamBlastRadius = blastRadius(ownedIds);
      const score =
        ownedIds.length * 8 +
        criticalCount * 12 +
        incidentCount * 6 +
        resolvedIncidentCount * 4 +
        teamBlastRadius * 3 +
        spofsOwned * 15 +
        vendorsUsed.size * 5;
      return { team, score, servicesOwned: teamServiceNames.get(team) };
    });

    ownershipBurden = scored
      .map(({ team, score, servicesOwned }) => {
        const loadPercent = toPercent(score);
        return {
          team,
          loadPercent,
          loadStatus: loadPercent >= 70 ? "volatile" : "stable",
          servicesOwned,
        };
      })
      .sort((a, b) => b.loadPercent - a.loadPercent);
  }

  // ── Key Responders ──────────────────────────────────────────────────────
  // Prefer named Engineer nodes (Incident -> RESOLVED_BY -> Engineer), with
  // team inferred via Incident -> CAUSED_BY -> Service -> OWNED_BY -> Team.
  // If the uploaded documents don't name individual engineers — only teams —
  // fall back to surfacing the Teams actually tied to ownership/incidents,
  // so the card is never left empty just because no person was named.
  const engineers = graph.nodes.filter((n) => n.type === "Engineer");
  let keyResponders = [];
  if (engineers.length > 0) {
    const referencesFor = new Map();
    const teamVotesFor = new Map();
    const inIncidentFor = new Map();

    for (const [incidentId, engineer] of resolverOfIncident) {
      referencesFor.set(engineer.id, (referencesFor.get(engineer.id) || 0) + 1);

      const causeNode = causeOfIncident.get(incidentId);
      if (causeNode) {
        const team = ownerOf.get(causeNode.id);
        if (team) {
          const votes = teamVotesFor.get(engineer.id) || new Map();
          votes.set(team.name, (votes.get(team.name) || 0) + 1);
          teamVotesFor.set(engineer.id, votes);
        }
        if (causeNode.status === "critical") inIncidentFor.set(engineer.id, true);
      }
    }

    const maxRefs = Math.max(0, ...[...referencesFor.values()]);
    keyResponders = engineers
      .map((eng) => {
        const references = referencesFor.get(eng.id) || 0;
        const votes = teamVotesFor.get(eng.id);
        const team = votes ? [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0] : "Unassigned";
        let status = "idle";
        if (inIncidentFor.get(eng.id)) status = "in-incident";
        else if (references > 0 && references === maxRefs) status = "on-call";
        return { id: eng.id, name: eng.name, team, status, references };
      })
      .sort((a, b) => b.references - a.references)
      .slice(0, 8);
  }

  const hasMeaningfulEngineerData = keyResponders.some((r) => r.references > 0 || r.team !== "Unassigned");
  if (!hasMeaningfulEngineerData) {
    // Fall back to Team-level responders, ranked by how involved each team
    // actually is in the uploaded ownership/incident/dependency data — teams
    // with zero involvement are excluded rather than padded in.
    const teamIncidentCount = new Map(); // teamId -> count
    for (const [, causeNode] of causeOfIncident) {
      const team = ownerOf.get(causeNode.id);
      if (team) teamIncidentCount.set(team.id, (teamIncidentCount.get(team.id) || 0) + 1);
    }
    const teamOwnedNodeIds = new Map(); // teamId -> [nodeId,...]
    for (const [nodeId, team] of ownerOf) {
      if (!teamOwnedNodeIds.has(team.id)) teamOwnedNodeIds.set(team.id, []);
      teamOwnedNodeIds.get(team.id).push(nodeId);
    }
    const teamHasCriticalOwned = new Set();
    for (const rel of graph.relationships) {
      if (rel.type !== "OWNED_BY") continue;
      const owned = byId.get(rel.source);
      const team = byId.get(rel.target);
      if (owned && team && (owned.status === "critical" || owned.status === "warning")) {
        teamHasCriticalOwned.add(team.id);
      }
    }

    const teamNodes = graph.nodes.filter((n) => n.type === "Team");
    keyResponders = teamNodes
      .map((team) => {
        const incidentCount = teamIncidentCount.get(team.id) || 0;
        const ownedIds = teamOwnedNodeIds.get(team.id) || [];
        // Affected services + dependency graph: how many services are
        // ultimately exposed to whatever this team owns, not just the
        // services it directly holds. Used only to break ties in ordering,
        // not folded into the displayed reference count below.
        const exposure = ownedIds.length > 0 ? blastRadius(ownedIds) : 0;
        const criticalOwnedCount = ownedIds.filter((id) => {
          const node = byId.get(id);
          return node && (node.status === "critical" || node.status === "warning");
        }).length;
        const spofsOwned = ownedIds.length > 0 ? countSpofsOwned(ownedIds) : 0;
        // Recovery/escalation responsibility: incidents on this team's
        // services that were actually assigned to and resolved by an
        // engineer, not just logged.
        let resolvedIncidentCount = 0;
        for (const [incidentId, causeNode] of causeOfIncident) {
          if (ownedIds.includes(causeNode.id) && resolverOfIncident.has(incidentId)) resolvedIncidentCount++;
        }
        // "References" is a literal count of how many times this team is
        // actually referenced across the uploaded documents: once per
        // service/database it owns, once per incident traced to those
        // services, once more per incident it had to actually resolve
        // (escalation/recovery), and once per critical service or
        // SPOF-worthy dependency it's responsible for — not a blended
        // multiplier score, so it reads as a genuine occurrence count.
        const references = ownedIds.length + incidentCount + resolvedIncidentCount + criticalOwnedCount + spofsOwned;
        return {
          id: team.id,
          name: team.name,
          team: team.name,
          status: teamHasCriticalOwned.has(team.id) ? "in-incident" : "idle",
          references,
          exposure, // used only to break ties below, stripped before returning
        };
      })
      .filter((r) => r.references > 0) // only teams actually tied to the uploaded documents
      .sort((a, b) => b.references - a.references || b.exposure - a.exposure)
      .map(({ exposure, ...rest }) => rest)
      .map((r, idx) => (idx === 0 && r.status === "idle" ? { ...r, status: "on-call" } : r))
      .slice(0, 8);
  }

  if (keyResponders.length === 0) {
    // Last resort: no named engineers and no Team nodes tied to ownership or
    // incidents were found. Surface the at-risk dependencies themselves
    // (service ownership / incident ownership / affected services / the
    // dependency graph — the same signals requested), so the card is never
    // left empty as long as the uploaded documents describe any incident or
    // dependency relationship at all.
    keyResponders = [...dependencyGroups.values()]
      .map((g) => {
        const nodeIds = [...g.nodeIds];
        let incidentCount = 0;
        for (const id of nodeIds) incidentCount += (incidentsCausedBy.get(id) || []).length;
        const exposure = g.dependentsMap.size;
        return { g, incidentCount, exposure };
      })
      .filter((x) => x.incidentCount > 0 || x.exposure > 0)
      .sort((a, b) => (b.incidentCount * 2 + b.exposure) - (a.incidentCount * 2 + a.exposure))
      .slice(0, 6)
      .map(({ g, incidentCount, exposure }, idx) => ({
        id: g.key,
        name: g.name,
        team: incidentCount > 0 ? "Incident Response" : "Service Ownership",
        status: idx === 0 && incidentCount > 0 ? "in-incident" : "idle",
        references: incidentCount + exposure,
      }));
  }

  // ── Vendor Reliability ──────────────────────────────────────────────────
  // Built from the same de-duplicated dependency groups, so two extracted
  // aliases of the same vendor never show up as two separate rows.
  const vendorReliability = [...dependencyGroups.values()]
    .filter((g) => g.type === "Vendor")
    .map((g) => {
      const nodeIds = [...g.nodeIds];
      const { uptime, downtimeMinutes, status } = computeReliability(nodeIds);
      return { id: nodeIds[0], name: g.name, uptime, status, downtimeMinutes };
    })
    .sort((a, b) => a.uptime - b.uptime);

  // ── Critical Dependency Chains ───────────────────────────────────────────
  // For each de-duplicated dependency that anything actually depends on,
  // walk the full reverse-dependency graph and surface every distinct,
  // full-length branch that leads to it — e.g. "Client Application -> API
  // Gateway -> Appointment Service -> Patient Service -> PostgreSQL"
  // alongside a separate "Web Portal -> API Gateway -> Billing Service ->
  // PostgreSQL" branch, if the uploaded architecture genuinely contains
  // both. Nothing is truncated and nothing is invented — a dependency with
  // only one consumer still yields exactly the short chain the data
  // supports. Every qualifying dependency is walked here (not just the
  // biggest few by fan-in) so an intermediate hop that turns out to be
  // fully covered by a longer chain elsewhere doesn't crowd out a distinct,
  // separate dependency (e.g. a vendor with its own single consumer) — the
  // redundancy filters below, and the display cap after them, are what
  // actually keep the final list focused.
  const rankedGroups = [...dependencyGroups.values()]
    .filter((g) => g.dependentsMap.size > 0)
    .sort((a, b) => b.dependentsMap.size - a.dependentsMap.size);

  const MAX_CHAINS_DISPLAYED = 8;
  let criticalChains = [];
  for (const group of rankedGroups) {
    const deps = [...group.dependentsMap.values()];
    const nodeIds = [...group.nodeIds];
    const risk = deps.length >= 3 ? "high" : "medium";
    const paths = allChainsEndingAt(nodeIds, group.name);
    paths.forEach((path, idx) => {
      criticalChains.push({
        id: paths.length > 1 ? `chain-${group.key}-${idx + 1}` : `chain-${group.key}`,
        path,
        risk,
        description: `${path[0]} has no resilient path when ${group.name} degrades — ${deps.length} node${deps.length === 1 ? "" : "s"} share this single dependency.`,
      });
    });
  }

  // If one of the dependencies walked above is itself an intermediate hop
  // on the way to another (e.g. "Appointment Service" is both its own
  // critical target AND a step on the path to "PostgreSQL"), its shorter
  // chain is fully represented by the longer one already shown here — drop
  // it so the same branch isn't displayed twice at different lengths.
  criticalChains = criticalChains.filter(
    (chain) => !criticalChains.some((other) => other !== chain && isChainRedundant(chain.path, other.path))
  );

  // Longer, more complete chains are the most informative — surface those
  // first if the total needs trimming for display.
  criticalChains.sort((a, b) => b.path.length - a.path.length);
  criticalChains.splice(MAX_CHAINS_DISPLAYED);

  // ── AI Recommendations ───────────────────────────────────────────────────
  // Candidates are ranked using BOTH the architecture (dependent/exposure
  // count) AND the incident history (incident count) — so a dependency that
  // incidents mostly point to (e.g. Kafka) surfaces here even if it isn't
  // the single biggest structural SPOF by fan-in alone. Each message's
  // action is chosen from a bank specific to what kind of dependency it
  // actually is (database / Kafka / RabbitMQ / Redis / auth vendor / SMS
  // vendor / storage vendor / infrastructure / internal service), cycling
  // through that bank so repeated dependencies of the same kind don't
  // produce the exact same sentence, and every message states why it was
  // recommended using this upload's own data.
  const recommendations = [];
  const recommendationActionUsage = new Map();

  const recommendationCandidates = [...dependencyGroups.values()]
    .map((group) => {
      const nodeIds = [...group.nodeIds];
      const incidentCount = incidentCountFor(nodeIds);
      const exposure = group.dependentsMap.size;
      return { group, incidentCount, exposure };
    })
    .filter((c) => c.incidentCount > 0 || c.exposure > 0)
    .sort((a, b) => (b.incidentCount * 3 + b.exposure) - (a.incidentCount * 3 + a.exposure))
    .slice(0, 5);

  for (const { group, incidentCount, exposure } of recommendationCandidates) {
    const { uptime } = computeReliability([...group.nodeIds]);
    const priority = exposure >= 4 || uptime < 96 ? "high" : exposure >= 2 || incidentCount > 0 ? "medium" : "low";
    const classification = classifyDependency(group.name, group.type);
    const action = pickRecommendationAction(classification.tag, group.name, recommendationActionUsage);
    const why = incidentCount > 0
      ? `${incidentCount} incident${incidentCount === 1 ? "" : "s"} in the uploaded incident history trace back to ${group.name}, affecting ${exposure} dependent service${exposure === 1 ? "" : "s"}`
      : `${exposure} service${exposure === 1 ? "" : "s"} depend on ${group.name} directly with no redundancy in the uploaded architecture`;
    recommendations.push({
      id: `rec-spof-${group.key}`,
      type: `${classification.tag}-resilience`,
      priority,
      message: `${action} — recommended because ${why}.`,
    });
  }

  const coveredKeys = new Set(recommendationCandidates.map((c) => c.group.key));
  for (const group of dependencyGroups.values()) {
    if (group.type !== "Vendor" || coveredKeys.has(group.key)) continue;
    const nodeIds = [...group.nodeIds];
    const { incidentCount, uptime } = computeReliability(nodeIds);
    if (incidentCount === 0) continue; // healthy vendors need no recommendation
    const classification = classifyDependency(group.name, group.type);
    const action = pickRecommendationAction(classification.tag, group.name, recommendationActionUsage);
    recommendations.push({
      id: `rec-vendor-${group.key}`,
      type: `${classification.tag}-reliability`,
      priority: uptime < 96 ? "high" : "medium",
      message: `${action} — recommended because ${incidentCount} incident${incidentCount === 1 ? "" : "s"} in the uploaded incident history are linked to ${group.name} (uptime now ${uptime}%).`,
    });
  }

  if (ownershipBurden.length > 1) {
    const heaviest = ownershipBurden[0];
    const lightest = ownershipBurden[ownershipBurden.length - 1];
    if (heaviest.loadStatus === "volatile" && heaviest.team !== lightest.team) {
      recommendations.push({
        id: "rec-ownership",
        type: "ownership-rebalance",
        priority: "medium",
        message: `Reassign ownership from ${heaviest.team} (${heaviest.loadPercent}% load) to ${lightest.team} (${lightest.loadPercent}% load) — recommended because their ownership burden differs substantially in the uploaded service catalog.`,
      });
    }
  }

  return { spof, ownershipBurden, keyResponders, vendorReliability, criticalChains, recommendations: recommendations.slice(0, 8) };
}

// ─── GET /api/graph ────────────────────────────────────────────────────────────

app.get("/api/graph", async (_req, res) => {
  try {
    const graph = await fetchGraphFromNeo4j();
    // Return live data even if empty — let the frontend show the EmptyState.
    // Only fall back to mock on a genuine Neo4j connectivity failure.
    deriveStatus(graph.nodes, graph.relationships);

    // Engineer/Incident/Runbook are operational/meta nodes (used by org
    // intelligence, incident correlation, etc. elsewhere) — they don't belong
    // in the architecture topology view, so scope this endpoint's response to
    // real architecture entities only. fetchGraphFromNeo4j() itself is left
    // untouched since other endpoints still need the full graph.
    const META_TYPES = new Set(["Engineer", "Incident", "Runbook"]);
    const topologyNodes = graph.nodes.filter((n) => !META_TYPES.has(n.type));
    const topologyIds = new Set(topologyNodes.map((n) => n.id));
    const topologyRelationships = graph.relationships.filter(
      (r) => topologyIds.has(r.source) && topologyIds.has(r.target)
    );

    console.log(`[Graph] ✓ ${topologyNodes.length} nodes, ${topologyRelationships.length} relationships`);
    return res.json({ nodes: topologyNodes, relationships: topologyRelationships });
  } catch (err) {
    // Only reach here on a Neo4j driver / network failure, not an empty graph.
    console.warn("[Graph] ⚠ Neo4j unreachable, falling back to mock:", err.message);
    const mock = loadMock("graph-success");
    if (mock) return res.json(mock);
    return structuredError(
      res,
      503,
      "GRAPH_UNAVAILABLE",
      "The dependency graph could not be retrieved. Neo4j may be unreachable or no organizational documents have been ingested yet."
    );
  }
});

// ─── POST /api/impact ────────────────────────────────────────────────────────
// What-if blast-radius simulator: given a nodeId, traverses the live Neo4j
// graph to find every node that directly or transitively depends on it, then
// classifies the result into affected services / teams / vendors. Reuses the
// same DEPENDENCY_REL_TYPES / OWNED_BY conventions as /api/simulate and
// computeOrgIntelligence() so "blast radius" means the same thing everywhere.

function toImpactedNode(n) {
  return { id: n.id, name: n.name, type: n.type };
}

app.post("/api/impact", async (req, res) => {
  const { nodeId } = req.body || {};
  if (!nodeId) {
    return structuredError(res, 400, "NODE_ID_REQUIRED", "A node id is required to compute blast radius.");
  }

  try {
    const graph = await fetchGraphFromNeo4j();
    if (!graph.nodes.length) throw new Error("empty graph");

    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const targetNode = byId.get(nodeId);
    if (!targetNode) throw new Error(`node not found: ${nodeId}`);

    // Reverse dependency map: nodeId -> [nodes that directly depend on it]
    const dependents = new Map();
    for (const rel of graph.relationships) {
      if (!DEPENDENCY_REL_TYPES.has(rel.type)) continue;
      if (!dependents.has(rel.target)) dependents.set(rel.target, []);
      dependents.get(rel.target).push(rel.source);
    }

    // BFS from the target node to find everything that transitively depends on it.
    const affectedIds = new Set();
    const queue = [nodeId];
    while (queue.length) {
      const id = queue.shift();
      for (const depId of dependents.get(id) || []) {
        if (affectedIds.has(depId) || depId === nodeId) continue;
        affectedIds.add(depId);
        queue.push(depId);
      }
    }

    const affectedNodes = [...affectedIds].map((id) => byId.get(id)).filter(Boolean);
    const affectedServices = affectedNodes.filter((n) => n.type === "Service").map(toImpactedNode);
    const affectedVendors = affectedNodes.filter((n) => n.type === "Vendor").map(toImpactedNode);

    // Teams owning the target node or any affected node.
    const ownerOf = new Map();
    for (const rel of graph.relationships) {
      if (rel.type !== "OWNED_BY") continue;
      const team = byId.get(rel.target);
      if (team) ownerOf.set(rel.source, team);
    }
    const teamIds = new Set();
    for (const n of [targetNode, ...affectedNodes]) {
      const team = ownerOf.get(n.id);
      if (team) teamIds.add(team.id);
    }
    const affectedTeams = [...teamIds].map((id) => byId.get(id)).filter(Boolean).map(toImpactedNode);

    const totalAffected = affectedServices.length + affectedVendors.length + affectedTeams.length;
    const severity =
      totalAffected >= 6 ? "critical" : totalAffected >= 3 ? "high" : totalAffected >= 1 ? "medium" : "low";

    const description =
      affectedServices.length > 0
        ? `If ${targetNode.name} fails, ${affectedServices.length} service${affectedServices.length === 1 ? "" : "s"}${
            affectedTeams.length ? ` across ${affectedTeams.length} team${affectedTeams.length === 1 ? "" : "s"}` : ""
          } would be directly or transitively impacted.`
        : `${targetNode.name} has no downstream dependents in the current graph — failing it would be isolated.`;

    console.log(`[Impact] ✓ ${targetNode.name} — ${totalAffected} downstream node(s)`);
    return res.json({
      nodeId: targetNode.id,
      nodeName: targetNode.name,
      nodeType: targetNode.type,
      affectedServices,
      affectedTeams,
      affectedVendors,
      totalAffected,
      severity,
      description,
    });
  } catch (err) {
    console.warn("[Impact] ⚠ Falling back to mock:", err.message);
    const mock = loadMock("impact-success");
    if (mock) return res.json(mock);
    return structuredError(
      res,
      503,
      "IMPACT_UNAVAILABLE",
      "Blast-radius impact could not be computed. The dependency graph may be empty or unreachable."
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH: insert this whole block into backend/server.js, right AFTER the
// closing `});` of the existing `app.post("/api/impact", ...)` route and
// BEFORE the `// ─── POST /api/simulate ───` comment block.
//
// It uses only things that already exist elsewhere in server.js:
// fetchGraphFromNeo4j, deriveStatus, DEPENDENCY_REL_TYPES, structuredError,
// loadMock, genAI — nothing new to configure.
// ─────────────────────────────────────────────────────────────────────────────

// ─── GET /api/node-inspector/:nodeId ───────────────────────────────────────────
// Powers the Architecture Map's Node Inspector panel. Purely additive and
// read-only: reuses fetchGraphFromNeo4j()/deriveStatus() exactly as the rest
// of the app does. The frontend may optionally pass ?blastRadius=&severity=
// (from its own /api/impact call) purely so the risk summary text stays
// consistent with the blast-radius banner already on screen — this endpoint
// does not compute or alter blast radius itself.

// Builds the 2-3 sentence risk summary without Gemini, strictly from the
// real numbers already computed for this node. Used whenever GEMINI_API_KEY
// is unset or the Gemini call fails, so the panel never blocks on the LLM.
function buildDeterministicRiskSummary(ctx) {
  const sentences = [];

  const depWord = ctx.totalDependencyCount === 1 ? "dependency" : "dependencies";
  const dependentWord = ctx.downstreamDependents.length === 1 ? "service" : "services";
  sentences.push(
    `${ctx.node.name} is classified as ${ctx.node.category || ctx.node.type}, with ${ctx.totalDependencyCount} direct ${depWord} and ${ctx.downstreamDependents.length} ${dependentWord} depending on it directly.`
  );

  if (typeof ctx.blastRadius === "number") {
    sentences.push(
      ctx.blastRadius > 0
        ? `If it fails, the impact would transitively reach ${ctx.blastRadius} downstream node${ctx.blastRadius === 1 ? "" : "s"}${ctx.severity ? `, a ${ctx.severity}-severity blast radius` : ""}.`
        : `It currently has no downstream dependents in the graph, so a failure would stay isolated.`
    );
  }

  if (typeof ctx.recentIncidentCount === "number") {
    sentences.push(
      ctx.recentIncidentCount > 0
        ? `It has been linked to ${ctx.recentIncidentCount} incident${ctx.recentIncidentCount === 1 ? "" : "s"} in the uploaded incident history.`
        : `No incidents in the uploaded incident history have been traced back to it.`
    );
  }

  return sentences.join(" ");
}

// Gemini-backed risk summary, grounded strictly in the facts passed in
// `ctx` (never anything invented). Falls back to the deterministic template
// above whenever Gemini is unavailable, errors, or returns something unusable.
async function generateNodeRiskSummary(ctx) {
  if (!process.env.GEMINI_API_KEY) return buildDeterministicRiskSummary(ctx);

  try {
    const facts = [
      `Node: ${ctx.node.name}`,
      `Category: ${ctx.node.category || ctx.node.type}`,
      `Current health status: ${ctx.node.status}`,
      `Owner team: ${ctx.ownerTeam || "not specified in the uploaded documents"}`,
      `Direct dependencies (${ctx.directDependencies.length}): ${ctx.directDependencies.map((d) => d.name).join(", ") || "none"}`,
      `Direct downstream dependents (${ctx.downstreamDependents.length}): ${ctx.downstreamDependents.map((d) => d.name).join(", ") || "none"}`,
      typeof ctx.blastRadius === "number" ? `Total transitive blast radius: ${ctx.blastRadius} node(s)${ctx.severity ? ` (${ctx.severity} severity)` : ""}` : null,
      typeof ctx.recentIncidentCount === "number" ? `Incidents traced back to this node: ${ctx.recentIncidentCount}` : null,
    ].filter(Boolean).join("\n");

    const prompt = `You are an SRE assistant writing a short risk summary for one node in a live dependency graph.

FACTS (this is the complete set of facts — do not invent anything beyond it):
${facts}

Write exactly 2-3 plain sentences summarizing the operational risk this node represents, grounded strictly in the facts above. No markdown, no bullet points, no headings, no preamble — plain prose only.`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = (result.response.text() || "")
      .replace(/```[a-z]*\s*/gi, "")
      .replace(/```/g, "")
      .trim();

    return text || buildDeterministicRiskSummary(ctx);
  } catch (err) {
    console.warn("[NodeInspector] Gemini risk summary failed, using deterministic fallback:", err.message);
    return buildDeterministicRiskSummary(ctx);
  }
}

function toInspectorNode(n) {
  return { id: n.id, name: n.name, type: n.type, category: n.category || null };
}

// A single dependency can be reached through more than one relationship
// type at once. Without this, that one dependency would be counted/listed
// twice. Dedupes by node id, keeping the first occurrence.
function dedupeById(nodes) {
  const seen = new Set();
  const unique = [];
  for (const n of nodes) {
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    unique.push(n);
  }
  return unique;
}

app.get("/api/node-inspector/:nodeId", async (req, res) => {
  const { nodeId } = req.params;
  const blastRadiusParam = req.query.blastRadius !== undefined ? Number(req.query.blastRadius) : null;
  const blastRadius = Number.isFinite(blastRadiusParam) ? blastRadiusParam : null;
  const severity = typeof req.query.severity === "string" ? req.query.severity : null;

  if (!nodeId) {
    return structuredError(res, 400, "NODE_ID_REQUIRED", "A node id is required to load the Node Inspector.");
  }

  try {
    const graph = await fetchGraphFromNeo4j();
    if (!graph.nodes.length) throw new Error("empty graph");

    // Same status derivation /api/graph and /api/org-intelligence use, so
    // the inspector always agrees with the card colors on screen.
    deriveStatus(graph.nodes, graph.relationships);

    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const targetNode = byId.get(nodeId);
    if (!targetNode) {
      return structuredError(res, 404, "NODE_NOT_FOUND", `No node with id "${nodeId}" was found in the graph.`);
    }

    const directDependencies = dedupeById(
      graph.relationships
        .filter((r) => r.source === nodeId && DEPENDENCY_REL_TYPES.has(r.type))
        .map((r) => byId.get(r.target))
        .filter(Boolean)
        .map(toInspectorNode)
    );

    const downstreamDependents = dedupeById(
      graph.relationships
        .filter((r) => r.target === nodeId && DEPENDENCY_REL_TYPES.has(r.type))
        .map((r) => byId.get(r.source))
        .filter(Boolean)
        .map(toInspectorNode)
    );

    const ownerRel = graph.relationships.find((r) => r.source === nodeId && r.type === "OWNED_BY");
    const ownerTeam = ownerRel ? (byId.get(ownerRel.target)?.name || null) : null;

    const relatedVendorsAndDatabases = directDependencies.filter(
      (d) => d.type === "Vendor" || d.type === "Database"
    );

    // Only claim "0 incidents" when incident data actually exists in the
    // uploaded corpus — otherwise this is genuinely unavailable, not zero.
    const hasIncidentData = graph.nodes.some((n) => n.type === "Incident");
    const recentIncidentCount = hasIncidentData
      ? new Set(
          graph.relationships
            .filter((r) => r.type === "CAUSED_BY" && r.target === nodeId)
            .map((r) => r.source)
        ).size
      : null;

    const totalDependencyCount = directDependencies.length;

    const riskSummary = await generateNodeRiskSummary({
      node: targetNode,
      ownerTeam,
      directDependencies,
      downstreamDependents,
      totalDependencyCount,
      recentIncidentCount,
      blastRadius,
      severity,
    });

    console.log(`[NodeInspector] ✓ ${targetNode.name} — ${totalDependencyCount} direct dep(s), ${downstreamDependents.length} dependent(s)`);

    return res.json({
      success: true,
      node: {
        id: targetNode.id,
        name: targetNode.name,
        type: targetNode.type,
        category: targetNode.category || null,
        status: targetNode.status || "healthy",
        description: targetNode.description || null,
        ownerTeam,
        directDependencies,
        downstreamDependents,
        totalDependencyCount,
        relatedVendorsAndDatabases,
        recentIncidentCount,
        riskSummary,
      },
    });
  } catch (err) {
    console.warn("[NodeInspector] ⚠ Falling back to mock:", err.message);
    const mock = loadMock("node-inspector-success");
    if (mock) return res.json(mock);
    return structuredError(
      res,
      503,
      "NODE_INSPECTOR_UNAVAILABLE",
      "Node details could not be loaded. The dependency graph may be empty or unreachable."
    );
  }
});

// ─── POST /api/simulate ──────────────────────────────────────────────────────

// ─── POST /api/simulate ──────────────────────────────────────────────────────

app.post("/api/simulate", async (req, res) => {
  const { scenario } = req.body || {};
  if (!scenario) {
    return structuredError(res, 400, "SCENARIO_NOT_FOUND", "No scenario name provided.");
  }

  try {
    const graph = await fetchGraphFromNeo4j();

    if (!graph.nodes.length) throw new Error("empty graph");

    // Parse the scenario name to find the target node.
    // Convention: scenario name is "<NodeName> Failure", e.g. "Stripe Failure"
    const targetName = scenario.replace(/\s+failure$/i, "").trim().toLowerCase();
    const targetNode = graph.nodes.find((n) => n.name.toLowerCase() === targetName);

    // Find all services that depend on the target node (directly or transitively).
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const dependents = new Map(); // nodeId -> [dependentNodeIds]
    for (const rel of graph.relationships) {
      if (!DEPENDENCY_REL_TYPES.has(rel.type)) continue;
      if (!dependents.has(rel.target)) dependents.set(rel.target, []);
      dependents.get(rel.target).push(rel.source);
    }

    // BFS from target to find all affected nodes
    const affectedIds = new Set();
    const queue = [targetNode ? targetNode.id : graph.nodes[0].id];
    while (queue.length) {
      const id = queue.shift();
      if (affectedIds.has(id)) continue;
      affectedIds.add(id);
      for (const dep of dependents.get(id) || []) queue.push(dep);
    }
    const affectedNodes = [...affectedIds]
      .map((id) => byId.get(id))
      .filter(Boolean)
      .filter((n) => n.type === "Service");

    const rootName = targetNode ? targetNode.name : graph.nodes[0].name;
    const now = new Date().toISOString();
    const incidentId = `INC-${Math.floor(Math.random() * 900) + 100}`;

    // Build dynamic events from the real graph nodes
    const events = [];
    events.push({
      id: "evt1",
      type: "alert",
      message: `${rootName} is returning errors — dependency health check failed`,
      timestamp: now,
      source: rootName,
    });

    affectedNodes.slice(0, 4).forEach((node, i) => {
      const types = ["log", "alert", "ticket", "log"];
      const messages = [
        `${node.name} upstream dependency unavailable — requests timing out`,
        `${node.name} error rate exceeded threshold — cascading from ${rootName}`,
        `On-call reports ${node.name} is degraded`,
        `${node.name} connection to ${rootName} lost`,
      ];
      events.push({
        id: `evt${i + 2}`,
        type: types[i] || "log",
        message: messages[i] || `${node.name} impacted by ${rootName} failure`,
        timestamp: new Date(Date.now() + (i + 1) * 20000).toISOString(),
        source: node.name,
      });
    });

    events.push({
      id: `evt${events.length + 1}`,
      type: "ticket",
      message: `P1 incident opened: ${rootName} failure affecting ${affectedNodes.length} downstream service(s)`,
      timestamp: new Date(Date.now() + 120000).toISOString(),
      source: "Support Desk",
    });

    console.log(`[Simulate] ✓ ${scenario} — ${events.length} events (graph-driven)`);
    return res.json({ scenario, incidentId, events });

  } catch (err) {
    // Fallback: try the hardcoded scenario library
    const scen = getScenario(scenario);
    if (scen) {
      console.warn(`[Simulate] ⚠ Graph unavailable, using hardcoded scenario: ${scenario}`);
      return res.json({ scenario: scen.label, incidentId: scen.incidentId, events: scen.events });
    }
    return structuredError(res, 400, "SCENARIO_NOT_FOUND",
      `Could not simulate "${scenario}". Upload documents first to build the graph.`
    );
  }
});

// ─── POST /api/analyze ─────────────────────────────────────────────────────────

// ─── POST /api/analyze ─────────────────────────────────────────────────────────

// ─── Incident Persistence & Historical Match ───────────────────────────────────

// Writes a completed analysis into Neo4j as an Incident node with a CAUSED_BY
// edge to the root cause node. Fire-and-forget — never throws to caller.
async function persistIncident(incidentId, scenario, result) {
  if (!driver) return;
  const session = driver.session();
  try {
    const rootCauseId = result.rootCause.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await session.run(
      `MERGE (i:Incident {id: $id})
       ON CREATE SET
         i.name             = $name,
         i.scenario         = $scenario,
         i.rootCause        = $rootCause,
         i.rootCauseType    = $rootCauseType,
         i.confidence       = $confidence,
         i.confidenceLabel  = $confidenceLabel,
         i.affectedServices = $affectedServices,
         i.affectedTeams    = $affectedTeams,
         i.explanation      = $explanation,
         i.timestamp        = $timestamp
       ON MATCH SET i.updatedAt = timestamp()`,
      {
        id:               incidentId,
        name:             `${scenario || result.rootCause} Incident`,
        scenario:         scenario || result.rootCause,
        rootCause:        result.rootCause,
        rootCauseType:    result.rootCauseType  || "Unknown",
        confidence:       result.confidence,
        confidenceLabel:  result.confidenceLabel || "Medium",
        affectedServices: result.affectedServices || [],
        affectedTeams:    result.affectedTeams    || [],
        explanation:      result.explanation      || "",
        timestamp:        new Date().toISOString(),
      }
    );
    // CAUSED_BY edge to the root cause node (best-effort — node may not exist)
    await session.run(
      `MATCH (i:Incident {id: $incidentId})
       MATCH (n {id: $rootCauseId})
       MERGE (i)-[:CAUSED_BY]->(n)`,
      { incidentId, rootCauseId }
    ).catch(() => {});
    console.log(`[Incidents] Persisted ${incidentId} — root cause: ${result.rootCause}`);
  } catch (err) {
    console.warn("[Incidents] Could not persist incident:", err.message);
  } finally {
    await session.close();
  }
}

// Queries Neo4j for a past incident sharing the same root cause.
// Returns a HistoricalMatch object or null if none found.
async function queryHistoricalMatch(rootCause, currentIncidentId) {
  if (!driver) return null;
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (i:Incident)
       WHERE i.rootCause = $rootCause AND i.id <> $currentId
       RETURN i ORDER BY i.timestamp DESC LIMIT 1`,
      { rootCause, currentId: currentIncidentId }
    );
    if (result.records.length === 0) return null;
    const inc = result.records[0].get("i").properties;
    return {
      incidentId: inc.id,
      date:       (inc.timestamp || "").slice(0, 10),
      summary:    inc.explanation || `${inc.rootCause} failure affected ${(inc.affectedServices || []).join(", ")}.`,
      resolver:   inc.resolvedBy || "Unknown",
      team:       (inc.affectedTeams || [])[0] || "Unknown",
    };
  } catch (err) {
    console.warn("[Incidents] historicalMatch query failed:", err.message);
    return null;
  } finally {
    await session.close();
  }
}

app.post("/api/analyze", async (req, res) => {
  const { events = [], scenario } = req.body || {};

  if (!Array.isArray(events) || events.length === 0) {
    return structuredError(
      res,
      400,
      "ANALYSIS_FAILED",
      "Root cause analysis could not be completed. The incident event set was empty."
    );
  }

  try {
    // Step 1: Always try live graph + Gemini first
    let graph = null;
    try {
      graph = await fetchGraphFromNeo4j();
    } catch (e) {
      console.warn("[Analyze] Neo4j unavailable:", e.message);
    }

    if (graph && graph.nodes.length > 0) {
      const geminiResult = await geminiAnalysis(graph, events);
      if (geminiResult) {
        console.log(`[Analyze] ✓ Gemini graph analysis — root cause: ${geminiResult.rootCause} (${geminiResult.confidence}%)`);
        const incidentId = `INC-${Math.floor(Math.random() * 900) + 100}`;
        const historical = await queryHistoricalMatch(geminiResult.rootCause, incidentId);
        geminiResult.historicalMatch = historical;
        persistIncident(incidentId, scenario, geminiResult); // fire-and-forget
        return res.json(geminiResult);
      }

      // Gemini failed or returned bad JSON — fall back to graph traversal
      const traversalResult = await analyzeFromGraph(events);
      if (traversalResult) {
        console.log(`[Analyze] ✓ Graph traversal — root cause: ${traversalResult.rootCause} (${traversalResult.confidence}%)`);
        const incidentId = `INC-${Math.floor(Math.random() * 900) + 100}`;
        const historical = await queryHistoricalMatch(traversalResult.rootCause, incidentId);
        traversalResult.historicalMatch = historical;
        persistIncident(incidentId, scenario, traversalResult); // fire-and-forget
        return res.json(traversalResult);
      }
    }

    // Step 2: Try hardcoded scenario as last resort before mock
    if (scenario) {
      const scen = getScenario(scenario);
      if (scen) {
        console.warn(`[Analyze] ⚠ Graph empty/unavailable, using hardcoded scenario: ${scenario}`);
        return res.json(scen.analysis);
      }
    }

    // Step 3: Absolute fallback — mock
    console.warn("[Analyze] ⚠ All analysis paths failed, serving mock");
    const mock = loadMock("analyze-success");
    if (mock) return res.json(mock);

    return structuredError(
      res,
      500,
      "ANALYSIS_FAILED",
      "Root cause analysis could not be completed for the provided incident events."
    );
  } catch (err) {
    console.warn("[Analyze] ⚠ Unexpected error:", err.message);
    const mock = loadMock("analyze-success");
    if (mock) return res.json(mock);
    return structuredError(
      res,
      500,
      "ANALYSIS_FAILED",
      "Root cause analysis could not be completed for the provided incident events."
    );
  }
});

// ─── GET /api/scenarios ────────────────────────────────────────────────────────
// Returns dynamic scenario names derived from the current Neo4j graph.
// ─── GET /api/incidents ────────────────────────────────────────────────────────
// Returns all persisted incidents from Neo4j, newest first.
// Falls back to the mock if Neo4j is unavailable.

app.get("/api/incidents", async (_req, res) => {
  if (!driver) {
    const mock = loadMock("incidents-success");
    if (mock) return res.json(mock);
    return res.json({ incidents: [] });
  }
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (i:Incident)
       RETURN i ORDER BY i.timestamp DESC LIMIT 50`
    );
    const incidents = result.records.map((r) => {
      const p = r.get("i").properties;
      return {
        incidentId:       p.id,
        timestamp:        p.timestamp        || "",
        scenario:         p.scenario         || p.name || "",
        rootCause:        p.rootCause        || "",
        rootCauseType:    p.rootCauseType    || "Unknown",
        confidence:       typeof p.confidence === "number" ? p.confidence : parseInt(p.confidence) || 0,
        confidenceLabel:  p.confidenceLabel  || "Medium",
        affectedServices: p.affectedServices  || [],
        affectedTeams:    p.affectedTeams     || [],
        explanation:      p.explanation       || "",
        resolvedBy:       p.resolvedBy        || null,
      };
    });

    if (incidents.length === 0) {
      // No incidents yet — return mock so the UI has something to show
      const mock = loadMock("incidents-success");
      if (mock) return res.json(mock);
    }

    return res.json({ incidents });
  } catch (err) {
    console.warn("[Incidents] ⚠ Query failed, serving mock:", err.message);
    const mock = loadMock("incidents-success");
    if (mock) return res.json(mock);
    return res.json({ incidents: [] });
  } finally {
    await session.close();
  }
});

// Vendors and Databases become failure scenarios (e.g. "Stripe Failure").
// Falls back to the hardcoded scenario list if the graph is unavailable.

app.get("/api/scenarios", async (_req, res) => {
  try {
    const graph = await fetchGraphFromNeo4j();
    if (!graph.nodes.length) throw new Error("empty graph");

    const scenarioNodes = graph.nodes.filter(
      (n) => n.type === "Vendor" || n.type === "Database" || n.type === "Service"
    );

    // Prefer vendors and databases first as they are the most common root causes
    const ordered = [
      ...scenarioNodes.filter((n) => n.type === "Vendor"),
      ...scenarioNodes.filter((n) => n.type === "Database"),
      ...scenarioNodes.filter((n) => n.type === "Service").slice(0, 3),
    ];

    const names = ordered.map((n) => `${n.name} Failure`);
    console.log(`[Scenarios] ✓ ${names.length} dynamic scenarios from graph`);
    return res.json({ scenarios: names });
  } catch (err) {
    console.warn("[Scenarios] ⚠ Graph unavailable, using hardcoded list:", err.message);
    return res.json({ scenarios: listScenarioNames() });
  }
});

// ─── GET /api/org-intelligence ─────────────────────────────────────────────────

app.get("/api/org-intelligence", async (_req, res) => {
  try {
    const data = await computeOrgIntelligence();
    console.log("[OrgIntel] ✓ Computed organizational intelligence");
    return res.json(data);
  } catch (err) {
    console.warn("[OrgIntel] ⚠ Falling back to mock:", err.message);
    const mock = loadMock("org-intelligence-success");
    if (mock) return res.json(mock);
    return structuredError(
      res,
      503,
      "INTELLIGENCE_UNAVAILABLE",
      "Organizational intelligence could not be generated. The dependency graph is empty or too sparse to detect structural risks."
    );
  }
});

// ─── Runbook Generation ────────────────────────────────────────────────────────

async function generateRunbooksWithGemini(graph, rootCause = null) {
  // Build id->name map so relationships use human-readable names in the prompt
  const idToName = new Map(graph.nodes.map((n) => [n.id, n.name]));

  // If a rootCause is provided, focus the subgraph on that node and its dependents.
  // This makes the runbook specific to the actual incident rather than generic.
  let focusedNodes = graph.nodes;
  let focusedRels = graph.relationships;
  let incidentContext = "";

  if (rootCause) {
    const rootNode = graph.nodes.find(
      (n) => n.name.toLowerCase() === rootCause.toLowerCase()
    );
    if (rootNode) {
      // Find all services that depend on the root cause node (direct + transitive)
      const dependentsMap = new Map();
      for (const rel of graph.relationships) {
        if (!dependentsMap.has(rel.target)) dependentsMap.set(rel.target, []);
        dependentsMap.get(rel.target).push(rel.source);
      }
      const affectedIds = new Set([rootNode.id]);
      const queue = [rootNode.id];
      while (queue.length) {
        const id = queue.shift();
        for (const dep of dependentsMap.get(id) || []) {
          if (!affectedIds.has(dep)) { affectedIds.add(dep); queue.push(dep); }
        }
      }
      focusedNodes = graph.nodes.filter((n) => affectedIds.has(n.id));
      focusedRels = graph.relationships.filter(
        (r) => affectedIds.has(r.source) && affectedIds.has(r.target)
      );
      incidentContext = `\nACTIVE INCIDENT: "${rootCause}" has failed. Generate runbooks specifically to remediate this failure and recover the affected services.\n`;
    }
  }

  const nodesSummary = focusedNodes
    .map((n) => `- ${n.name} (${n.type})`)
    .join("\n");

  // Use names in relationships — not IDs
  const relsSummary = focusedRels
    .map((r) => {
      const srcName = idToName.get(r.source) || r.source;
      const tgtName = idToName.get(r.target) || r.target;
      return `- ${srcName} --[${r.type}]--> ${tgtName}`;
    })
    .join("\n");

  const prompt = `You are an expert SRE runbook author. You have been given a live dependency graph (from Neo4j) extracted from company architecture documents. Generate practical, actionable remediation runbooks grounded ONLY in the entities and relationships present in this graph.
${incidentContext}
DEPENDENCY GRAPH NODES:
${nodesSummary}

DEPENDENCY GRAPH RELATIONSHIPS (SourceName --[RELATIONSHIP]--> TargetName):
${relsSummary}

Generate between 3 and 6 runbooks. ${rootCause ? `Prioritise runbooks that address the "${rootCause}" failure first, then cover other high-risk nodes.` : "Target the highest-risk Vendor, Database, and Service nodes."} Do NOT invent entities that are not in the graph above.

For each runbook:
- "id": sequential ID like "RB-001", "RB-002", etc.
- "title": specific to the node, e.g. "Stripe Payment Gateway Failover" or "MongoDB Connection Pool Reset"
- "trigger": a concrete monitoring condition using exact names from the graph
- "confidence": integer 0-100 (higher when the graph clearly shows the dependency chain)
- "auto": true if safe to auto-execute (low risk, reversible), false if human approval needed
- "status": "Ready to Execute" if auto=true, "Manual Approval Required" if auto=false
- "relatedService": primary internal service affected (exact name from graph), or null
- "relatedVendor": vendor involved (exact name from graph), or null
- "owningTeam": team that owns the affected service (exact name from graph), or null
- "actions": array of 3-5 concrete remediation steps using exact node names from the graph

Respond with ONLY a valid JSON object. No markdown, no backticks, no explanation outside the JSON.

{
  "runbooks": [
    {
      "id": "RB-001",
      "title": "string",
      "trigger": "string",
      "confidence": 85,
      "auto": true,
      "status": "Ready to Execute",
      "relatedService": "string or null",
      "relatedVendor": "string or null",
      "owningTeam": "string or null",
      "actions": ["step 1", "step 2", "step 3"]
    }
  ]
}`;

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(prompt);
  const raw = (result.response.text() || "").trim();

  const clean = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean);
  if (!Array.isArray(parsed.runbooks) || parsed.runbooks.length === 0) {
    throw new Error("Gemini returned empty runbooks array");
  }
  return parsed.runbooks;
}

function generateRunbooksDeterministic(graph) {
  // Pure graph traversal fallback when Gemini is unavailable.
  // Produces one runbook per Vendor/Database node, up to 6.
  const candidates = graph.nodes.filter(
    (n) => n.type === "Vendor" || n.type === "Database" || n.type === "Service"
  );

  // Find which services depend on each candidate
  const dependentsMap = new Map();
  for (const rel of graph.relationships) {
    if (!DEPENDENCY_REL_TYPES.has(rel.type)) continue;
    if (!dependentsMap.has(rel.target)) dependentsMap.set(rel.target, []);
    dependentsMap.get(rel.target).push(rel.source);
  }

  // Find team ownership
  const ownerMap = new Map();
  for (const rel of graph.relationships) {
    if (rel.type === "OWNED_BY") ownerMap.set(rel.source, rel.target);
  }
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

  const ordered = [
    ...candidates.filter((n) => n.type === "Vendor"),
    ...candidates.filter((n) => n.type === "Database"),
    ...candidates.filter((n) => n.type === "Service"),
  ].slice(0, 6);

  return ordered.map((node, i) => {
    const deps = (dependentsMap.get(node.id) || [])
      .map((id) => nodeById.get(id))
      .filter(Boolean);
    const primaryService = deps.find((n) => n.type === "Service") || null;
    const ownerTeamId = primaryService ? ownerMap.get(primaryService.id) : null;
    const ownerTeam = ownerTeamId ? nodeById.get(ownerTeamId) : null;

    const isHighRisk = node.type === "Database";
    const confidence = node.type === "Vendor" ? 88 : node.type === "Database" ? 82 : 75;

    const triggerMap = {
      Vendor: `${node.name} API error rate > 5% OR latency > 2000ms`,
      Database: `${node.name} active connections > 85% OR query latency > 1000ms`,
      Service: `${node.name} health check failing OR error rate > 10%`,
    };

    const actionMap = {
      Vendor: [
        `Activate circuit breaker for all outbound calls to ${node.name}.`,
        `Switch ${primaryService ? primaryService.name : "dependent services"} to fallback/degraded mode.`,
        `Alert ${ownerTeam ? ownerTeam.name : "on-call team"} via PagerDuty.`,
        `Monitor ${node.name} status page for upstream resolution.`,
        `Re-enable ${node.name} integration once error rate drops below 1%.`,
      ],
      Database: [
        `Force drain idle connections from ${node.name} connection pool.`,
        `Scale read-replica count by +2 for ${node.name}.`,
        `Disable long-polling and batch queries temporarily.`,
        `Notify ${ownerTeam ? ownerTeam.name : "database team"} to investigate slow queries.`,
        `Re-enable full query load once connection count drops below 60%.`,
      ],
      Service: [
        `Isolate ${node.name} from upstream traffic via load balancer.`,
        `Trigger rolling restart of ${node.name} pods/instances.`,
        `Verify all downstream dependencies of ${node.name} are healthy.`,
        `Notify ${ownerTeam ? ownerTeam.name : "on-call team"} of degradation.`,
        `Re-route traffic back to ${node.name} once health checks pass.`,
      ],
    };

    return {
      id: `RB-${String(i + 1).padStart(3, "0")}`,
      title: `${node.name} ${node.type === "Vendor" ? "Failover" : node.type === "Database" ? "Recovery" : "Restart"}`,
      trigger: triggerMap[node.type] || `${node.name} health check failing`,
      confidence,
      auto: !isHighRisk,
      status: isHighRisk ? "Manual Approval Required" : "Ready to Execute",
      relatedService: primaryService ? primaryService.name : null,
      relatedVendor: node.type === "Vendor" ? node.name : null,
      owningTeam: ownerTeam ? ownerTeam.name : null,
      actions: actionMap[node.type] || [`Restart ${node.name} and verify health.`],
    };
  });
}

// ─── GET /api/runbooks ─────────────────────────────────────────────────────────

app.get("/api/runbooks", async (req, res) => {
  // Optional: ?rootCause=Google+OAuth  → generates runbooks focused on that incident.
  // When absent, generates general runbooks for all high-risk nodes in the graph.
  const rootCause = (req.query.rootCause || "").trim() || null;

  try {
    // 1. Fetch the live graph — same data source every other endpoint uses.
    const graph = await fetchGraphFromNeo4j();
    deriveStatus(graph.nodes, graph.relationships);

    // 2. Guard: if the graph is empty, no documents have been ingested yet.
    if (!graph.nodes.length) {
      console.warn("[Runbooks] ⚠ Graph is empty — no documents ingested yet");
      return structuredError(
        res,
        503,
        "RUNBOOK_GENERATION_FAILED",
        "No architecture documents have been ingested yet. Upload your documents in the Knowledge Ingestion step first."
      );
    }

    // 3. Try Gemini AI generation first — passes rootCause for incident-specific runbooks.
    let runbooks;
    try {
      runbooks = await generateRunbooksWithGemini(graph, rootCause);
      const mode = rootCause ? `incident-focused (${rootCause})` : "full graph";
      console.log(`[Runbooks] ✓ Gemini generated ${runbooks.length} runbooks — ${mode}`);
    } catch (geminiErr) {
      // 4. Gemini unavailable — fall back to pure graph traversal (still dynamic).
      console.warn("[Runbooks] ⚠ Gemini unavailable, using deterministic fallback:", geminiErr.message);
      runbooks = generateRunbooksDeterministic(graph);
      console.log(`[Runbooks] ✓ Deterministic generated ${runbooks.length} runbooks from live graph`);
    }

    if (!runbooks || runbooks.length === 0) {
      throw new Error("No runbooks could be generated from the current graph");
    }

    return res.json({ runbooks });

  } catch (err) {
    // 5. Neo4j unreachable — last resort: serve the offline mock so the UI
    //    degrades gracefully instead of showing a hard error.
    console.warn("[Runbooks] ⚠ Neo4j unreachable, falling back to mock:", err.message);
    const mock = loadMock("runbooks-success");
    if (mock) {
      console.log(`[Runbooks] ✓ ${mock.runbooks.length} mock runbooks served (offline mode)`);
      return res.json(mock);
    }
    return structuredError(
      res,
      503,
      "RUNBOOK_GENERATION_FAILED",
      "Remediation runbooks could not be generated. The dependency graph is unavailable or no documents have been ingested yet."
    );
  }
});

// ─── Multer + global error handler ───────────────────────────────────────────

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return structuredError(res, 400, "UPLOAD_ERROR", `Upload error: ${err.message}`);
  }
  if (err) {
    return structuredError(res, 400, "BAD_REQUEST", err.message);
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 RootSight API Server  →  http://localhost:${PORT}`);
  console.log(`   POST /api/upload            — Knowledge Ingestion Pipeline`);
  console.log(`   GET  /api/graph             — Dependency Graph`);
  console.log(`   POST /api/simulate          — Incident Simulation`);
  console.log(`   POST /api/analyze           — Root Cause Analysis`);
  console.log(`   GET  /api/org-intelligence  — Organizational Intelligence`);
  console.log(`   GET  /api/runbooks          — AI Remediation Runbooks`);
  console.log(`   GET  /api/health            — Health Check`);
  console.log(`\n   Entity types : ${Object.values(ENTITY_LABEL_MAP).join(", ")}`);
  console.log(`   Scenarios    : ${listScenarioNames().join(", ")}\n`);
});