# Requirements Document

## Introduction

This specification defines the requirements for implementing HIPAA-aware and SOX-inspired compliance features for the Clinical Rounding Application with minimal infrastructure footprint. The system operates in a "relaxed" compliance mode by default but can be upgraded to strict HIPAA or SOX compliance when required. The approach prioritizes managed services, privacy by default, evidence-ready controls, and adaptive multimodal UI with configurable enforcement levels.

## Design Principles (Non-functional, apply to all requirements)

- **Minimum footprint**: Prefer managed identity, managed key management, managed logging, managed backups; avoid custom crypto, custom SIEM, bespoke retention engines unless required
- **Privacy by default**: Least privilege, minimum necessary, masking, short session lifetimes
- **Evidence-ready**: Every control has an auditable event, retention rule, and owner
- **Adaptive multimodal UI**: Responsive layout across phone/tablet/desktop, supports keyboard/mouse/touch, camera upload, dictation (where allowed), and offline-tolerant read cache (no PHI stored unencrypted)
- **Configurable compliance**: Default relaxed mode upgradeable to strict HIPAA/SOX compliance

## Glossary

- **Clinical_System**: The existing clinical rounding web application
- **PHI**: Protected Health Information as defined by HIPAA
- **IdP**: External Identity Provider (optional, configurable)
- **KMS**: Key Management Service (managed cloud service)
- **RBAC**: Role-Based Access Control system
- **BAA**: Business Associate Agreement (required in strict HIPAA mode)
- **Audit_Logger**: Component responsible for configurable audit logging
- **Session_Manager**: Component managing user sessions with configurable timeouts
- **Compliance_Mode**: System setting (relaxed/hipaa_strict/sox_strict)

## Requirements

### Requirement 1: Identity, Authentication, Sessions, Authorization

**User Story:** As an admin/security owner, I need configurable identity and least-privilege access so authorized users can access PHI and billing data with appropriate controls.

#### Acceptance Criteria

1. THE Clinical_System SHALL optionally use an external IdP with OIDC/OAuth2 protocols
2. WHEN MFA is enabled, THE Clinical_System SHALL enforce MFA for financial data access and export operations
3. WHEN users are inactive for 15 minutes, THE Session_Manager SHALL auto-timeout sessions with configurable absolute session lifetime
4. THE Clinical_System SHALL implement RBAC with least-privilege permissions per role (clinician/billing/admin) and per action
5. WHEN unauthorized access is attempted, THE Clinical_System SHALL deny access and audit the attempt with user, time, IP/device, action, and resource type

### Requirement 2: Data Protection - Encryption, Key Management, Secrets

**User Story:** As a compliance officer, I need PHI protected at rest/in transit with controlled keys using minimal infrastructure.

#### Acceptance Criteria

1. WHEN data is stored, THE Clinical_System SHALL encrypt data at rest using AES-256 (DB, object storage, backups)
2. WHEN data is transmitted, THE Clinical_System SHALL use TLS 1.3+ (including internal service calls)
3. THE Clinical_System SHALL manage keys in a KMS/HSM-backed service; app code SHALL NOT store raw keys
4. THE Clinical_System SHALL rotate keys at least annually with emergency rotation support
5. WHEN secrets are stored (API keys, DB creds), THE Clinical_System SHALL use a managed secrets vault with access logs

### Requirement 3: Audit Logging

**User Story:** As an auditor, I need configurable audit logs for access events and data changes with minimal infrastructure.

#### Acceptance Criteria

1. WHEN access events occur, THE Audit_Logger SHALL log user, timestamp, tokenized patient identifiers, action, and UI/API route
2. WHEN data changes occur, THE Audit_Logger SHALL log field-level change metadata with minimal verbosity by default
3. WHEN authentication events occur, THE Audit_Logger SHALL log login/logout, MFA status, IP/device fingerprint
4. WHEN financial changes or errors occur, THE Audit_Logger SHALL log with elevated detail
5. THE Audit_Logger SHALL store logs with configurable immutability and retain for 6 years
6. WHEN incidents are detected, THE Audit_Logger SHALL increase verbosity automatically

### Requirement 4: Data Lifecycle and External Drive Backups

**User Story:** As operations/records owner, I need configurable retention, secure backups including user-initiated encrypted exports to external drives, with auditable proof.

#### Acceptance Criteria

1. WHEN records are created, THE Clinical_System SHALL carry configurable retention metadata by data category
2. THE Clinical_System SHALL perform automatic, encrypted daily backups to managed cloud storage with monthly restore testing
3. THE Clinical_System SHALL support user-initiated encrypted backups/exports to OneDrive and Google Drive (personal and enterprise accounts)
4. WHEN external drive exports occur, THE Clinical_System SHALL warn on personal accounts and optionally block if BAA policy requires
5. THE Clinical_System SHALL encrypt external exports client-side using AES-256 with managed KMS, redact PHI by default, and avoid PHI in filenames
6. THE Clinical_System SHALL audit all export events (started/completed) and restore operations with integrity checks
7. WHEN secure disposal is required, THE Clinical_System SHALL use provider-supported secure deletion with logged events

### Requirement 5: Monitoring, Detection, Incident Response

**User Story:** As security, I need detection of misuse and fast containment with traceable actions using baseline rules.

#### Acceptance Criteria

1. THE Clinical_System SHALL detect anomalies: unusual patient volume per user, off-hours access spikes, impossible travel, repeated exports, repeated failed logins
2. WHEN anomalies are detected, THE Clinical_System SHALL alert on-call/security with severity, context, and correlation ids
3. WHEN repeated failures occur, THE Clinical_System SHALL lock accounts with admin alerting
4. THE Clinical_System SHALL generate daily access reports for PHI access summaries (user counts, patient counts, exports)
5. WHEN incidents occur, THE Clinical_System SHALL preserve logs and evidence and track containment actions

### Requirement 6: Data Minimization, Masking, Purpose Limitation

**User Story:** As privacy owner, I need configurable minimum-necessary PHI exposure per role and context.

#### Acceptance Criteria

1. THE Clinical_System SHALL enforce data minimization with required fields only; optional fields explicitly justified
2. THE Clinical_System SHALL enforce "minimum necessary" views per role and context with configurable granularity
3. THE Clinical_System SHALL mask/redact sensitive fields by default with logged reveal operations requiring permission
4. WHEN exporting/printing/sharing, THE Clinical_System SHALL apply role-gating with optional watermarking and mandatory logging
5. THE Clinical_System SHALL display inline purpose statements wherever PHI is captured or shared

### Requirement 7: Third-Party / BAA Controls

**User Story:** As legal/compliance, I need configurable vendor controls with BAA requirements when in strict HIPAA mode.

#### Acceptance Criteria

1. WHEN regulatory mode is hipaa_strict, THE Clinical_System SHALL require active BAAs before PHI handling
2. THE Clinical_System SHALL maintain a vendor inventory with data types shared and integration endpoints
3. THE Clinical_System SHALL log vendor access with least-privilege enforcement and periodic review
4. WHEN non-compliant vendors are detected, THE Clinical_System SHALL block PHI flows and create incident tickets
5. THE Clinical_System SHALL support domain allowlists for external drive exports when policy requires

### Requirement 8: Financial Controls (SOX-inspired)

**User Story:** As finance controller, I need configurable integrity controls for CPT/charge workflows with segregation of duties.

#### Acceptance Criteria

1. THE Clinical_System SHALL support configurable dual approval (maker-checker) for financial changes above thresholds
2. WHEN billing mappings change, THE Clinical_System SHALL create versioned, immutable audit records with effective dates
3. THE Clinical_System SHALL enforce segregation of duties between clinical documentation, billing code assignment, and approval
4. THE Clinical_System SHALL perform automated reconciliation (totals, missing codes, overrides) with logged results
5. WHEN financial reports are exported, THE Clinical_System SHALL version, track sign-offs, and maintain retrievability

### Requirement 9: Breach Notification & Regulatory Reporting

**User Story:** As compliance, I need timely breach reporting support with consistent evidence.

#### Acceptance Criteria

1. WHEN breach events are confirmed, THE Clinical_System SHALL generate a case record with timeline and affected scope
2. THE Clinical_System SHALL provide reporting packs including: incident summary, affected PHI categories, user/actions, containment steps, and evidence links
3. THE Clinical_System SHALL provide notification templates with deadline tracking supporting the 60-day requirement
4. THE Clinical_System SHALL retain all incident artifacts for 6 years

### Requirement 10: Adaptive + Multimodal UX

**User Story:** As a clinician using any device, I need the UI to adapt to screen size/input mode without hiding critical information.

#### Acceptance Criteria

1. THE Clinical_System SHALL be responsive with breakpoints for phone/tablet/desktop and support portrait/landscape
2. THE Clinical_System SHALL detect primary input mode (touch vs mouse/keyboard) and adjust hit targets, hover interactions, and focus states
3. WHEN content overflows, THE Clinical_System SHALL use layout rules (flex/grid) and scrollable regions, never clipped off-screen
4. THE Clinical_System SHALL support clinical "rounding list" and "patient detail" views with: compact mode on phone (stacked cards, bottom sheet actions), split-pane on tablet/desktop (list + detail), keyboard navigation and accessible focus order
5. THE Clinical_System SHALL support multimodal capture: camera/photo upload for documents/images (where policy allows), dictation/voice input (optional, off by default; PHI handling rules apply), attachment preview with safe rendering
6. THE Clinical_System SHALL provide "safe display" toggles: quick-hide PHI, screen privacy mode, and automatic lock on inactivity aligned to session timeout