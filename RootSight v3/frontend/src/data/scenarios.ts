import type { AnalyzeResponse, ScenarioName, SimulateResponse } from '../types';

// Offline fallback dataset for the incident simulator. Mirrors the backend
// scenarios.js so the demo remains fully interactive (all four scenarios) even
// when the API server is unreachable. The live backend remains the source of
// truth when available.

interface ScenarioFixture {
  simulate: SimulateResponse;
  analyze: AnalyzeResponse;
}

export const SCENARIO_NAMES: ScenarioName[] = [
  'OAuth Failure',
  'Database Failure',
  'Payment Gateway Failure',
  'Twilio Failure',
];

export const SCENARIOS: Record<ScenarioName, ScenarioFixture> = {
  'OAuth Failure': {
    simulate: {
      scenario: 'OAuth Failure',
      incidentId: 'INC-58',
      events: [
        { id: 'evt1', type: 'alert', message: 'Google OAuth token endpoint returning 504 Gateway Timeout', timestamp: '2026-06-24T12:00:02Z', source: 'Auth Service' },
        { id: 'evt2', type: 'log', message: 'Login timeout detected - token validation failed for 1,284 sessions', timestamp: '2026-06-24T12:00:14Z', source: 'Login Service' },
        { id: 'evt3', type: 'log', message: 'Registration flow aborted: upstream auth dependency unavailable', timestamp: '2026-06-24T12:00:31Z', source: 'Registration Service' },
        { id: 'evt4', type: 'ticket', message: "Multiple users report 'Cannot login: Invalid token response'", timestamp: '2026-06-24T12:01:05Z', source: 'Support Desk' },
        { id: 'evt5', type: 'log', message: 'Password reset emails delayed - auth handshake exceeded 5000ms', timestamp: '2026-06-24T12:01:40Z', source: 'Password Reset Service' },
        { id: 'evt6', type: 'complaint', message: "Customer @meridian_ops: 'OAuth login broken for our whole team'", timestamp: '2026-06-24T12:02:12Z', source: 'Twitter' },
        { id: 'evt7', type: 'alert', message: 'Error rate on Auth Service exceeded 35% over 5 minute window', timestamp: '2026-06-24T12:02:48Z', source: 'API Gateway' },
      ],
    },
    analyze: {
      rootCause: 'Google OAuth',
      rootCauseType: 'Vendor',
      confidence: 92,
      confidenceLabel: 'High',
      affectedServices: ['Login Service', 'Registration Service', 'Password Reset Service', 'Team Creation Service'],
      affectedVendors: ['Google OAuth'],
      affectedTeams: ['Team Alpha'],
      impactRadius: { services: 4, teams: 1, vendors: 1, estimatedUsers: 12400 },
      explanation:
        'Google OAuth outage caused authentication failures across dependent services. The token endpoint returned sustained 504 Gateway Timeouts, breaking token validation for Auth Service and cascading to Login Service and Registration Service. Because four Tier-1 services depend on this single vendor without a localized fallback, the failure propagated organization-wide within three minutes.',
      evidence: [
        'Auth Service token validation error rate spiked to 35% during the OAuth degradation window.',
        'Login Service and Registration Service both trace upstream to Google OAuth via Auth Service.',
        'Historical incident INC-42 exhibited the same OAuth credential latency signature.',
      ],
      historicalMatch: { incidentId: 'INC-42', date: '2025-01-12', summary: 'OAuth credential latency caused login failures across Team Alpha services.', resolver: 'Rahul', team: 'Team Alpha' },
      suggestedRunbook: 'RB-001',
    },
  },

  'Database Failure': {
    simulate: {
      scenario: 'Database Failure',
      incidentId: 'INC-59',
      events: [
        { id: 'evt1', type: 'alert', message: 'PostgreSQL primary active connections at 97% of pool ceiling', timestamp: '2026-06-24T14:10:03Z', source: 'PostgreSQL' },
        { id: 'evt2', type: 'log', message: 'Auth Service query latency p99 climbed to 4,200ms', timestamp: '2026-06-24T14:10:21Z', source: 'Auth Service' },
        { id: 'evt3', type: 'log', message: 'User Service connection acquisition timeout after 5000ms', timestamp: '2026-06-24T14:10:44Z', source: 'User Service' },
        { id: 'evt4', type: 'alert', message: "Payment Service write transactions failing: 'too many clients already'", timestamp: '2026-06-24T14:11:09Z', source: 'Payment Service' },
        { id: 'evt5', type: 'ticket', message: 'On-call reports dashboard and profile pages timing out', timestamp: '2026-06-24T14:11:50Z', source: 'Support Desk' },
        { id: 'evt6', type: 'alert', message: 'Connection pool saturation alarm escalated to P1', timestamp: '2026-06-24T14:12:30Z', source: 'API Gateway' },
      ],
    },
    analyze: {
      rootCause: 'PostgreSQL',
      rootCauseType: 'Database',
      confidence: 88,
      confidenceLabel: 'High',
      affectedServices: ['Auth Service', 'User Service', 'Payment Service'],
      affectedVendors: [],
      affectedTeams: ['Team Alpha', 'Team Beta', 'Platform Team'],
      impactRadius: { services: 3, teams: 3, vendors: 0, estimatedUsers: 8800 },
      explanation:
        'A connection pool exhaustion on the PostgreSQL primary degraded every service backed by it. With the pool saturated at 97%, Auth Service, User Service and Payment Service could no longer acquire connections, producing cascading query timeouts. Because three Tier-1 services share the same primary instance, the saturation surfaced simultaneously across authentication, profile and payment write paths.',
      evidence: [
        'PostgreSQL active connections held above 95% of the configured pool ceiling for the full incident window.',
        'Auth Service, User Service and Payment Service all hold direct USES edges to PostgreSQL in the dependency graph.',
        "Error signatures ('too many clients already') match historical incident INC-37.",
      ],
      historicalMatch: { incidentId: 'INC-37', date: '2024-11-03', summary: 'Connection pool exhaustion on the payments database caused write failures.', resolver: 'Neha', team: 'Team Beta' },
      suggestedRunbook: 'RB-002',
    },
  },

  'Payment Gateway Failure': {
    simulate: {
      scenario: 'Payment Gateway Failure',
      incidentId: 'INC-60',
      events: [
        { id: 'evt1', type: 'alert', message: 'Razorpay charge API returning 502 for 41% of requests', timestamp: '2026-06-24T16:22:05Z', source: 'Payment Service' },
        { id: 'evt2', type: 'log', message: 'Payment Service settlement webhooks not acknowledged by upstream', timestamp: '2026-06-24T16:22:28Z', source: 'Payment Service' },
        { id: 'evt3', type: 'log', message: 'Billing Service invoice finalization stalled awaiting capture confirmation', timestamp: '2026-06-24T16:22:59Z', source: 'Billing Service' },
        { id: 'evt4', type: 'ticket', message: "Merchant reports: 'Checkout failing at payment step'", timestamp: '2026-06-24T16:23:40Z', source: 'Support Desk' },
        { id: 'evt5', type: 'complaint', message: "Customer @retailco: 'Payments declined repeatedly for 20 minutes'", timestamp: '2026-06-24T16:24:15Z', source: 'Twitter' },
      ],
    },
    analyze: {
      rootCause: 'Razorpay',
      rootCauseType: 'Vendor',
      confidence: 90,
      confidenceLabel: 'High',
      affectedServices: ['Payment Service', 'Billing Service'],
      affectedVendors: ['Razorpay'],
      affectedTeams: ['Team Beta'],
      impactRadius: { services: 2, teams: 1, vendors: 1, estimatedUsers: 5300 },
      explanation:
        'An upstream Razorpay degradation broke the payment capture path. The charge API returned 502 responses for roughly 41% of requests and stopped acknowledging settlement webhooks, leaving Payment Service unable to confirm captures. Billing Service, which depends on Payment Service to finalize invoices, stalled as a direct downstream effect. The blast radius is contained to the payments domain owned by Team Beta.',
      evidence: [
        'Razorpay charge API error rate held at 41% with unacknowledged settlement webhooks.',
        'Billing Service depends on Payment Service, which holds the only USES_VENDOR edge to Razorpay.',
        'Failure pattern matches historical incident INC-29 (PSP capture degradation).',
      ],
      historicalMatch: { incidentId: 'INC-29', date: '2025-03-19', summary: 'Razorpay capture degradation stalled checkout and invoice finalization.', resolver: 'Priya', team: 'Team Beta' },
      suggestedRunbook: null,
    },
  },

  'Twilio Failure': {
    simulate: {
      scenario: 'Twilio Failure',
      incidentId: 'INC-61',
      events: [
        { id: 'evt1', type: 'alert', message: 'Twilio SMS delivery receipts dropping - 0 confirmations in 4 minutes', timestamp: '2026-06-24T18:05:01Z', source: 'Notification Service' },
        { id: 'evt2', type: 'log', message: 'Password Reset Service OTP dispatch timing out at Twilio webhook', timestamp: '2026-06-24T18:05:26Z', source: 'Password Reset Service' },
        { id: 'evt3', type: 'log', message: 'Notification Service SMS queue depth rising: 3,900 pending', timestamp: '2026-06-24T18:05:58Z', source: 'Notification Service' },
        { id: 'evt4', type: 'ticket', message: "Users report 'OTP never arrives' during password reset", timestamp: '2026-06-24T18:06:35Z', source: 'Support Desk' },
        { id: 'evt5', type: 'complaint', message: "Customer @opsdaily: 'Not receiving any verification texts'", timestamp: '2026-06-24T18:07:10Z', source: 'Twitter' },
      ],
    },
    analyze: {
      rootCause: 'Twilio',
      rootCauseType: 'Vendor',
      confidence: 86,
      confidenceLabel: 'High',
      affectedServices: ['Password Reset Service', 'Notification Service'],
      affectedVendors: ['Twilio'],
      affectedTeams: ['Team Alpha', 'Platform Team'],
      impactRadius: { services: 2, teams: 2, vendors: 1, estimatedUsers: 4100 },
      explanation:
        'A Twilio SMS delivery degradation disrupted all outbound text messaging. Delivery receipts stopped arriving and OTP dispatch through the Twilio webhook timed out, causing the Notification Service queue to back up past 3,900 pending messages. Password Reset Service, which relies on SMS OTP, was directly impacted, blocking account recovery for affected users.',
      evidence: [
        'Twilio returned zero delivery confirmations for a sustained four-minute window.',
        'Password Reset Service and Notification Service both hold USES_VENDOR edges to Twilio.',
        'Symptom profile matches historical incident INC-18 (SMS provider delivery stall).',
      ],
      historicalMatch: { incidentId: 'INC-18', date: '2024-09-27', summary: 'Twilio delivery stall blocked OTP and verification messages.', resolver: 'Arjun', team: 'Platform Team' },
      suggestedRunbook: null,
    },
  },
};
