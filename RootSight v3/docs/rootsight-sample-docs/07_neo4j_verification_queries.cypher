# RootSight — Neo4j Verification Reference
# Expected entities and relationships after ingesting all 6 sample documents
# Use these Cypher queries to verify Gemini extraction is working correctly

# ─── VERIFICATION QUERIES ────────────────────────────────────────────────────

# 1. Count all nodes by label
MATCH (n) RETURN labels(n)[0] AS label, COUNT(n) AS count ORDER BY count DESC;

# Expected minimums after ingesting all 6 documents:
# Service      23
# Database     26
# Vendor       12
# Team          7
# Engineer     10
# Incident      6
# Runbook       7

# 2. List all Services
MATCH (s:Service) RETURN s.id, s.name ORDER BY s.name;

# 3. List all Teams
MATCH (t:Team) RETURN t.id, t.name;

# 4. Count relationships by type
MATCH ()-[r]->() RETURN type(r) AS rel_type, COUNT(r) AS count ORDER BY count DESC;

# ─── EXPECTED ENTITIES ───────────────────────────────────────────────────────

# SERVICES (23 expected)
# id                       name
# auth-service             Auth Service
# user-service             User Service
# session-service          Session Service
# kyc-service              KYC Service
# api-gateway              API Gateway
# payment-service          Payment Service
# ledger-service           Ledger Service
# reconciliation-service   Reconciliation Service
# payout-service           Payout Service
# fx-service               FX Service
# fraud-detection-service  Fraud Detection Service
# loan-service             Loan Service
# underwriting-service     Underwriting Service
# disbursement-service     Disbursement Service
# notification-service     Notification Service
# webhook-service          Webhook Service
# reporting-service        Reporting Service
# analytics-service        Analytics Service
# ml-pipeline-service      ML Pipeline Service
# rate-limiter-service     Rate Limiter Service
# config-service           Config Service
# audit-service            Audit Service
# search-service           Search Service

# VENDORS (12 expected)
# id                    name
# stripe                Stripe
# razorpay              Razorpay
# twilio                Twilio
# google-oauth          Google OAuth
# sendgrid              SendGrid
# firebase-push         Firebase (FCM)
# sagemaker-fraud       AWS SageMaker
# open-exchange-rates   Open Exchange Rates
# hyperverge-kyc        HyperVerge
# cibil-bureau          CIBIL
# experian-bureau       Experian
# aws-rds               AWS RDS

# TEAMS (7 expected)
# id                team name
# team-identity     Team Identity
# team-payments     Team Payments
# team-lending      Team Lending
# team-risk         Team Risk
# team-compliance   Team Compliance
# team-platform     Team Platform
# team-data         Team Data

# DATABASES (26 expected)
# id                        name
# postgresql-auth           Auth PostgreSQL
# postgresql-users          Users PostgreSQL
# postgresql-payments       Payments PostgreSQL
# postgresql-ledger         Ledger PostgreSQL
# postgresql-lending        Lending PostgreSQL
# postgresql-risk           Risk PostgreSQL
# postgresql-compliance     Compliance PostgreSQL
# postgresql-notifications  Notifications PostgreSQL
# postgresql-config         Config PostgreSQL
# postgresql-audit          Audit PostgreSQL
# redis-session             Session Redis
# redis-ratelimit           Rate Limit Redis
# redis-fraud               Fraud Redis
# redis-webhook             Webhook Redis
# redis-analytics           Analytics Redis
# redis-fx                  FX Redis
# redis-config              Config Redis
# kafka-payments            Payments Kafka
# kafka-notifications       Notifications Kafka
# kafka-lending             Lending Kafka
# kafka-audit               Audit Kafka
# redshift-warehouse        Data Warehouse (Redshift)
# elasticsearch             Search Index (Elasticsearch)
# s3-documents              Documents S3
# s3-reports                Reports S3
# s3-models                 ML Models S3

# ENGINEERS (10 expected)
# id               name
# priya-sharma     Priya Sharma
# arjun-mehta      Arjun Mehta
# rohan-verma      Rohan Verma
# kavya-reddy      Kavya Reddy
# siddharth-nair   Siddharth Nair
# neha-kapoor      Neha Kapoor
# aditya-kumar     Aditya Kumar
# meera-iyer       Meera Iyer
# vikram-rao       Vikram Rao
# ananya-singh     Ananya Singh
# rahul-gupta      Rahul Gupta

# INCIDENTS (6 expected)
# id            name
# inc-2024-047  INC-2024-047: Razorpay Webhook Timeout Cascade
# inc-2024-051  INC-2024-051: Redis Session Cluster Split-Brain
# inc-2024-063  INC-2024-063: Fraud Model Stale Features Causing False Positives
# inc-2024-071  INC-2024-071: Kafka Consumer Group Lag Cascade
# inc-2024-089  INC-2024-089: Google OAuth Outage
# inc-2024-104  INC-2024-104: Stripe API Version Deprecation Breaking Reconciliation
# inc-2024-118  INC-2024-118: Notification Service Memory Leak

# RUNBOOKS (7 expected)
# id      name
# rb-001  Auth Service Degradation Runbook
# rb-002  Payment Processing Degradation Runbook
# rb-003  Kafka Consumer Lag Recovery Runbook
# rb-004  Database Connection Pool Exhaustion
# rb-005  Notification Service Degradation
# rb-006  FX Rate Data Staleness
# rb-007  Fraud Model Staleness / False Positive Surge

# ─── EXPECTED RELATIONSHIPS ──────────────────────────────────────────────────

# DEPENDS_ON (Service → Service or Database)
MATCH (a)-[:DEPENDS_ON]->(b) RETURN a.name, b.name ORDER BY a.name;
# Key expected pairs:
# auth-service         → postgresql-auth
# auth-service         → redis-session
# payment-service      → fraud-detection-service
# payment-service      → ledger-service
# payment-service      → postgresql-payments
# payment-service      → kafka-payments
# loan-service         → underwriting-service
# loan-service         → disbursement-service
# api-gateway          → auth-service
# api-gateway          → rate-limiter-service
# notification-service → kafka-notifications
# ledger-service       → postgresql-ledger
# ledger-service       → kafka-payments
# fx-service           → redis-fx
# fraud-detection-service → redis-fraud
# fraud-detection-service → postgresql-risk
# session-service      → redis-session
# payout-service       → ledger-service
# disbursement-service → payout-service
# webhook-service      → redis-webhook

# OWNED_BY (Service or Database → Team)
MATCH (a)-[:OWNED_BY]->(t:Team) RETURN a.name, t.name ORDER BY t.name;
# Key expected pairs:
# auth-service         → Team Identity
# user-service         → Team Identity
# session-service      → Team Identity
# payment-service      → Team Payments
# ledger-service       → Team Payments
# payout-service       → Team Payments
# loan-service         → Team Lending
# fraud-detection-service → Team Risk
# underwriting-service → Team Risk
# kyc-service          → Team Compliance
# audit-service        → Team Compliance
# api-gateway          → Team Platform
# notification-service → Team Platform
# reporting-service    → Team Data

# USES_VENDOR (Service → Vendor)
MATCH (s:Service)-[:USES_VENDOR]->(v:Vendor) RETURN s.name, v.name ORDER BY s.name;
# Expected pairs:
# auth-service             → Google OAuth
# auth-service             → Twilio
# payment-service          → Stripe
# payment-service          → Razorpay
# payout-service           → Razorpay
# reconciliation-service   → Stripe
# reconciliation-service   → Razorpay
# reconciliation-service   → SendGrid
# notification-service     → Twilio
# notification-service     → SendGrid
# notification-service     → Firebase (FCM)
# reporting-service        → SendGrid
# fx-service               → Open Exchange Rates
# kyc-service              → HyperVerge
# fraud-detection-service  → AWS SageMaker
# underwriting-service     → AWS SageMaker
# underwriting-service     → CIBIL
# underwriting-service     → Experian

# CAUSED_BY (Incident → Service or Vendor)
MATCH (i:Incident)-[:CAUSED_BY]->(c) RETURN i.name, c.name;
# Expected:
# INC-2024-047 → Razorpay (vendor outage)
# INC-2024-047 → payment-service (missing circuit breaker)
# INC-2024-051 → redis-session (ElastiCache failover)
# INC-2024-063 → ml-pipeline-service (DAG missed runs)
# INC-2024-071 → ledger-service (bad deployment)
# INC-2024-089 → Google OAuth (vendor outage)
# INC-2024-104 → reconciliation-service (stale API version)
# INC-2024-118 → notification-service (memory leak)

# RESOLVED_BY (Incident → Engineer)
MATCH (i:Incident)-[:RESOLVED_BY]->(e:Engineer) RETURN i.name, e.name;
# Expected:
# INC-2024-047 → Siddharth Nair
# INC-2024-047 → Neha Kapoor
# INC-2024-051 → Priya Sharma
# INC-2024-063 → Meera Iyer
# INC-2024-063 → Rahul Gupta
# INC-2024-071 → Neha Kapoor
# INC-2024-071 → Kavya Reddy
# INC-2024-089 → Priya Sharma
# INC-2024-089 → Arjun Mehta
# INC-2024-104 → Neha Kapoor
# INC-2024-118 → Ananya Singh

# HAS_RUNBOOK (Service or Incident → Runbook)
MATCH (n)-[:HAS_RUNBOOK]->(r:Runbook) RETURN n.name, r.name;
# Expected:
# auth-service    → Auth Service Degradation Runbook
# payment-service → Payment Processing Degradation Runbook
# INC-2024-047    → Payment Processing Degradation Runbook
# INC-2024-051    → Auth Service Degradation Runbook
# INC-2024-071    → Kafka Consumer Lag Recovery Runbook

# ─── SMOKE TEST QUERIES ──────────────────────────────────────────────────────

# Verify the full payment processing chain exists in the graph
MATCH path = (gw:Service {id:'api-gateway'})-[:DEPENDS_ON*1..3]->(db:Database)
RETURN [n IN nodes(path) | n.name] AS chain;

# Find all services that would be impacted if razorpay goes down
MATCH (v:Vendor {id:'razorpay'})<-[:USES_VENDOR]-(s:Service)
RETURN s.name AS affected_service;

# Find all incidents involving Team Payments services
MATCH (i:Incident)-[:CAUSED_BY]->(s:Service)-[:OWNED_BY]->(t:Team {id:'team-payments'})
RETURN i.name, s.name;

# Find engineers on-call for services in the payment processing path
MATCH (s:Service)-[:OWNED_BY]->(t:Team)<-[:OWNED_BY]-(other:Service)
WHERE s.id IN ['payment-service','ledger-service','api-gateway','fraud-detection-service']
RETURN DISTINCT t.name AS team;
