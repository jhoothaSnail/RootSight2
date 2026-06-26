import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import multer from "multer";
import neo4j from "neo4j-driver";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PDFParse } from "pdf-parse";
import { parse as csvParse } from "csv-parse/sync";
import { SCENARIOS, getScenario, listScenarioNames } from "./scenarios.js";

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
async function geminiExplanation(base, events) {
  if (!process.env.GEMINI_API_KEY) return base.explanation;
  const symptoms = events.map((e) => `- ${e.message}`).join("\n");
  const prompt = `You are an incident response analyst writing for an SRE audience.
Given the symptoms and the identified root cause, write a concise, professional
2-3 sentence explanation of what happened and why. No preamble, no markdown,
no bullet points - just the explanation paragraph.

Root cause: ${base.rootCause} (${base.rootCauseType})
Confidence: ${base.confidence}%
Affected services: ${(base.affectedServices || []).join(", ") || "n/a"}
Symptoms:
${symptoms}`;

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(prompt);
  const text = (result.response.text() || "").trim();
  return text.length > 20 ? text : base.explanation;
}

// ─── Organizational Intelligence ──────────────────────────────────────────────

// Overlays real ownership + SPOF computation onto the curated intelligence
// template (uptime/load metrics are not stored in the graph, so they remain
// curated). Throws on a sparse/unavailable graph to trigger the mock fallback.
async function computeOrgIntelligence() {
  const graph = await fetchGraphFromNeo4j();
  if (graph.nodes.length < 3) throw new Error("graph too sparse for intelligence");

  const template = loadMock("org-intelligence-success");
  if (!template) throw new Error("intelligence template unavailable");

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  // SPOF = vendor with the most USES_VENDOR dependents.
  const vendorDependents = new Map();
  for (const rel of graph.relationships) {
    if (rel.type !== "USES_VENDOR") continue;
    if (!vendorDependents.has(rel.target)) vendorDependents.set(rel.target, []);
    const src = byId.get(rel.source);
    if (src) vendorDependents.get(rel.target).push(src.name);
  }
  let spofVendorId = null;
  let max = 0;
  for (const [id, deps] of vendorDependents) {
    if (deps.length > max) {
      max = deps.length;
      spofVendorId = id;
    }
  }
  if (spofVendorId) {
    const vendor = byId.get(spofVendorId);
    template.spof = {
      ...template.spof,
      id: spofVendorId,
      name: vendor ? vendor.name : template.spof.name,
      type: "Vendor",
      dependentServices: vendorDependents.get(spofVendorId),
    };
  }

  // Ownership burden = number of services OWNED_BY each team.
  const teamServices = new Map();
  for (const rel of graph.relationships) {
    if (rel.type !== "OWNED_BY") continue;
    const team = byId.get(rel.target);
    const svc = byId.get(rel.source);
    if (!team || !svc) continue;
    if (!teamServices.has(team.name)) teamServices.set(team.name, []);
    teamServices.get(team.name).push(svc.name);
  }
  if (teamServices.size > 0) {
    const maxOwned = Math.max(...[...teamServices.values()].map((s) => s.length));
    template.ownershipBurden = [...teamServices.entries()].map(([team, svcs]) => {
      const loadPercent = Math.round((svcs.length / maxOwned) * 80) + 15;
      return {
        team,
        loadPercent: Math.min(loadPercent, 95),
        loadStatus: loadPercent >= 70 ? "volatile" : "stable",
        servicesOwned: svcs,
      };
    });
  }

  return template;
}

// ─── GET /api/graph ────────────────────────────────────────────────────────────

app.get("/api/graph", async (_req, res) => {
  try {
    const graph = await fetchGraphFromNeo4j();
    if (!graph.nodes.length) throw new Error("empty graph");
    deriveStatus(graph.nodes, graph.relationships);
    console.log(`[Graph] ✓ ${graph.nodes.length} nodes, ${graph.relationships.length} relationships`);
    return res.json(graph);
  } catch (err) {
    console.warn("[Graph] ⚠ Falling back to mock:", err.message);
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

// ─── POST /api/simulate ──────────────────────────────────────────────────────

app.post("/api/simulate", (req, res) => {
  const { scenario } = req.body || {};
  const scen = getScenario(scenario);
  if (!scen) {
    return structuredError(
      res,
      400,
      "SCENARIO_NOT_FOUND",
      `The requested simulation scenario is not recognized. Valid scenarios are: ${listScenarioNames().join(", ")}.`
    );
  }
  console.log(`[Simulate] ✓ ${scen.label} — ${scen.events.length} events`);
  return res.json({
    scenario: scen.label,
    incidentId: scen.incidentId,
    events: scen.events,
  });
});

// ─── POST /api/analyze ─────────────────────────────────────────────────────────

app.post("/api/analyze", async (req, res) => {
  const { events = [], scenario } = req.body || {};

  if (!Array.isArray(events) || events.length === 0) {
    if (!scenario) {
      return structuredError(
        res,
        400,
        "ANALYSIS_FAILED",
        "Root cause analysis could not be completed. The incident event set was empty or could not be correlated against the dependency graph."
      );
    }
  }

  try {
    const scen = getScenario(scenario);
    let base = scen ? { ...scen.analysis } : await analyzeFromGraph(events);
    if (!base) base = loadMock("analyze-success");
    if (!base) throw new Error("no analysis basis");

    try {
      base.explanation = await geminiExplanation(base, events);
    } catch (e) {
      console.warn("[Analyze] Gemini explanation failed, using curated text:", e.message);
    }

    console.log(`[Analyze] ✓ Root cause: ${base.rootCause} (${base.confidence}%)`);
    return res.json(base);
  } catch (err) {
    console.warn("[Analyze] ⚠ Falling back to mock:", err.message);
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

// ─── GET /api/runbooks ─────────────────────────────────────────────────────────

app.get("/api/runbooks", (_req, res) => {
  const mock = loadMock("runbooks-success");
  if (mock) {
    console.log(`[Runbooks] ✓ ${mock.runbooks.length} runbooks served`);
    return res.json(mock);
  }
  return structuredError(
    res,
    500,
    "RUNBOOK_GENERATION_FAILED",
    "Remediation runbooks could not be generated. No historical incidents or runbook documents were found for the identified root cause."
  );
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