# Section 3: System Overview

This section describes how JUNO is structured and why the system is decomposed into its current modules. It focuses on architecture, design models, data design, and the domain model, with implementation-aligned detail suitable for technical documentation and evaluation.

## 3.1 Architectural Design

JUNO is implemented as a role-aware, multi-module platform on top of Next.js App Router. The system combines:

- role-scoped application surfaces (Vendor, Supplier, Admin),
- workflow APIs for collaboration and commerce synchronization,
- AI orchestration for storefront/email support,
- operational observability for governance.

The architecture favors a layered, service-oriented style inside one deployable application boundary, rather than fragmented microservices. This keeps coordination cost low while preserving module boundaries in code and data models.

### 3.1.1 High-Level Box and Line View

```mermaid
flowchart LR
  vendorUI[VendorPortalUI] --> appApi[ApplicationAPILayer]
  supplierUI[SupplierPortalUI] --> appApi
  adminUI[AdminObservabilityUI] --> appApi
  storefrontWidget[StorefrontWidget] --> appApi
  gmailWebhook[GmailWebhook] --> appApi
  shopifyWebhook[ShopifyWebhook] --> appApi

  appApi --> domainServices[DomainServiceLayer]
  domainServices --> aiLayer[AIOrchestrationLayer]
  domainServices --> integrations[IntegrationAdapters]
  domainServices --> dataLayer[DataAccessLayer]

  integrations --> shopifyApi[ShopifyAPIs]
  integrations --> gmailApi[GmailAPIs]
  aiLayer --> llmProviders[LLMProvidersOpenAIGroq]
  dataLayer --> postgres[(PostgreSQLPrisma)]
```

### 3.1.2 Layered Architecture Mapping

```mermaid
flowchart TD
  subgraph presentation [Presentation Layer]
    p1[Vendor Dashboard]
    p2[Supplier Portal]
    p3[Admin Pages]
    p4[Storefront Chat Widget]
  end

  subgraph application [Application Layer]
    a1[Route Handlers /api/*]
    a2[Auth Role Guards]
    a3[Validation Schemas]
  end

  subgraph domain [Domain and Workflow Layer]
    d1[Collaboration Workflows]
    d2[Commerce Sync Workflows]
    d3[AI Helpdesk Workflows]
    d4[Notification and Ticket Logic]
  end

  subgraph infrastructure [Infrastructure Layer]
    i1[Prisma Data Access]
    i2[Webhook Verification]
    i3[Provider Clients]
    i4[Encryption and Rate Limits]
  end

  subgraph external [External Systems]
    e1[Shopify]
    e2[Gmail]
    e3[OpenAI and Groq]
  end

  presentation --> application
  application --> domain
  domain --> infrastructure
  infrastructure --> external
  infrastructure --> db[(PostgreSQL)]
```

### 3.1.3 Major Module Responsibilities

| Module | Primary Responsibilities | Core Artifacts |
| --- | --- | --- |
| Identity and Access | Authentication, role checks, portal/session alignment, MFA-aware flows | Auth handlers, role guards, user/session models |
| Vendor-Supplier Collaboration | Connection lifecycle, product sync requests, supplier offers, event notifications | `Connection`, `ProductSync`, `SupplierProductOffer`, notifications |
| Commerce Synchronization | Shopify webhook verification, cache updates, sync metadata, low-stock signals | `CachedProduct`, `CachedOrder`, `CachedCustomer`, `SyncMetadata` |
| AI Helpdesk and Automation | Storefront AI responses, Gmail ingestion/auto-reply, escalation and ticket routing | Storefront chat flows, email processor, flagged email and ticket logs |
| Admin Observability | Cross-module event aggregation and health monitoring | Admin event/sync APIs and monitoring pages |

### 3.1.4 Architecture Design Rationale

- **Single deployable with clear module boundaries:** easier release management while preserving separation of concerns.
- **Data-centric workflow design:** collaboration and support are linked through shared store-scoped entities.
- **Role-gated API access:** business-critical operations are protected by actor-specific authorization behavior.
- **Fail-safe automation posture:** AI and webhook pipelines prioritize safety, idempotency, and operator takeover paths.

### 3.1.5 Visual References (Reused Assets)

The following existing assets are included as supplementary architecture references:

- ![Box and Line Reference](../../F25_054_D_JUNO_FINAL/images/boxandline.png)
- ![Architecture Pattern Reference](../../F25_054_D_JUNO_FINAL/images/Architecturepattern.png)

## 3.2 Design Models

JUNO combines object-oriented domain modeling with workflow/event-driven behavior. The following models represent key operational flows.

### 3.2.1 Activity Diagram: Vendor Product Sync Lifecycle

```mermaid
flowchart TD
  start[VendorSelectsSupplierProduct] --> submit[SubmitSyncRequest]
  submit --> validateConn{ConnectionStatusConnected}
  validateConn -->|No| rejectEarly[RejectRequestWithReason]
  validateConn -->|Yes| createPending[CreateOrReopenPendingSync]
  createPending --> notifySupplier[NotifySupplier]
  notifySupplier --> supplierDecision{SupplierDecision}
  supplierDecision -->|Accept| accept[SetStatusAcceptedAndPersistSnapshot]
  supplierDecision -->|Reject| reject[SetStatusRejected]
  accept --> notifyVendorA[NotifyVendor]
  reject --> notifyVendorR[NotifyVendor]
  notifyVendorA --> endNode[WorkflowComplete]
  notifyVendorR --> endNode
```

### 3.2.2 Sequence Diagram: Storefront Chat to Escalation

```mermaid
sequenceDiagram
  participant Customer
  participant Widget as StorefrontWidget
  participant API as ChatAPI
  participant AI as L1Orchestrator
  participant DB as Database
  participant Vendor as VendorOperator

  Customer->>Widget: Send message
  Widget->>API: POST chat message
  API->>DB: Persist customer message
  API->>AI: Generate response with context
  AI-->>API: Reply + metadata
  API->>DB: Persist AI message
  alt Escalation triggered
    API->>DB: Create/Update escalation ticket (EmailLog)
    API-->>Vendor: Ticket visible in vendor workflow
  end
  API-->>Widget: Return conversation messages
```

### 3.2.3 State Transition Diagram: Product Sync Entity

```mermaid
stateDiagram-v2
  [*] --> PENDING
  PENDING --> ACCEPTED: SupplierAccept
  PENDING --> REJECTED: SupplierReject
  REJECTED --> PENDING: VendorResubmit
  PENDING --> [*]: VendorDelete
  ACCEPTED --> [*]: AuthorizedDelete
  REJECTED --> [*]: AuthorizedDelete
```

### 3.2.4 Class-Oriented Domain Structure (Conceptual)

```mermaid
classDiagram
  class User {
    +id
    +email
    +role
    +mfaEnabled
  }
  class Store {
    +id
    +userId
    +shopifyDomain
    +storefrontChatEnabled
  }
  class SupplierProfile {
    +id
    +userId
    +companyName
  }
  class Connection {
    +id
    +storeId
    +supplierId
    +status
  }
  class ProductSync {
    +id
    +storeId
    +supplierId
    +shopifyProductId
    +status
  }
  class SupplierProductOffer {
    +id
    +productId
    +storeId
    +price
    +quantity
  }
  class EmailLog {
    +id
    +storeId
    +trigger
    +status
  }

  User "1" --> "many" Store : owns
  User "1" --> "0..1" SupplierProfile : has
  Store "1" --> "many" Connection : links
  SupplierProfile "1" --> "many" Connection : links
  Store "1" --> "many" ProductSync : tracks
  SupplierProfile "1" --> "many" ProductSync : processes
  Store "1" --> "many" SupplierProductOffer : receives
  Store "1" --> "many" EmailLog : records
```

### 3.2.5 Data Flow View (Level 0)

```mermaid
flowchart LR
  customer[Customer] --> p1[StorefrontSupportProcess]
  vendor[Vendor] --> p2[VendorCollaborationProcess]
  supplier[Supplier] --> p3[SupplierDecisionProcess]
  admin[Admin] --> p4[ObservabilityProcess]

  p1 --> d1[(ChatAndEmailRecords)]
  p2 --> d2[(CollaborationRecords)]
  p3 --> d2
  p2 --> d3[(CommerceCacheAndSync)]
  p4 --> d4[(OperationalEvents)]

  shopify[Shopify] --> p2
  shopify --> p3
  gmail[Gmail] --> p1
  llm[AIProviders] --> p1
```

## 3.3 Data Design

JUNO transforms business interactions into store-scoped, role-aware persistent entities. The data model is implemented in PostgreSQL via Prisma and combines relational integrity with selected JSON flexibility for evolving AI/context attributes.

### 3.3.1 Data Storage Strategy

| Storage Item | Type | Purpose |
| --- | --- | --- |
| PostgreSQL relational tables | Structured transactional data | Users, stores, supplier connections, sync records, offers, notifications, logs |
| JSON columns (selected entities) | Semi-structured contextual data | Shopify payload snapshots, module policies, shared field answers, message metadata |
| Vector column (`pgvector`) | Embedding storage | Knowledge chunk retrieval for RAG-style responses |
| External provider state | Integration state | Gmail OAuth context, webhook events, Shopify synchronization inputs |

### 3.3.2 Core Data Entities and Processing Roles

| Entity Group | Operational Role |
| --- | --- |
| Identity entities (`User`, `Session`, `Account`) | Access control, role identity, authentication continuity |
| Store and collaboration entities (`Store`, `Connection`, `Invitation`) | Tenant boundary, supplier relationship governance |
| Product workflow entities (`ProductSync`, `SupplierProductOffer`) | Vendor-supplier product alignment and offer management |
| Commerce cache entities (`CachedProduct`, `CachedOrder`, `CachedCustomer`, `SyncMetadata`) | Fast query paths and synchronization observability |
| AI/helpdesk entities (`StorefrontChatConversation`, `StorefrontChatMessage`, `EmailLog`, `FlaggedEmail`) | Support automation, escalation, and communication traceability |
| Knowledge entities (`KnowledgeDocument`, `FaqItem`, `KnowledgeChunk`) | Retrieval corpus for AI-assisted answer generation |

### 3.3.3 Data Integrity and Consistency Design

- **Scoped uniqueness constraints** prevent duplicate collaboration records (for example, product sync uniqueness per store-supplier-product combination).
- **Indexing strategy** favors high-frequency filters such as `storeId`, status fields, and time-ordered event retrieval.
- **Upsert patterns** are used in synchronization metadata paths to avoid race-prone duplicate state rows.
- **Idempotent safeguards** are used in email automation paths to reduce duplicate outbound response side effects.

### 3.3.4 Security and Sensitive Data Handling

- Role-based boundaries are enforced before store-scoped data access operations.
- Sensitive credentials/tokens are kept out of client-visible payload surfaces.
- Security-relevant and operationally significant actions are persisted in logs for auditability.
- Public-facing chat endpoints apply rate controls to protect system stability and abuse posture.

### 3.3.5 Data Lifecycle (Simplified)

```mermaid
flowchart TD
  ingest[ExternalOrUserEventIngest] --> validate[ValidateAndAuthorize]
  validate --> persist[PersistOrUpdateStoreScopedRecords]
  persist --> enrich[EnrichWithDerivedMetadata]
  enrich --> notify[EmitNotificationsOrEscalations]
  notify --> observe[ExposeToAdminObservability]
  observe --> archive[RetainForAuditWindow]
```

## 3.4 Domain Model

The JUNO domain model represents operational relationships between merchants, suppliers, support automation, and observability workflows.

### 3.4.1 Domain Entity Perspective

- **Actor entities:** `User` (role-bearing identity), `SupplierProfile` (supplier-specific business identity), external customer interactions via support channels.
- **Business context entities:** `Store` as tenant boundary and operational anchor.
- **Collaboration entities:** `Connection`, `Invitation`, `ProductSync`, `SupplierProductOffer`.
- **Operational data entities:** cached commerce resources and sync metadata.
- **Support and AI entities:** storefront conversation/message records, email logs, flagged emails, knowledge artifacts.

### 3.4.2 Conceptual Domain ER Diagram

```mermaid
erDiagram
  User ||--o{ Store : owns
  User ||--o| SupplierProfile : has
  Store ||--o{ Connection : has
  SupplierProfile ||--o{ Connection : participates
  Store ||--o{ ProductSync : contains
  SupplierProfile ||--o{ ProductSync : reviews
  Store ||--o{ SupplierProductOffer : receives
  SupplierProfile ||--o{ SupplierProductOffer : provides
  Store ||--o{ CachedProduct : caches
  Store ||--o{ CachedOrder : caches
  Store ||--o{ CachedCustomer : caches
  Store ||--o{ SyncMetadata : monitors
  Store ||--o{ StorefrontChatConversation : hosts
  StorefrontChatConversation ||--o{ StorefrontChatMessage : contains
  Store ||--o{ EmailLog : records
  Store ||--o{ FlaggedEmail : flags
  Store ||--o{ KnowledgeDocument : stores
  Store ||--o{ FaqItem : stores
  Store ||--o{ KnowledgeChunk : indexes
```

### 3.4.3 Domain Constraints and Associations

- A `Store` belongs to exactly one owning `User`, while one user can operate multiple stores.
- A `SupplierProfile` is bound to one supplier user identity and can connect to many stores through `Connection`.
- `ProductSync` and `SupplierProductOffer` provide two complementary collaboration mechanisms:
  - vendor-requested sync workflow,
  - supplier-initiated offer workflow.
- Support automation is modeled as event-bearing records rather than opaque chat history, enabling governance and analytics.

### 3.4.4 Domain Model Reference Asset

Supplementary conceptual reference from provided assets:

- ![Domain Model Reference](../../F25_054_D_JUNO_FINAL/images/domainmodel.png)

## 3.5 Chapter Summary

Section 3 establishes JUNO as a layered, role-aware workflow platform with a strong data-centric collaboration model. The design models and domain structure align with implemented modules and provide a clear bridge to implementation/testing chapters.
