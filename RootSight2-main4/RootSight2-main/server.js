import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import multer from "multer";
import neo4j from "neo4j-driver";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PDFParse } from "pdf-parse";
import { parse as csvParse } from "csv-parse/sync";

dotenv.config();

// ─── Constants ────────────────────────────────────────────────────────────────

const PORT = 3001;

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

app.post("/api/upload", upload.single("file"), async (req, res) => {
  const startTime = Date.now();

  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: "No file uploaded. Please attach a file with field name 'file'.",
    });
  }

  console.log(
    `\n[Upload] ▶ ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`
  );

  try {
    // Step 1 — Extract text from file
    console.log("[Upload] Step 1: Extracting text...");
    const text = await extractText(req.file);

    if (!text || text.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: "File is empty or contains insufficient text to analyze.",
      });
    }
    console.log(`[Upload] Step 1 ✓ — ${text.length} characters extracted`);

    // Step 2 — Send to Gemini (with 1 automatic retry on malformed output)
    console.log("[Upload] Step 2: Sending to Gemini 2.5 Flash...");
    const rawExtracted = await callGemini(text);
    console.log("[Upload] Step 2 ✓ — Gemini responded");

    // Step 3 — Validate JSON schema
    console.log("[Upload] Step 3: Validating schema...");
    const validationErrors = validateSchema(rawExtracted);
    if (validationErrors.length > 0) {
      console.error("[Upload] Step 3 ✗ — Validation failed:", validationErrors);
      return res.status(422).json({
        success: false,
        error: "Gemini returned an invalid schema.",
        details: validationErrors,
      });
    }
    console.log("[Upload] Step 3 ✓ — Schema valid");

    // Step 4 — Sanitize: remove null/empty/blank entities and dangling relationships
    console.log("[Upload] Step 4: Sanitizing entities...");
    const extracted = sanitizeEntities(rawExtracted);

    // Log what was found per type
    for (const [key, label] of Object.entries(ENTITY_LABEL_MAP)) {
      const count = extracted[key].length;
      if (count > 0) {
        console.log(`[Upload]   ${label}: ${count} found — ${extracted[key].map(e => e.name).join(", ")}`);
      }
    }
    console.log(`[Upload]   Relationships: ${extracted.relationships.length} found`);
    console.log("[Upload] Step 4 ✓ — Sanitization complete");

    // Step 5 — Store in AuraDB
    console.log("[Upload] Step 5: Storing in AuraDB...");
    await storeInAuraDB(extracted);
    console.log("[Upload] Step 5 ✓ — AuraDB updated");

    // Step 6 — Return summary
    // Counts reflect what was actually sanitized and stored, not raw Gemini output
    const summary = {
      success:         true,
      filename:        req.file.originalname,
      processingTimeMs: Date.now() - startTime,
      services:        extracted.services.length,
      vendors:         extracted.vendors.length,
      teams:           extracted.teams.length,
      databases:       extracted.databases.length,
      engineers:       extracted.engineers.length,
      incidents:       extracted.incidents.length,
      runbooks:        extracted.runbooks.length,
      relationships:   extracted.relationships.length,
    };

    console.log("[Upload] ✅ Complete:", summary);
    return res.json(summary);

  } catch (err) {
    console.error("[Upload] ❌ Fatal error:", err.message);
    return res.status(500).json({
      success: false,
      error: err.message || "Internal server error during processing.",
    });
  }
});

// ─── Multer + global error handler ───────────────────────────────────────────

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 RootSight API Server  →  http://localhost:${PORT}`);
  console.log(`   POST /api/upload   — Knowledge Ingestion Pipeline`);
  console.log(`   GET  /api/health   — Health Check`);
  console.log(`\n   Entity types : ${Object.values(ENTITY_LABEL_MAP).join(", ")}`);
  console.log(`   Relationships: ${[...VALID_RELATIONSHIP_TYPES].join(", ")}\n`);
});