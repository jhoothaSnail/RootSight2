# Meridian Financial Services — Engineering Runbook Collection
**Maintained by:** Platform Engineering (Kavya Reddy)  
**Last Updated:** 2024-11-01  
**Classification:** Internal — On-Call Use Only

---

## RB-001: Auth Service Degradation Runbook
**Service:** auth-service  
**Owner:** Priya Sharma (primary), Arjun Mehta (secondary)  
**PagerDuty Policy:** P1 — Identity On-Call  
**Last Tested:** 2024-09-15  

### Trigger Conditions
- auth-service error rate > 1% for 5 consecutive minutes (PagerDuty alert: AUTH_HIGH_ERROR_RATE)
- auth-service p99 latency > 500ms for 10 minutes (PagerDuty alert: AUTH_HIGH_LATENCY)
- auth-service pod restart count > 3 in 15 minutes (PagerDuty alert: AUTH_POD_RESTART_LOOP)

### Step 1 — Identify the Failure Component
```bash
# Check auth-service pod status
kubectl get pods -n identity -l app=auth-service

# Tail live logs
kubectl logs -n identity -l app=auth-service --tail=200 -f

# Check error rate in Datadog
# Dashboard: "Identity Domain — Auth Service SLO"
# Key metric: auth.token_validation.error_rate
```

### Step 2 — Check Redis Session Health
```bash
# Get ElastiCache endpoint from AWS Console → ElastiCache → redis-session
redis-cli -h <endpoint> -p 6379 PING
redis-cli -h <endpoint> -p 6379 INFO replication

# Check replication lag — should be < 100ms
# If primary is unavailable, initiate manual failover:
# AWS Console → ElastiCache → redis-session → Actions → Failover Primary
```

### Step 3 — Check Google OAuth Upstream
```bash
curl -I https://accounts.google.com/.well-known/openid-configuration
# Expected: HTTP 200
# If not 200: check https://workspace.google.com/status
```

**If Google OAuth is down:**
```bash
# Enable TOTP-only login via config-service
curl -X PATCH https://config-service.internal/v1/config \
  -H "Authorization: Bearer $SRE_TOKEN" \
  -d '{"key": "auth.disable_oauth", "value": "true"}'

# Verify flag took effect
kubectl exec -n identity deploy/auth-service -- env | grep DISABLE_OAUTH
```

### Step 4 — Verify Twilio SMS Delivery (OTP path)
```bash
# Check Twilio SMS delivery rate
# Twilio Console → Monitor → Messaging → Overview
# Acceptable delivery rate: > 97%
# If Twilio is degraded: check notification-service logs for retry storms
```

### Step 5 — Escalation
- **0–15 min:** Priya Sharma (primary on-call)
- **15–30 min:** Arjun Mehta (secondary)
- **30+ min:** Kavya Reddy (Platform Lead) + Incident Bridge

---

## RB-002: Payment Processing Degradation Runbook
**Service:** payment-service  
**Owner:** Siddharth Nair (primary), Neha Kapoor (secondary)  
**PagerDuty Policy:** P1 — Payments On-Call  
**Last Tested:** 2024-10-01  

### Trigger Conditions
- payment-service success rate < 95% for 3 consecutive minutes
- payment-service p99 > 2000ms for 5 minutes
- Kafka consumer lag on payments-processed topic > 100,000 messages

### Step 1 — Identify PSP Failure
```bash
# Check Razorpay status
open https://status.razorpay.com

# Check Stripe status
open https://status.stripe.com

# Check payment-service PSP error breakdown in Datadog
# Metric: payment.psp.error_rate by psp_name
```

**If Razorpay is down, failover to Stripe:**
```bash
curl -X PATCH https://config-service.internal/v1/config \
  -H "Authorization: Bearer $SRE_TOKEN" \
  -d '{"key": "payment.primary_psp", "value": "stripe"}'

# Confirm routing change in payment-service logs
kubectl logs -n payments -l app=payment-service --tail=50 | grep "PSP route"
```

**If both PSPs are degraded:**
```bash
# Enable payment queuing mode (payments accepted, deferred for processing)
curl -X PATCH https://config-service.internal/v1/config \
  -H "Authorization: Bearer $SRE_TOKEN" \
  -d '{"key": "payment.queue_mode", "value": "true"}'
```

### Step 2 — Check PostgreSQL Payments Connection Pool
```bash
# Check connection pool utilization
# Datadog metric: postgresql.connections.in_use / postgresql.connections.max

# If pool > 80% utilized, increase temporarily:
# AWS Console → RDS → postgresql-payments → Modify → max_connections
# Temporary safe limit: increase by 150 connections

# Also check for long-running queries
psql -h postgresql-payments.internal -U app_readonly -c \
  "SELECT pid, now() - query_start AS duration, query FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC LIMIT 20;"
```

### Step 3 — Check Kafka Consumer Lag
```bash
# Check kafka-payments consumer groups
kafka-consumer-groups.sh \
  --bootstrap-server kafka-payments.internal:9092 \
  --describe \
  --group payment-service-consumer

# If lag > 1M messages on ledger-service consumer:
kubectl rollout restart deployment/ledger-service -n payments
```

### Step 4 — Check Fraud Detection
```bash
# fraud-detection-service adds ~80ms to payment path
# If FDS is timing out, payment-service will reject payments after 200ms circuit breaker
kubectl logs -n risk -l app=fraud-detection-service --tail=100 | grep ERROR

# Emergency: disable inline fraud check (use async mode)
curl -X PATCH https://config-service.internal/v1/config \
  -d '{"key": "fraud.inline_check", "value": "false"}'
# WARNING: This increases fraud risk. Must be approved by Meera Iyer.
```

### Step 5 — Escalation
- **0–10 min:** Siddharth Nair (primary on-call)
- **10–20 min:** Neha Kapoor (secondary)
- **20+ min:** CTO bridge + Siddharth Nair + Finance team notification

---

## RB-003: Kafka Consumer Lag Recovery Runbook
**Service:** kafka-payments, kafka-notifications, kafka-lending, kafka-audit  
**Owner:** Kavya Reddy (primary), Neha Kapoor (secondary)  
**PagerDuty Policy:** P2 — Platform On-Call  

### Trigger Conditions
- Any Kafka consumer group lag > 100,000 messages (alert: KAFKA_HIGH_LAG)
- Consumer group offset not advancing for > 5 minutes (alert: KAFKA_CONSUMER_STUCK)

### Step 1 — Identify Stuck Consumer
```bash
# List all consumer groups and their lag
kafka-consumer-groups.sh \
  --bootstrap-server kafka-payments.internal:9092 \
  --list | xargs -I{} kafka-consumer-groups.sh \
  --bootstrap-server kafka-payments.internal:9092 \
  --describe --group {}

# Find which partition is stuck (LAG column = non-decreasing over 2 checks)
```

### Step 2 — Check Consumer Service Health
```bash
# Identify which service owns the stuck consumer group
# payment-service-consumer → payment-service
# ledger-service-consumer → ledger-service
# notification-consumer → notification-service

# Check the service pods
kubectl get pods -n <namespace> -l app=<service>

# Check for deserialization errors (common cause)
kubectl logs -n <namespace> -l app=<service> --tail=200 | grep -i "deserialization\|schema\|avro\|parse error"
```

### Step 3 — Recovery Options

**Option A: Restart consumer service (low risk)**
```bash
kubectl rollout restart deployment/<service-name> -n <namespace>
# Monitor lag drain rate: should see LAG decreasing within 2 minutes
```

**Option B: Scale up consumers (if lag is massive, > 1M messages)**
```bash
kubectl scale deployment/<service-name> -n <namespace> --replicas=<current+4>
# Reduce back to normal after lag clears
```

**Option C: Skip to latest offset (LAST RESORT — data loss risk)**
```bash
# REQUIRES approval from Siddharth Nair AND Kavya Reddy before execution
kafka-consumer-groups.sh \
  --bootstrap-server kafka-payments.internal:9092 \
  --group <consumer-group> \
  --reset-offsets --to-latest \
  --topic <topic-name> \
  --execute
```

---

## RB-004: Database Connection Pool Exhaustion
**Service:** All PostgreSQL-backed services  
**Owner:** Kavya Reddy  
**PagerDuty Policy:** P1 — Platform On-Call  

### Trigger Conditions
- PostgreSQL connection pool > 85% utilized for 5 minutes
- Connection wait time > 500ms p50
- `FATAL: remaining connection slots are reserved` errors in service logs

### Step 1 — Identify Exhausted Database
```bash
# Datadog query to find which database is saturated:
# metric: postgresql.connections.in_use by db_host

# Databases ranked by risk (most connections = most risk):
# postgresql-payments (shared by payment-service, fx-service, analytics-service)
# postgresql-ledger (ledger-service, reconciliation-service)
```

### Step 2 — Identify Connection Hog
```bash
psql -h <db-host>.internal -U app_readonly << 'SQL'
SELECT 
  application_name,
  state,
  COUNT(*) as connection_count,
  MAX(now() - state_change) as longest_duration
FROM pg_stat_activity
WHERE datname = 'meridian'
GROUP BY application_name, state
ORDER BY connection_count DESC;
SQL
```

### Step 3 — Kill Long-Running Idle Connections
```bash
psql -h <db-host>.internal -U app_admin << 'SQL'
-- Kill connections idle > 10 minutes
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'meridian'
  AND state = 'idle'
  AND now() - state_change > interval '10 minutes';
SQL
```

### Step 4 — Increase max_connections Temporarily
```
AWS Console → RDS → <db-instance> → Modify
Change max_connections parameter group value
Requires instance reboot — coordinate with service owners
Temporary ceiling: do not exceed 700 (instance memory limit)
```

---

## RB-005: Notification Service Degradation
**Service:** notification-service  
**Owner:** Ananya Singh (primary)  
**PagerDuty Policy:** P2 — Platform On-Call  
**Created:** 2024-10-25 (post INC-2024-118)  

### Trigger Conditions
- notification-service pod OOMKilled > 2 times in 30 minutes
- kafka-notifications consumer lag > 500,000 messages
- SMS delivery success rate < 95% (affects OTP delivery for auth-service)

### Step 1 — Check Pod Health
```bash
kubectl get pods -n platform -l app=notification-service
kubectl describe pod -n platform <pod-name> | grep -A5 "OOMKilled\|Reason"

# Check memory usage trend
kubectl top pod -n platform -l app=notification-service
```

### Step 2 — Check Twilio and SendGrid Status
```bash
# Twilio: https://status.twilio.com
# SendGrid: https://status.sendgrid.com

# Check error rates per channel
kubectl logs -n platform -l app=notification-service --tail=500 | \
  grep -E "(twilio|sendgrid|firebase)" | grep ERROR
```

### Step 3 — If Memory Leak Suspected
```bash
# Rollback to last known good version
kubectl rollout undo deployment/notification-service -n platform

# Verify rollback
kubectl rollout status deployment/notification-service -n platform

# Check memory stabilizes
kubectl top pod -n platform -l app=notification-service --watch
```

### Step 4 — Drain Kafka Backlog After Recovery
```bash
# Scale up temporarily to drain backlog faster
kubectl scale deployment/notification-service -n platform --replicas=12

# Monitor lag drain
kafka-consumer-groups.sh \
  --bootstrap-server kafka-notifications.internal:9092 \
  --describe --group notification-service-consumer

# Scale back to normal (8 replicas) when lag < 10,000
kubectl scale deployment/notification-service -n platform --replicas=8
```

---

## RB-006: FX Rate Data Staleness
**Service:** fx-service  
**Owner:** Aditya Kumar  
**PagerDuty Policy:** P3 — Payments On-Call  

### Trigger Conditions
- FX rate data age > 120 seconds (SLO requires < 60s freshness)
- fx-service → Open Exchange Rates API error rate > 10%
- redis-fx cache miss rate > 50%

### Step 1 — Check Open Exchange Rates API
```bash
curl -I "https://openexchangerates.org/api/latest.json?app_id=$OER_APP_ID"
# Expected: HTTP 200
# Check: https://status.openexchangerates.org
```

### Step 2 — Check Cache State
```bash
redis-cli -h redis-fx.internal KEYS "fx:rate:*" | wc -l
redis-cli -h redis-fx.internal TTL "fx:rate:USD:INR"
# Expected TTL: 30–60 seconds. If -1: key has no expiry (bug). If -2: key missing.
```

### Step 3 — Force Rate Refresh
```bash
# Trigger manual rate refresh (clears redis-fx and re-fetches from OER)
curl -X POST https://fx-service.internal/v1/fx/admin/refresh \
  -H "Authorization: Bearer $SRE_TOKEN"
```

### Step 4 — Enable Stale Rate Fallback
```bash
# If OER is down, enable stale rate fallback (uses last known rates with warning header)
curl -X PATCH https://config-service.internal/v1/config \
  -d '{"key": "fx.allow_stale_rates", "value": "true", "stale_max_age_seconds": "3600"}'
# WARNING: Notify Aditya Kumar and Finance team before enabling
```

---

## RB-007: Fraud Model Staleness / False Positive Surge
**Service:** fraud-detection-service, ml-pipeline-service  
**Owner:** Meera Iyer  
**PagerDuty Policy:** P2 — Risk On-Call  
**Created:** 2024-08-15 (post INC-2024-063)  

### Trigger Conditions
- Payment false positive rate > 3% (legitimate transactions declined) for 30 minutes
- fraud-detection-service model version age > 14 days
- ml-pipeline-service DAG missed scheduled run (alert: ML_DAG_MISSED_RUN)

### Step 1 — Check Model Version Age
```bash
curl https://fraud-detection-service.internal/v1/fraud/model/info \
  -H "Authorization: Bearer $SRE_TOKEN"
# Expected response: {"model_version": "...", "trained_at": "...", "age_days": <number>}
# Alert if age_days > 14
```

### Step 2 — Lower Fraud Score Threshold (Immediate Mitigation)
```bash
# Default threshold: 65 (scores above this → decline)
# Lower to reduce false positives at cost of slightly increased fraud risk
# Requires approval from Meera Iyer before execution
curl -X PATCH https://config-service.internal/v1/config \
  -d '{"key": "fraud.score_threshold", "value": "78"}'
```

### Step 3 — Trigger Emergency Model Retraining
```bash
# Log into Airflow UI: https://airflow.internal
# Trigger DAG: fraud-model-retraining-pipeline
# Estimated runtime: 2.5 hours on SageMaker ml.m5.4xlarge

# Monitor SageMaker training job
aws sagemaker list-training-jobs \
  --name-contains fraud-model \
  --sort-by CreationTime \
  --sort-order Descending \
  --max-results 5
```

### Step 4 — Deploy Retrained Model
```bash
# After SageMaker training completes:
# 1. Promote model artifact in SageMaker Model Registry
# 2. Update fraud-detection-service model endpoint via rolling deploy
kubectl rollout restart deployment/fraud-detection-service -n risk
kubectl rollout status deployment/fraud-detection-service -n risk

# 3. Monitor false positive rate for 30 minutes
# 4. Restore fraud score threshold to default
curl -X PATCH https://config-service.internal/v1/config \
  -d '{"key": "fraud.score_threshold", "value": "65"}'
```
