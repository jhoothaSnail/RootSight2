# Meridian Financial Services — System Architecture Documentation
**Version:** 3.4  
**Last Updated:** 2024-11-15  
**Author:** Platform Engineering Team  
**Classification:** Internal — Engineering Only

---

## 1. Company Overview

Meridian Financial Services is a mid-size B2B payments and lending platform serving 4,200+ enterprise clients across India, Southeast Asia, and the Middle East. The platform processes approximately 2.3 million transactions per day at peak load, totaling $480M in daily transaction volume.

---

## 2. System Architecture Overview

Meridian operates a microservices architecture deployed on AWS, organized into six functional domains:

- **Identity & Access** — authentication, authorization, session management
- **Payments Core** — payment initiation, processing, reconciliation
- **Lending** — loan origination, underwriting, disbursement
- **Notifications** — email, SMS, push, webhook delivery
- **Data & Analytics** — reporting, fraud detection, ML pipeline
- **Infrastructure** — API gateway, service mesh, observability

All services communicate over gRPC internally and expose REST APIs to external consumers. The service mesh uses Istio for mTLS and traffic management.

---

## 3. Services

### 3.1 Identity & Access Domain

#### auth-service
- **Owner:** Team Identity
- **Lead Engineer:** Priya Sharma
- **Language:** Go 1.21
- **Description:** Central authentication hub. Issues JWT tokens on successful login. Validates tokens for all downstream services via token introspection endpoint.
- **Dependencies:** postgresql-auth, redis-session, google-oauth, twilio-sms
- **Exposes:** `/v1/auth/*` (REST), `auth.AuthService` (gRPC)
- **SLO:** 99.95% availability, p99 < 120ms
- **Runbook:** [RB-001] Auth Service Degradation Runbook

#### user-service
- **Owner:** Team Identity
- **Lead Engineer:** Arjun Mehta
- **Language:** Node.js 20
- **Description:** Manages user profiles, KYC status, roles, and preferences. Source of truth for user identity data.
- **Dependencies:** auth-service, postgresql-users, s3-documents
- **Exposes:** `/v1/users/*` (REST)
- **SLO:** 99.9% availability, p99 < 200ms

#### session-service
- **Owner:** Team Identity
- **Lead Engineer:** Priya Sharma
- **Language:** Go 1.21
- **Description:** Manages user session lifecycle. Handles token refresh, revocation, and concurrent session limits.
- **Dependencies:** auth-service, redis-session
- **Exposes:** `/v1/sessions/*` (REST)
- **SLO:** 99.95% availability, p99 < 50ms

#### kyc-service
- **Owner:** Team Compliance
- **Lead Engineer:** Rohan Verma
- **Language:** Python 3.11
- **Description:** Orchestrates KYC (Know Your Customer) verification workflows. Integrates with external identity verification providers. Handles document upload, facial recognition checks, and AML screening.
- **Dependencies:** user-service, s3-documents, hyperverge-kyc, postgresql-compliance
- **Exposes:** `/v1/kyc/*` (REST)
- **SLO:** 99.5% availability, p99 < 2000ms

---

### 3.2 Payments Core Domain

#### api-gateway
- **Owner:** Team Platform
- **Lead Engineer:** Kavya Reddy
- **Language:** Go 1.21
- **Description:** Public-facing API gateway. Handles rate limiting, request authentication, SSL termination, and routing to internal services. Entry point for all external API consumers.
- **Dependencies:** auth-service, rate-limiter-service, redis-ratelimit
- **Exposes:** `api.meridianpay.io` (HTTPS)
- **SLO:** 99.99% availability, p99 < 30ms

#### payment-service
- **Owner:** Team Payments
- **Lead Engineer:** Siddharth Nair
- **Language:** Java 21
- **Description:** Core payment orchestration. Routes payments to appropriate PSP based on currency, region, and merchant configuration. Handles payment state machine transitions (initiated → processing → settled/failed).
- **Dependencies:** api-gateway, auth-service, razorpay, stripe, postgresql-payments, kafka-payments, ledger-service
- **Exposes:** `/v1/payments/*` (REST), `payment.PaymentService` (gRPC)
- **SLO:** 99.95% availability, p99 < 300ms
- **Runbook:** [RB-002] Payment Processing Degradation Runbook

#### ledger-service
- **Owner:** Team Payments
- **Lead Engineer:** Neha Kapoor
- **Language:** Java 21
- **Description:** Double-entry bookkeeping system. Records all debit and credit entries. Immutable audit log. Reconciliation engine runs nightly.
- **Dependencies:** postgresql-ledger, kafka-payments
- **Exposes:** `ledger.LedgerService` (gRPC — internal only)
- **SLO:** 99.99% availability, p99 < 100ms

#### reconciliation-service
- **Owner:** Team Payments
- **Lead Engineer:** Neha Kapoor
- **Language:** Python 3.11
- **Description:** Nightly batch job that reconciles internal ledger records against PSP settlement reports. Flags discrepancies for manual review. Sends reconciliation summary to finance team via email.
- **Dependencies:** ledger-service, stripe, razorpay, postgresql-ledger, sendgrid
- **Exposes:** Internal only (batch job)
- **SLO:** Completes within 4 hours of batch trigger

#### payout-service
- **Owner:** Team Payments
- **Lead Engineer:** Siddharth Nair
- **Language:** Java 21
- **Description:** Handles merchant settlement payouts. Batches transactions, validates bank account details, initiates bank transfers via NEFT/RTGS/SWIFT.
- **Dependencies:** ledger-service, razorpay, postgresql-payments, kafka-payments
- **Exposes:** `/v1/payouts/*` (REST)
- **SLO:** 99.9% availability

#### fx-service
- **Owner:** Team Payments
- **Lead Engineer:** Aditya Kumar
- **Language:** Python 3.11
- **Description:** Foreign exchange rate management. Fetches live FX rates from Open Exchange Rates. Calculates conversion amounts for cross-currency payments.
- **Dependencies:** open-exchange-rates, redis-fx, postgresql-payments
- **Exposes:** `/v1/fx/*` (REST), `fx.FXService` (gRPC)
- **SLO:** 99.9% availability, rate data freshness < 60 seconds

#### fraud-detection-service
- **Owner:** Team Risk
- **Lead Engineer:** Meera Iyer
- **Language:** Python 3.11
- **Description:** Real-time fraud scoring. Evaluates every payment transaction using ML models hosted on SageMaker. Returns risk score (0–100) and recommended action (approve/review/decline).
- **Dependencies:** payment-service, sagemaker-fraud, redis-fraud, postgresql-risk
- **Exposes:** `fraud.FraudService` (gRPC — internal only)
- **SLO:** 99.9% availability, p99 < 80ms (inline payment path)

---

### 3.3 Lending Domain

#### loan-service
- **Owner:** Team Lending
- **Lead Engineer:** Vikram Rao
- **Language:** Java 21
- **Description:** Loan origination and lifecycle management. Handles loan applications, approval workflows, disbursement scheduling, and repayment tracking.
- **Dependencies:** auth-service, user-service, underwriting-service, disbursement-service, postgresql-lending, kafka-lending
- **Exposes:** `/v1/loans/*` (REST)
- **SLO:** 99.9% availability, p99 < 500ms

#### underwriting-service
- **Owner:** Team Risk
- **Lead Engineer:** Meera Iyer
- **Language:** Python 3.11
- **Description:** Credit underwriting engine. Pulls bureau data from CIBIL and Experian. Runs proprietary credit scoring models. Returns creditworthiness decision with limit recommendation.
- **Dependencies:** loan-service, cibil-bureau, experian-bureau, sagemaker-credit, postgresql-risk
- **Exposes:** `underwriting.UnderwritingService` (gRPC)
- **SLO:** 99.5% availability, p99 < 3000ms

#### disbursement-service
- **Owner:** Team Lending
- **Lead Engineer:** Vikram Rao
- **Language:** Java 21
- **Description:** Initiates loan disbursements after approval. Coordinates with payout-service for fund transfer. Updates loan state on success or failure.
- **Dependencies:** loan-service, payout-service, ledger-service, kafka-lending
- **Exposes:** Internal only
- **SLO:** 99.9% availability

---

### 3.4 Notifications Domain

#### notification-service
- **Owner:** Team Platform
- **Lead Engineer:** Ananya Singh
- **Language:** Node.js 20
- **Description:** Central notification dispatch hub. Receives notification requests via Kafka, routes to appropriate channel (email/SMS/push/webhook), and tracks delivery status.
- **Dependencies:** kafka-notifications, sendgrid, twilio-sms, firebase-push, postgresql-notifications
- **Exposes:** `notification.NotificationService` (gRPC — internal), `/v1/webhooks/*` (REST — external)
- **SLO:** 99.9% availability, email delivery p90 < 30s, SMS delivery p90 < 10s

#### webhook-service
- **Owner:** Team Platform
- **Lead Engineer:** Ananya Singh
- **Language:** Node.js 20
- **Description:** Manages merchant webhook subscriptions and delivery. Handles retry logic with exponential backoff. Stores webhook payload history for 30 days.
- **Dependencies:** notification-service, postgresql-notifications, redis-webhook
- **Exposes:** `/v1/merchant-webhooks/*` (REST)
- **SLO:** 99.9% availability, at-least-once delivery within 5 minutes

---

### 3.5 Data & Analytics Domain

#### reporting-service
- **Owner:** Team Data
- **Lead Engineer:** Rahul Gupta
- **Language:** Python 3.11
- **Description:** Generates merchant-facing financial reports. Runs scheduled queries on Redshift. Exports reports as PDF/CSV and delivers via email or makes available for API download.
- **Dependencies:** redshift-warehouse, postgresql-payments, sendgrid, s3-reports
- **Exposes:** `/v1/reports/*` (REST)
- **SLO:** 99.5% availability, report generation < 10 minutes

#### analytics-service
- **Owner:** Team Data
- **Lead Engineer:** Rahul Gupta
- **Language:** Python 3.11
- **Description:** Internal analytics API. Powers the merchant dashboard with real-time and historical metrics. Aggregates from Redshift and Redis.
- **Dependencies:** redshift-warehouse, redis-analytics, postgresql-payments
- **Exposes:** `/v1/analytics/*` (REST)
- **SLO:** 99.9% availability, p99 < 800ms

#### ml-pipeline-service
- **Owner:** Team Risk
- **Lead Engineer:** Meera Iyer
- **Language:** Python 3.11
- **Description:** Batch ML pipeline. Retrains fraud and credit models weekly using historical transaction data. Publishes new model artifacts to SageMaker.
- **Dependencies:** redshift-warehouse, sagemaker-fraud, sagemaker-credit, s3-models
- **Exposes:** Internal only (Airflow DAG)
- **SLO:** Completes weekly retraining within 6 hours

---

### 3.6 Infrastructure Domain

#### rate-limiter-service
- **Owner:** Team Platform
- **Lead Engineer:** Kavya Reddy
- **Language:** Go 1.21
- **Description:** Token bucket rate limiter. Enforces per-merchant and per-IP rate limits. Backed by Redis for distributed state.
- **Dependencies:** redis-ratelimit
- **Exposes:** `ratelimit.RateLimitService` (gRPC)
- **SLO:** 99.99% availability, p99 < 5ms

#### config-service
- **Owner:** Team Platform
- **Lead Engineer:** Kavya Reddy
- **Language:** Go 1.21
- **Description:** Dynamic configuration management. Stores feature flags and runtime configuration. Pushes configuration updates to services via long-poll.
- **Dependencies:** postgresql-config, redis-config
- **Exposes:** `/v1/config/*` (REST), `config.ConfigService` (gRPC)
- **SLO:** 99.99% availability

#### audit-service
- **Owner:** Team Compliance
- **Lead Engineer:** Rohan Verma
- **Language:** Go 1.21
- **Description:** Immutable audit log service. Every state change in the system emits an audit event. Audit events are stored in append-only PostgreSQL partition. Required for PCI-DSS compliance.
- **Dependencies:** postgresql-audit, kafka-audit
- **Exposes:** `/v1/audit/*` (REST — internal only)
- **SLO:** 99.99% availability

#### search-service
- **Owner:** Team Platform
- **Lead Engineer:** Arjun Mehta
- **Language:** Node.js 20
- **Description:** Full-text search over transactions, merchants, and users. Powered by Elasticsearch. Indices are built from Kafka streams.
- **Dependencies:** elasticsearch, kafka-payments, postgresql-payments
- **Exposes:** `/v1/search/*` (REST)
- **SLO:** 99.9% availability, p99 < 200ms

---

## 4. Databases

| Database ID | Name | Type | Hosted On | Primary Owner | Used By |
|---|---|---|---|---|---|
| postgresql-auth | Auth PostgreSQL | PostgreSQL 15 | AWS RDS | Team Identity | auth-service |
| postgresql-users | Users PostgreSQL | PostgreSQL 15 | AWS RDS | Team Identity | user-service |
| postgresql-payments | Payments PostgreSQL | PostgreSQL 15 | AWS RDS Multi-AZ | Team Payments | payment-service, fx-service, analytics-service |
| postgresql-ledger | Ledger PostgreSQL | PostgreSQL 15 | AWS RDS Multi-AZ | Team Payments | ledger-service, reconciliation-service |
| postgresql-lending | Lending PostgreSQL | PostgreSQL 15 | AWS RDS | Team Lending | loan-service |
| postgresql-risk | Risk PostgreSQL | PostgreSQL 15 | AWS RDS | Team Risk | underwriting-service, fraud-detection-service |
| postgresql-compliance | Compliance PostgreSQL | PostgreSQL 15 | AWS RDS | Team Compliance | kyc-service |
| postgresql-notifications | Notifications PostgreSQL | PostgreSQL 15 | AWS RDS | Team Platform | notification-service, webhook-service |
| postgresql-config | Config PostgreSQL | PostgreSQL 15 | AWS RDS | Team Platform | config-service |
| postgresql-audit | Audit PostgreSQL | PostgreSQL 15 | AWS RDS (append-only) | Team Compliance | audit-service |
| redis-session | Session Redis | Redis 7 | AWS ElastiCache | Team Identity | auth-service, session-service |
| redis-ratelimit | Rate Limit Redis | Redis 7 | AWS ElastiCache | Team Platform | rate-limiter-service |
| redis-fraud | Fraud Redis | Redis 7 | AWS ElastiCache | Team Risk | fraud-detection-service |
| redis-webhook | Webhook Redis | Redis 7 | AWS ElastiCache | Team Platform | webhook-service |
| redis-analytics | Analytics Redis | Redis 7 | AWS ElastiCache | Team Data | analytics-service |
| redis-fx | FX Redis | Redis 7 | AWS ElastiCache | Team Payments | fx-service |
| redis-config | Config Redis | Redis 7 | AWS ElastiCache | Team Platform | config-service |
| kafka-payments | Payments Kafka | Kafka 3.5 | AWS MSK | Team Payments | payment-service, ledger-service, payout-service, search-service |
| kafka-notifications | Notifications Kafka | Kafka 3.5 | AWS MSK | Team Platform | notification-service |
| kafka-lending | Lending Kafka | Kafka 3.5 | AWS MSK | Team Lending | loan-service, disbursement-service |
| kafka-audit | Audit Kafka | Kafka 3.5 | AWS MSK | Team Compliance | audit-service |
| redshift-warehouse | Data Warehouse | Redshift | AWS Redshift | Team Data | reporting-service, analytics-service, ml-pipeline-service |
| elasticsearch | Search Index | Elasticsearch 8 | AWS OpenSearch | Team Platform | search-service |
| s3-documents | Documents S3 | S3 | AWS S3 | Team Identity | user-service, kyc-service |
| s3-reports | Reports S3 | S3 | AWS S3 | Team Data | reporting-service |
| s3-models | ML Models S3 | S3 | AWS S3 | Team Risk | ml-pipeline-service |

---

## 5. External Vendors

| Vendor | Category | Used By | Contract Owner |
|---|---|---|---|
| Stripe | Payment Gateway (International) | payment-service, reconciliation-service | Siddharth Nair |
| Razorpay | Payment Gateway (India) | payment-service, payout-service, reconciliation-service | Siddharth Nair |
| Twilio | SMS / Voice | auth-service (OTP), notification-service | Ananya Singh |
| Google OAuth | Identity Provider | auth-service | Priya Sharma |
| SendGrid | Email Delivery | notification-service, reconciliation-service, reporting-service | Ananya Singh |
| Firebase (FCM) | Push Notifications | notification-service | Ananya Singh |
| AWS SageMaker | ML Model Hosting | fraud-detection-service, underwriting-service, ml-pipeline-service | Meera Iyer |
| Open Exchange Rates | FX Data | fx-service | Aditya Kumar |
| HyperVerge | KYC / Identity Verification | kyc-service | Rohan Verma |
| CIBIL | Credit Bureau (India) | underwriting-service | Meera Iyer |
| Experian | Credit Bureau | underwriting-service | Meera Iyer |
| AWS RDS | Managed Database | All database-owning teams | Kavya Reddy |

---

## 6. Teams

| Team | Slack Channel | On-Call Rotation | Team Lead |
|---|---|---|---|
| Team Identity | #team-identity | Priya Sharma, Arjun Mehta | Priya Sharma |
| Team Payments | #team-payments | Siddharth Nair, Neha Kapoor, Aditya Kumar | Siddharth Nair |
| Team Lending | #team-lending | Vikram Rao | Vikram Rao |
| Team Risk | #team-risk | Meera Iyer | Meera Iyer |
| Team Compliance | #team-compliance | Rohan Verma | Rohan Verma |
| Team Platform | #team-platform | Kavya Reddy, Ananya Singh, Arjun Mehta | Kavya Reddy |
| Team Data | #team-data | Rahul Gupta | Rahul Gupta |

---

## 7. Dependency Graph (Critical Paths)

### Payment Processing Critical Path
```
External Client
  → api-gateway
    → auth-service (token validation)
    → rate-limiter-service
    → payment-service
      → fraud-detection-service (inline, p99 < 80ms)
      → razorpay OR stripe (PSP routing)
      → ledger-service (async via kafka-payments)
      → audit-service (async via kafka-audit)
      → notification-service (async via kafka-notifications)
```

### Loan Disbursement Critical Path
```
External Client
  → api-gateway
    → auth-service
    → loan-service
      → underwriting-service (CIBIL, Experian, SageMaker)
      → disbursement-service
        → payout-service
          → razorpay
          → ledger-service
```

---

## 8. Runbooks

### RB-001: Auth Service Degradation
**Owner:** Priya Sharma  
**Trigger:** auth-service error rate > 1% for 5 consecutive minutes  
**Steps:**
1. Check redis-session health via `redis-cli ping` on ElastiCache
2. Verify Google OAuth upstream status at status.google.com
3. Check auth-service pod logs: `kubectl logs -n identity -l app=auth-service --tail=200`
4. If Redis is the root cause: failover to replica via AWS Console → ElastiCache → Modify
5. If Google OAuth is down: enable TOTP-only login via config-service feature flag `auth.disable_oauth=true`
6. Page on-call: Priya Sharma (primary), Arjun Mehta (secondary)

### RB-002: Payment Processing Degradation
**Owner:** Siddharth Nair  
**Trigger:** payment-service success rate < 95% for 3 consecutive minutes  
**Steps:**
1. Identify failing PSP: check Razorpay dashboard and Stripe dashboard
2. If Razorpay is down: switch traffic to Stripe via config-service `payment.primary_psp=stripe`
3. If Stripe is also down: enable payment queuing mode `payment.queue_mode=true`
4. Verify kafka-payments consumer lag < 10,000 messages
5. Check postgresql-payments connection pool utilization
6. Escalate to Siddharth Nair if error rate > 10% for more than 10 minutes
