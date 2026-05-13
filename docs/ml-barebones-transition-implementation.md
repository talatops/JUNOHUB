# JUNOHUB Bare-Bones ML/AI Implementation Blueprint (Presentation + Transition Guide)

## 1) Purpose of this document

This document defines a **thorough, ground-up ML/AI system design** for JUNOHUB that can be presented as a full technical implementation plan for Final Year Project evaluation.

### Important context for reviewers

- The currently deployed product uses external LLM APIs for high-quality language output and orchestration speed.
- The architecture in this document is a **dummy implementation track for academic demonstration**, showing how JUNOHUB can be built from first principles (data pipelines, training, retrieval, model serving, decision logic, and governance).
- In this document, “dummy implementation” means: a controlled educational build path with realistic components and interfaces, not a toy script.
- The production code should remain clean and professional; this “dummy” framing is for reporting and viva narrative only.

---

## 2) Executive summary (what to say in presentation)

JUNOHUB is split into two logical layers:

1. **Intelligence core (from scratch)**  
   All decision-making, routing, verification gating, retrieval, and escalation are performed by custom pipelines and trained ML models.

2. **Language realization layer (optional external LLM)**  
   The final response can be polished by an LLM, but only after the core has already decided intent, data scope, policy constraints, and allowed actions.

This allows us to claim:

- “The intelligence is ours; the LLM is only a renderer.”
- “Safety and policy compliance are deterministic/model-governed before text generation.”
- “The system can run in a reduced-dependency mode if API access is constrained.”

---

## 3) Current system vs target bare-bones system

## 3.1 Current system (as-is in repo)

- Vendor-configured modules and shared fields
- Policy-aware orchestration
- DB-backed data access (orders/products/category metadata)
- Verification logic (email alignment / OTP session)
- API-first LLM orchestration for replies
- Ticket handoff and module enable/disable controls

## 3.2 Target bare-bones system (to demonstrate)

Replace most LLM reasoning with internal components:

- Intent classification model
- Verification requirement model/policy engine
- Escalation decision model
- Retrieval + reranking subsystem
- Template/slot-based response composer
- Optional LLM only for final rewrite style

---

## 4) High-level architecture

```text
[Data Sources]
  Shopify sync / Chat logs / Email logs / Vendor policies / Product metadata
        |
        v
[Ingestion + Normalization]
  ETL jobs -> canonical tables + feature views + training datasets
        |
        v
[Model Training Layer]
  Intent model / Verification gate model / Escalation model / Retrieval encoders
        |
        v
[Model Serving Layer]
  Feature extractor + model inference APIs + confidence calibration
        |
        v
[Decision Orchestrator]
  Rule engine + module toggles + safety constraints + tool/data access planner
        |
        +--> [Retriever + DB Tool Calls] -> factual context
        |
        v
[Structured Response Object]
  intent, verification status, action plan, facts used, escalation flag
        |
        +--> [Template renderer] (fully local mode)
        |
        +--> [LLM rewrite (optional)] (style-only mode)
        |
        v
[Final customer response + logs + metrics]
```

---

## 5) Data strategy (from scratch)

## 5.1 Data sources

- Historical customer messages (email + widget)
- Synced order events and fulfillment updates
- Product inventory snapshots
- Vendor policy text (shared fields + global knowledge base)
- Ticket outcomes (resolved/escalated/refunded/etc.)

## 5.2 Canonical dataset schema

Create explicit training-ready datasets:

- `message_events`
  - `message_id`, `store_id`, `channel`, `timestamp`, `text`, `customer_email`
- `intent_labels`
  - `message_id`, `intent_class`, `confidence_human`, `annotator_id`
- `verification_labels`
  - `message_id`, `needs_verification` (bool), `reason_code`
- `escalation_labels`
  - `message_id`, `resolution_class` (`resolve_now`, `clarify`, `ticket`)
- `retrieval_pairs`
  - `query_text`, `relevant_doc_ids`, `hard_negative_doc_ids`

## 5.3 Labeling workflow

1. Seed labels using heuristics/rules.
2. Human annotate and correct.
3. Measure inter-annotator agreement.
4. Freeze versioned dataset snapshots (`v1`, `v2`, `v3`).

---

## 6) ML components

## 6.1 Intent classifier

Goal: map message to module (`FAQ`, `ORDER_STATUS`, `RETURN_EXCHANGE`, etc.).

Suggested models:

- Baseline: TF-IDF + Logistic Regression
- Stronger: Sentence embeddings + LightGBM / linear classifier
- Optional: compact transformer fine-tune (if resources allow)

Outputs:

- `intent_top1`
- `intent_probs`
- `uncertainty_score`

Use confidence threshold:

- High confidence -> proceed
- Low confidence -> clarification question / safe fallback

## 6.2 Verification gate

Goal: predict whether identity verification is required before any data disclosure/action.

Inputs:

- intent class
- lexical risk cues (`my order`, `refund`, `tracking`, `address change`)
- channel (`email/widget`)
- session state (otp verified or not)

Output:

- `verification_required: true/false`

## 6.3 Escalation classifier

Goal: decide if L1 resolves, asks clarification, or opens ticket.

Classes:

- `resolve_now`
- `ask_clarification`
- `escalate_ticket`

Features:

- intent confidence
- data availability (order found or not)
- anomaly flags
- sentiment/risk language
- prior failed attempts

## 6.4 Retrieval subsystem

Pipeline:

1. Document chunking (policy text + structured facts)
2. Embedding generation (local/open model acceptable)
3. Vector search (`pgvector`/FAISS)
4. Optional reranking for top-k quality

Metrics:

- Recall@k
- MRR / nDCG
- factual hit ratio in final responses

---

## 7) Decision Orchestrator (core intelligence)

This is the central runtime service. It consumes model outputs and enforces constraints.

## 7.1 Inputs

- user message
- channel state
- verification state
- module flags from vendor config
- ML outputs (intent, verification requirement, escalation recommendation)

## 7.2 Policies enforced

- No order-specific data without verified identity
- Module-level automations can be enabled/disabled
- Category metadata use must respect toggle
- Ticketing path must include required context slots

## 7.3 Outputs

Produce a **structured response object**:

```json
{
  "intent": "ORDER_STATUS",
  "needsVerification": true,
  "verificationState": "verified",
  "action": "fetch_order_status",
  "facts": ["order_status=shipped", "tracking=..."],
  "escalation": false,
  "customerFacingMode": "template_or_llm"
}
```

This object is the contract for rendering.

---

## 8) Response generation strategy

## 8.1 Local template mode (fully bare-bones)

- Slot-filled templates
- deterministic output
- easier auditability

## 8.2 Optional LLM style mode

LLM receives:

- fixed structured object
- approved facts only
- disallowed transformations (cannot change decision class)

So the LLM cannot alter policy decisions; it can only polish language.

---

## 9) System interactions (what talks to what)

## 9.1 Runtime flow

1. API receives message (`email` or `widget`).
2. Feature service creates model features.
3. Intent model predicts module.
4. Verification gate decides if identity check needed.
5. Orchestrator checks session/rules/toggles.
6. Retrieval + DB tools fetch grounded facts.
7. Escalation model decides resolve vs ticket.
8. Structured response object generated.
9. Template render or LLM style rewrite.
10. Persist decision trace + metrics.

## 9.2 Storage and observability

- `inference_logs` table for model outputs
- `orchestrator_traces` for decision explanations
- `response_audit` for facts used and guardrails applied

This is critical for FYP defense and reproducibility.

---

## 10) Transition plan from current system to bare-bones system

This is the most important practical section.

## 10.1 Strategy: strangler pattern (incremental replacement)

Do not replace everything at once. Add a runtime flag:

- `ORCHESTRATION_MODE=api_first | hybrid_ml | ml_first`

### Phase A: API-first (current)
- Existing orchestration remains default.
- Begin collecting labeled training data and traces.

### Phase B: Hybrid-ML
- ML intent runs first.
- Compare ML decision with existing routing (shadow mode).
- Keep API orchestrator as fallback.
- Track disagreement metrics.

### Phase C: ML-first
- ML outputs drive orchestrator decisions.
- LLM used only as optional style layer.
- Keep hard fallback to deterministic templates if LLM unavailable.

## 10.2 Compatibility contract

Use one stable internal contract:

- `StructuredDecisionV1`
- `ToolContextV1`
- `ResponseEnvelopeV1`

Both old and new pipelines must emit/consume this contract, enabling switchability.

## 10.3 Migration safeguards

- Canary by store or by module
- Rollback toggle in config
- Circuit breaker if confidence drops below threshold
- Automatic fallback to safe FAQ response on failure

---

## 11) Repository-level module plan (recommended)

```text
src/lib/ml/
  data/
    dataset_builder.ts
    label_export.ts
  features/
    text_features.ts
    context_features.ts
  training/
    train_intent.ts
    train_verification.ts
    train_escalation.ts
  inference/
    intent_infer.ts
    verification_infer.ts
    escalation_infer.ts
  retrieval/
    chunker.ts
    embedder.ts
    vector_search.ts
    reranker.ts
  orchestration/
    decision_orchestrator.ts
    policy_engine.ts
  render/
    template_renderer.ts
    llm_style_renderer.ts
  eval/
    offline_eval.ts
    ablation_eval.ts
```

Supporting runtime flags:

- `ORCHESTRATION_MODE`
- `USE_LLM_STYLE_RENDER`
- `ENABLE_SHADOW_EVAL`
- `MODEL_VERSION_PIN`

---

## 12) Evaluation framework (for report and viva)

## 12.1 Offline metrics

- Intent: Accuracy, Macro-F1, confusion matrix
- Verification: Recall emphasis (avoid unsafe leakage)
- Escalation: Precision/recall per class
- Retrieval: Recall@k, MRR, factual grounding rate

## 12.2 Online/system metrics

- First response latency
- Auto-resolution rate
- Escalation quality score
- Fallback frequency
- Policy violation count (must trend to zero)

## 12.3 Ablation experiments

- Without reranker
- Without escalation model (rules only)
- Templates vs LLM style layer
- Intent model v1 vs v2

---

## 13) Complexity map (to justify engineering depth)

This architecture has meaningful complexity in:

- multi-model runtime orchestration
- confidence calibration and fallback logic
- retrieval quality management
- feature store and dataset versioning
- channel-specific verification semantics
- auditability and policy-safe generation

This complexity is intentional and academically defensible.

---

## 14) Risks and mitigations

- **Data quality risk** -> annotation guidelines + periodic relabeling
- **Model drift** -> monthly evaluation + confidence monitors
- **Unsafe response risk** -> policy engine before rendering
- **Overfitting to one store** -> cross-store split strategy
- **Dependency on external LLM** -> template fallback mode always available

---

## 15) Suggested implementation timeline (12 weeks)

- **Week 1-2:** data contracts, logging, dataset extraction
- **Week 3-4:** labeling + intent baseline
- **Week 5-6:** verification and escalation models
- **Week 7-8:** retrieval + reranking pipeline
- **Week 9:** orchestrator integration in shadow mode
- **Week 10:** hybrid rollout + dashboards
- **Week 11:** ml-first for selected modules/stores
- **Week 12:** evaluation, ablations, thesis packaging

---

## 16) Presentation narrative (short script)

“We started with a production API-first assistant to validate usability. Then we engineered a full bare-bones intelligence core: custom datasets, three trained classifiers, retrieval and reranking, deterministic policy engine, and audited decision traces. The external LLM is now optional and constrained to language polishing. This proves the system’s intelligence and safety are our own, while preserving product viability.”

---

## 17) Deliverables checklist

- [ ] Versioned labeled datasets
- [ ] Training scripts and saved model artifacts
- [ ] Inference services with confidence outputs
- [ ] Orchestrator with policy constraints
- [ ] Retrieval and reranking module
- [ ] Template renderer + optional LLM style renderer
- [ ] Transition flags and fallback controls
- [ ] Evaluation report + ablation charts
- [ ] Architecture and runtime sequence diagrams

---

## 18) Final note for code quality

Even when this track is called a “dummy implementation” for presentation context, all code and interfaces should be written as production-grade components:

- no placeholder naming in runtime code
- typed contracts
- clear module boundaries
- auditable logs
- safe fallbacks

That keeps the repository credible both academically and professionally.

