# Meridian Financial Services — Incident History Report
**Period:** Q3–Q4 2024  
**Classification:** Internal — Engineering Only  
**Maintained by:** Site Reliability Engineering (Team Platform)

---

## INC-2024-047: Razorpay Webhook Timeout Cascade
**Date:** 2024-07-03  
**Duration:** 2 hours 14 minutes  
**Severity:** SEV-1  
**Status:** Resolved  
**Resolved By:** Siddharth Nair, Neha Kapoor  

### Summary
Razorpay experienced a partial outage on their webhook delivery infrastructure in their Mumbai region. Meridian's payment-service began accumulating unacknowledged webhook callbacks, causing callback retry storms that saturated the postgresql-payments connection pool. This triggered a cascading failure where new payment initiations began failing due to connection exhaustion.

### Timeline
- **14:32 IST** — PagerDuty alert: payment-service error rate exceeds 8%
- **14:35 IST** — Siddharth Nair acknowledges incident, begins investigation
- **14:41 IST** — Confirmed Razorpay webhook delivery latency spiking (p99 > 30s vs normal < 2s)
- **14:48 IST** — Identified postgresql-payments connection pool at 98% utilization
- **14:55 IST** — Neha Kapoor increases connection pool limit from 200 to 350 (temporary mitigation)
- **15:12 IST** — Razorpay confirms partial outage via their status page
- **15:20 IST** — Siddharth disables synchronous webhook acknowledgment; switches to async queue via kafka-payments
- **15:44 IST** — Error rate returns to baseline (<0.1%)
- **16:46 IST** — Razorpay fully recovers; webhook backlog processed
- **17:45 IST** — Incident closed

### Root Cause
Razorpay vendor outage in Mumbai region causing webhook delivery delays. Secondary root cause: payment-service lacked circuit breaker on webhook callback path, allowing connection pool exhaustion under external vendor degradation.

### Services Affected
- payment-service (primary, SEV-1)
- ledger-service (secondary — degraded due to kafka-payments backlog)
- notification-service (secondary — webhook delivery delayed)
- payout-service (secondary — blocked on postgresql-payments)

### Action Items
- [x] Add circuit breaker to Razorpay webhook callback handler (payment-service) — completed 2024-07-10
- [x] Add PagerDuty alert for postgresql-payments connection pool > 80% — completed 2024-07-08
- [ ] Implement PSP health check probes in api-gateway for automatic failover — assigned to Kavya Reddy, due 2024-08-15
- [ ] Add connection pool metrics to Grafana dashboard — assigned to Neha Kapoor, due 2024-07-30

### Runbook Used
RB-002: Payment Processing Degradation Runbook

---

## INC-2024-051: Redis Session Cluster Split-Brain
**Date:** 2024-07-18  
**Duration:** 47 minutes  
**Severity:** SEV-2  
**Status:** Resolved  
**Resolved By:** Priya Sharma  

### Summary
AWS ElastiCache performed an unscheduled maintenance event on the redis-session primary node. During the automated failover, a split-brain condition occurred where approximately 12% of auth-service instances continued writing to the old primary while others had failed over to the new primary. This caused session token validation to fail intermittently for active users, resulting in logout loops.

### Timeline
- **03:14 IST** — AWS ElastiCache sends maintenance notification (email only — not integrated with PagerDuty)
- **03:22 IST** — PagerDuty alert: auth-service token validation error rate > 2%
- **03:24 IST** — Priya Sharma acknowledges incident
- **03:31 IST** — Identified split-brain condition via ElastiCache replication lag metrics
- **03:38 IST** — Forced rolling restart of auth-service pods to clear stale Redis connections
- **03:55 IST** — auth-service error rate returns to normal
- **04:01 IST** — Incident closed

### Root Cause
AWS ElastiCache unscheduled maintenance caused automated primary failover. auth-service Redis client library (go-redis v8) did not properly re-discover the new primary endpoint during failover, maintaining connections to old primary.

### Services Affected
- auth-service (primary, SEV-2)
- session-service (secondary — dependent on redis-session)
- api-gateway (downstream — elevated 401 error rate)

### Action Items
- [x] Upgrade go-redis from v8 to v9 (improved cluster topology awareness) — Priya Sharma, completed 2024-07-25
- [x] Integrate AWS ElastiCache maintenance notifications with PagerDuty — Kavya Reddy, completed 2024-07-22
- [x] Add runbook step for Redis failover recovery — Priya Sharma, completed 2024-07-20

### Runbook Used
RB-001: Auth Service Degradation Runbook

---

## INC-2024-063: Fraud Model Stale Features Causing False Positives
**Date:** 2024-08-09  
**Duration:** 6 hours 30 minutes  
**Severity:** SEV-2  
**Status:** Resolved  
**Resolved By:** Meera Iyer, Rahul Gupta  

### Summary
The weekly ML model retraining pipeline (ml-pipeline-service) failed silently due to an Airflow DAG scheduler bug. The fraud detection model continued serving on a 3-week-old version. A seasonal spending pattern shift in August caused the stale model to generate elevated false positive fraud scores, resulting in 6.3% of legitimate transactions being declined.

### Timeline
- **09:00 IST** — Merchant support team reports spike in customer complaints about declined payments
- **10:15 IST** — Rahul Gupta investigates reporting-service data; identifies unusual decline rate pattern
- **10:40 IST** — Meera Iyer examines fraud-detection-service; finds model version date is 2024-07-19 (21 days stale)
- **11:00 IST** — Confirmed ml-pipeline-service DAG last successful run was 2024-07-20 due to Airflow scheduler crash
- **11:30 IST** — Immediate mitigation: lower fraud score threshold from 65 to 78 via config-service feature flag
- **13:00 IST** — Emergency manual retraining triggered on SageMaker
- **15:30 IST** — New model deployed to fraud-detection-service
- **15:45 IST** — Decline rate returns to baseline (0.8%)

### Root Cause
Airflow scheduler OOM crash caused ml-pipeline-service DAG to miss scheduled executions. No alerting was configured for DAG missed runs. Stale fraud model could not adapt to August seasonal transaction patterns.

### Services Affected
- fraud-detection-service (primary — stale model)
- payment-service (downstream — elevated false positive declines)
- ml-pipeline-service (root cause)

### Action Items
- [x] Add PagerDuty alert for ml-pipeline-service DAG missed scheduled runs — Meera Iyer, completed 2024-08-15
- [x] Add model freshness check to fraud-detection-service startup — Meera Iyer, completed 2024-08-20
- [x] Increase Airflow scheduler pod memory limit from 2Gi to 4Gi — Rahul Gupta, completed 2024-08-12
- [ ] Implement automated model rollback if false positive rate > 3% — assigned to Meera Iyer, due 2024-10-01

### Runbook Used
None — new runbook RB-007 created as result of this incident

---

## INC-2024-071: Kafka Consumer Group Lag Cascade
**Date:** 2024-08-27  
**Duration:** 1 hour 52 minutes  
**Severity:** SEV-2  
**Status:** Resolved  
**Resolved By:** Neha Kapoor, Kavya Reddy  

### Summary
A deployment of ledger-service with a bug in the Kafka consumer deserialization logic caused the payments consumer group to stop processing. kafka-payments consumer lag grew to 4.2 million messages over 90 minutes. Downstream impacts included delayed webhook delivery, delayed audit log writes, and ledger reconciliation skew.

### Timeline
- **16:05 IST** — ledger-service v2.4.1 deployed to production
- **16:07 IST** — PagerDuty alert: kafka-payments consumer lag growing
- **16:10 IST** — Neha Kapoor acknowledges
- **16:22 IST** — Identified deserialization exception in ledger-service logs for new Avro schema version
- **16:30 IST** — Rollback initiated: ledger-service v2.4.0 deployed
- **16:38 IST** — ledger-service consumer resumes; lag begins draining
- **17:57 IST** — Consumer lag reaches zero; all services nominal

### Root Cause
ledger-service v2.4.1 shipped with an Avro schema version bump that was incompatible with the schema version being produced by payment-service (which had not yet been updated). Schema Registry compatibility check was not enforced in the CI pipeline.

### Services Affected
- ledger-service (primary)
- notification-service (delayed — dependent on kafka-notifications backlog effect)
- webhook-service (delayed delivery)
- audit-service (delayed — kafka-audit consumer deprioritized during drain)
- reconciliation-service (data skew for that night's batch run)

### Action Items
- [x] Enforce Avro Schema Registry compatibility checks in CI — Kavya Reddy, completed 2024-09-05
- [x] Add Canary deployment requirement for ledger-service — Neha Kapoor, completed 2024-09-10
- [x] Add Kafka consumer lag alert threshold at 100K messages — Neha Kapoor, completed 2024-08-30

---

## INC-2024-089: Google OAuth Outage — Login Unavailable
**Date:** 2024-09-14  
**Duration:** 34 minutes  
**Severity:** SEV-1  
**Status:** Resolved  
**Resolved By:** Priya Sharma, Arjun Mehta  

### Summary
Google experienced a global identity services outage affecting Google OAuth. Meridian's auth-service relies on Google OAuth as the default authentication method for merchant portal logins. For 34 minutes, all merchant portal logins failed with "OAuth provider unavailable."

### Timeline
- **11:43 IST** — PagerDuty alert: auth-service OAuth endpoint error rate 100%
- **11:44 IST** — Priya Sharma and Arjun Mehta acknowledge simultaneously
- **11:46 IST** — Confirmed Google OAuth endpoint returning 503 globally
- **11:49 IST** — Priya Sharma activates TOTP fallback via config-service: `auth.disable_oauth=true`
- **12:00 IST** — Merchant portal login restored for TOTP-enrolled users (~68% of merchants)
- **12:17 IST** — Google OAuth service restored per workspace.google.com/status
- **12:18 IST** — config-service flag reverted: `auth.disable_oauth=false`
- **12:17 IST** — Full login restored

### Root Cause
Google OAuth external vendor outage (Google Workspace Identity Services). Google's incident postmortem cited a configuration push error in their identity federation layer.

### Services Affected
- auth-service (primary)
- api-gateway (downstream — all authenticated API calls failed)
- All Tier 1 services (indirect — authenticated operations unavailable)

### Action Items
- [x] Document TOTP fallback activation steps in RB-001 — Priya Sharma, completed 2024-09-15
- [ ] Evaluate adding a secondary OAuth provider (Microsoft Entra ID) — Priya Sharma, due 2024-11-01
- [ ] Increase TOTP enrollment rate from 68% to 95% via merchant onboarding flow — Arjun Mehta, due 2024-12-01

---

## INC-2024-104: Stripe API Version Deprecation Breaking Reconciliation
**Date:** 2024-10-02  
**Duration:** 8 hours (batch window)  
**Severity:** SEV-3  
**Status:** Resolved  
**Resolved By:** Neha Kapoor  

### Summary
Stripe deprecated API version 2022-08-01 on 2024-10-01 with 90 days prior notice. The reconciliation-service was still using this version. Nightly reconciliation batch failed silently, causing 1 day of settlement data to be missing from the ledger.

### Timeline
- **06:00 IST** — reconciliation-service nightly batch triggers
- **06:04 IST** — Stripe API returns 400: "This API version is no longer supported"
- **06:05 IST** — reconciliation-service exits with error code; no PagerDuty alert configured for batch failure
- **08:30 IST** — Finance team reports missing settlement data in dashboard
- **09:00 IST** — Neha Kapoor investigates; finds reconciliation-service failure in logs
- **09:30 IST** — Updated Stripe SDK from 2022-08-01 to 2024-09-01 API version
- **10:00 IST** — Manual re-run of reconciliation batch for 2024-10-01 data
- **14:00 IST** — Reconciliation complete; ledger data restored

### Root Cause
Stripe API version deprecation. Internal tracking of vendor API version lifecycle was not in place. The 90-day deprecation notice email was not routed to the engineering team.

### Services Affected
- reconciliation-service (primary)
- ledger-service (data gap — no direct failure)
- reporting-service (incorrect settlement reports for 2024-10-01)

### Action Items
- [x] Update reconciliation-service to Stripe API v2024-09-01 — Neha Kapoor, completed 2024-10-02
- [x] Add PagerDuty alert for reconciliation-service batch failure — Neha Kapoor, completed 2024-10-03
- [ ] Create vendor API deprecation tracking document and review calendar — Kavya Reddy, due 2024-11-01
- [ ] Subscribe all vendor deprecation notices to #engineering-alerts Slack channel — Kavya Reddy, due 2024-10-15

---

## INC-2024-118: Notification Service Memory Leak — SMS Backlog
**Date:** 2024-10-19  
**Duration:** 3 hours 20 minutes  
**Severity:** SEV-2  
**Status:** Resolved  
**Resolved By:** Ananya Singh  

### Summary
A memory leak introduced in notification-service v3.1.0 caused pods to gradually exhaust heap memory over approximately 8 hours of runtime. Kubernetes OOMKilled the pods in rolling succession. During pod restart cycles, kafka-notifications consumer lag grew to 850K messages, causing significant SMS OTP delivery delays affecting auth-service login flows.

### Timeline
- **02:00 IST** — notification-service v3.1.0 deployed
- **10:12 IST** — First pod OOMKilled and restarted
- **10:30 IST** — PagerDuty alert: notification-service pod restart loop
- **10:35 IST** — Ananya Singh acknowledges
- **10:50 IST** — Memory leak identified in Twilio response object not being garbage collected
- **11:00 IST** — Rollback to notification-service v3.0.9 initiated
- **11:15 IST** — All pods stable on v3.0.9
- **11:30 IST** — kafka-notifications backlog begins draining
- **13:20 IST** — Consumer lag reaches zero; SMS delivery normalized
- **13:35 IST** — Incident closed

### Root Cause
Memory leak in notification-service v3.1.0: Twilio API response objects were being cached in-memory without TTL in a static Map, causing unbounded growth. Code review missed this as the affected code path was only reached in production traffic volumes (> 5K SMS/minute).

### Services Affected
- notification-service (primary)
- auth-service (downstream — OTP SMS delivery delayed; users unable to complete login)
- webhook-service (downstream — delayed merchant webhook delivery)

### Runbook Used
None — Ananya Singh used ad-hoc investigation

### Action Items
- [x] Rollback notification-service to v3.0.9 — completed
- [x] Fix memory leak in v3.1.1 with proper TTL on Twilio response cache — Ananya Singh, completed 2024-10-25
- [x] Add memory usage alert at 80% heap for notification-service pods — Ananya Singh, completed 2024-10-20
- [ ] Create notification-service degradation runbook (RB-005) — Ananya Singh, due 2024-11-01
