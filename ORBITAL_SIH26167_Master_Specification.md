---
**ORBITAL Master Specification — SIH26167**
**Revision:** SIH-ready research + implementation specification
**Purpose:** Convert the 50-paper research analysis and 58-feature concept into a traceable, prioritized, evaluable implementation plan.
---

# ORBITAL — Agentic Multimodal Intelligence for Earth Observation

### Project Documentation for SIH26167 "SatQuery AI" (ISRO — Space Technology)

**A note on this document's basis:** Every paper cited below was individually retrieved and verified via live search (not recalled from memory or invented). It is 50 real, checkable papers spanning the six sub-domains SIH26167 actually spans — RS vision-language foundation models, RSVQA, change-detection VQA, SAR–optical fusion, agentic tool orchestration, and hallucination/trust in LVLMs. The gaps below are synthesized from what these papers *themselves* state as open problems, not asserted independently.

---

## 1. Problem Statement Recap

**SIH26167 — SatQuery AI:** An interactive vision-language assistant for multimodal remote-sensing image analysis via text queries, for ISRO. The mandatory system must support:

1. Single-image reasoning (captioning, VQA, grounding)
2. Bi-temporal / multitemporal change reasoning
3. Optical + SAR fusion reasoning
4. Agentic orchestration — a controller that selects and sequences specialist models per query
5. Domain-adapted models (the PS explicitly states a generic LLM/VLM will not satisfy requirements) using BigEarthNet-style adaptation and benchmarks (VRSBench, RSVQA, CDVQA)
6. Evaluation against a hidden ISRO/SAC dataset

## 1A. Executive Positioning, Novelty & USP

### One-line product definition

**ORBITAL is an agentic multimodal Earth-observation intelligence platform that converts natural-language questions into evidence-grounded analysis across optical, SAR, and temporal satellite imagery.**

### Core novelty

The novelty is **not** simply applying an LLM/VLM to satellite images. ORBITAL unifies capabilities that are typically treated as separate tasks:

- single-image VQA, captioning and grounding
- bi-temporal and N-temporal change reasoning
- optical + SAR cross-modal reasoning
- dynamic specialist-model selection
- uncertainty-aware answers and abstention
- visual evidence grounding
- hallucination detection
- auditable agent execution
- domain adaptation and unseen-domain evaluation

The central architectural novelty is a **query-driven orchestration layer** that decides *which specialist model(s) should run, in what order, with which modalities, and when verification is required*, instead of forcing every query through one monolithic model.

### USP

> **Ask one natural-language question about Earth-observation imagery; ORBITAL autonomously selects the right vision, change-analysis, grounding, and cross-sensor specialists, verifies their evidence, exposes uncertainty, and returns both an answer and the spatial/temporal evidence supporting it.**

### Why this is defensible

The literature survey identifies ten gaps (G1–G10), including fragmented single-task RS-VLMs, weak conversational/spatial reasoning, unresolved change grounding, decision ambiguity, siloed SAR-optical fusion, hallucination, domain-agnostic agent orchestration, domain shift, and the computational cost of full fine-tuning. These gaps are explicitly mapped to the feature architecture below.

### What ORBITAL is NOT

- Not a generic chatbot with an image-upload button.
- Not a single remote-sensing classifier.
- Not a fixed pipeline where every query invokes every model.
- Not a generic VLM used without remote-sensing adaptation.
- Not a black-box answer generator with no spatial evidence.


---

## 2. Literature Survey (50 Papers)

Grouped by sub-domain. Format: **Authors (Year) — Title — Venue.**

### 2.1 Remote-Sensing Vision-Language Foundation Models (12 papers)

| # Citation Key Finding Gap It Surfaces  |                                                                                                                |                                                                                                      |                                                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1                                       | Liu et al. (2024) — RemoteCLIP: A Vision-Language Foundation Model for Remote Sensing — *IEEE TGRS*            | CLIP-style contrastive pretraining adapted to RS imagery improves zero-shot retrieval/classification | Contrastive RS-CLIP models are strong at retrieval but not built for generative QA or reasoning |
| 2                                       | Zhang et al. (2024) — RS5M and GeoRSCLIP — *IEEE TGRS*                                                         | Large-scale RS image-text dataset + CLIP variant                                                     | Dataset scale ≠ instruction-following ability; no agentic use                                   |
| 3                                       | Kuckreja et al. (2024) — GeoChat: Grounded Large Vision-Language Model for Remote Sensing — *CVPR*             | First RS-grounded conversational VLM with region-level grounding                                     | Single-image only; no bi-temporal or SAR reasoning                                              |
| 4                                       | Zhan, Xiong & Yuan (2024) — SkyEyeGPT: Unifying RS Vision-Language Tasks via Instruction Tuning — *arXiv*      | Unifies captioning/VQA/grounding tasks under one instruction-tuned LLM                               | Still single-modality-at-a-time; no cross-sensor fusion                                         |
| 5                                       | Hu et al. (2023/2025) — RSGPT: A Remote Sensing Vision Language Model and Benchmark — *ISPRS J. Photogramm.*   | Domain fine-tuned VLM + benchmark for RS captioning/VQA                                              | Benchmarked only on curated data, not held-out agency data                                      |
| 6                                       | Pang et al. (2024) — VHM / H2RSVLM: Towards a Helpful and Honest RS LVLM — *arXiv*                             | Explicitly targets "honesty" (reduced hallucination) in RS VLMs                                      | Confirms hallucination is unresolved even in domain-tuned models                                |
| 7                                       | Muhtar et al. (2024) — LHRS-Bot: RS-LMM with VGI-enhanced Grounding — *ECCV*                                   | Uses volunteered geographic info to ground RS-LLM outputs                                            | Grounding source is external metadata, not fused sensor evidence                                |
| 8                                       | Li et al. (2024/2025) — LHRS-Bot-Nova — *ISPRS J. Photogramm. & Remote Sensing*                                | Improved multimodal RS-LLM interpretation                                                            | Still lacks bi-temporal change reasoning                                                        |
| 9                                       | Zhang et al. (2024) — EarthGPT: A Universal Multi-Modal LLM for Multi-Sensor Image Comprehension — *IEEE TGRS* | First to explicitly target multi-sensor (optical+SAR+infrared) comprehension in one LLM              | Multi-sensor fusion is early-stage; no query-driven agent controller                            |
| 10                                      | Li et al. (2024) — Vision-Language Models in RS: Current Progress and Future Trends — *IEEE GRSM* (survey)     | Surveys the field, flags fusion + agentic reasoning as open frontiers                                | Confirms orchestration + fusion are still open, not solved                                      |
| 11                                      | Zhou et al. (2024) — Towards Vision-Language Geo-Foundation Model: A Survey — *arXiv 2406.09385*               | Comprehensive taxonomy of RS-VLM tasks (VQA, grounding, referring segmentation)                      | Notes referring/grounding datasets are far smaller than captioning ones                         |
| 12                                      | Weng, Pang & Xia — Vision-Language Modeling Meets Remote Sensing: Models, Datasets, Perspectives — *survey*    | Cross-compares RS-VLM datasets and models                                                            | Identifies dataset fragmentation across tasks as a structural gap                               |

### 2.2 RS Visual Question Answering (7 papers)

| # Citation Key Finding Gap It Surfaces  |                                                                                                              |                                                                                                  |                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| 13                                      | Lobry, Marcos, Murray & Tuia (2020) — RSVQA: Visual Question Answering for Remote Sensing Data — *IEEE TGRS* | Founding RSVQA task + LR/HR datasets                                                             | Closed-vocabulary answers only; no open-ended reasoning                                |
| 14                                      | Lobry, Demir & Tuia (2021) — RSVQA Meets BigEarthNet — *IGARSS*                                              | Scales RSVQA onto BigEarthNet multi-label imagery                                                | Still template-generated Q&A, not natural user queries                                 |
| 15                                      | RSVLM-QA (2025) — Benchmark Dataset for RS VLM-based QA — *arXiv 2508.07918*                                 | Notes existing RSVQA datasets are annotation-poor and narrow in question typology                | Explicitly calls out lack of nuanced, structured spatial-relationship QA               |
| 16                                      | PERS — Parameter-Efficient Multi-modal Transfer Learning for RS VQA                                          | Lightweight adapters + cross-attention fusion beat full fine-tuning on RSVQA-LR/HR/xBEN          | Efficient fine-tuning under-used in agentic/production pipelines                       |
| 17                                      | RSAdapter Unified Framework — Adapting Dual/Hybrid/Encoder-Decoder Architectures — *arXiv 2606.19277*        | PEFT with <5% trainable params matches full fine-tuning on RSVQAx                                | Confirms full fine-tuning is computationally prohibitive — PEFT is the practical path  |
| 18                                      | Large VLMs for RSVQA — Domain-Adaptive Pretraining + Prompt Tuning — *arXiv 2411.10857*                      | Two-stage domain-adaptive pretraining + prompt fine-tuning beats generic LVLMs on RSVQAxBEN      | Validates PS's claim that a generic VLM alone underperforms                            |
| 19                                      | Text-Guided Coarse-to-Fine Fusion Network for Robust RS VQA — *arXiv 2411.15770*                             | Coarse-to-fine cross-modal fusion improves VQA robustness; reviews optical–SAR fusion literature | Most fusion work is task-specific (classification/segmentation), rarely wired into VQA |

### 2.3 Change Detection & Change-VQA (5 papers)

| # Citation Key Finding Gap It Surfaces  |                                                                                                           |                                                                                                          |                                                                                               |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 20                                      | Yuan, Mou, Xiong & Zhu (2022) — Change Detection Meets Visual Question Answering — *IEEE TGRS*            | Founding CDVQA task; Siamese cross-modal architecture; 122K QA pairs                                     | Outputs a class label, not spatial grounding or an explanation                                |
| 21                                      | Li et al. (2024) — Show Me What and Where has Changed? CDQAG / VisTA / QAG-360K — *arXiv 2410.23828*      | Extends CDVQA to jointly answer **and** visually ground the change (360K triplets)                       | Authors themselves state precise visual-answer grounding "persists as a formidable challenge" |
| 22                                      | DARFT (2025) — Improving Few-Shot CDVQA via Decision-Ambiguity-Guided RL Fine-Tuning — *arXiv 2512.24591* | Shows many CDVQA failures are **decision-ambiguous**, not clearly wrong — model is unsure, not incorrect | No production CDVQA system exposes this ambiguity/confidence to the end user                  |
| 23                                      | Revisiting Change VQA with Structured & Native Multimodal Qwen Models — *arXiv 2604.18429*                | Performance doesn't scale monotonically with model size on CDVQA                                         | Bigger backbone ≠ better change reasoning — architecture choice matters more                  |
| 24                                      | Liu et al. (2022) — RS Image Change Captioning with Dual-Branch Transformers — *IEEE TGRS*                | Free-form change captions instead of classification                                                      | Captioning lacks the interactivity/groundedness of a VQA+evidence system                      |

### 2.4 SAR–Optical Fusion (6 papers)

| # Citation Key Finding Gap It Surfaces  |                                                                                                          |                                                                                                  |                                                                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 25                                      | Deep Learning Meets SAR — survey — *arXiv 2006.10027*                                                    | Surveys SAR-optical co-registration, matching CNNs, and GAN-based fusion                         | Fusion is framed around image translation/cloud removal, not natural-language querying                             |
| 26                                      | Progressive Fusion Learning / MMFNet — Multimodal Joint Segmentation from Optical+SAR — *ScienceDirect*  | Extracts "modal invariants" to bridge the optical/SAR representation gap for building extraction | Fusion is segmentation-only; no confidence fusion or evidence trail for a user-facing answer                       |
| 27                                      | Building Detection in SAR Images via Fusion of Classic + Deep Features — *Int. J. Remote Sensing (2024)* | Statistical + texture + CNN feature fusion for SAR building detection                            | Single-task, single-sensor pipeline; not composable with an optical VLM                                            |
| 28                                      | U-Net for Building Detection from SAR + Optical Fusion (SpaceNet 6 challenge data)                       | U-Net fusion of Sentinel-1 SAR + Sentinel-2 optical for buildings                                | Small-scale, benchmark-only; not integrated into a query-answering system                                          |
| 29                                      | DehazeMamba — SAR-Guided Optical RS Image Dehazing with Adaptive State-Space Model — *arXiv 2503.13073*  | SAR used to recover cloud/haze-obscured optical detail                                           | Demonstrates SAR's complementary value beyond "verification" — as an enabler for otherwise-unusable optical frames |
| 30                                      | Detection of Building Outlines via Fusion of SAR and Optical Features — *ScienceDirect (classical)*      | Early feature-level/decision-level fusion pipeline for urban structures                          | Purely geometric fusion; no semantic/language layer at all                                                         |

### 2.5 Agentic / Multi-Tool Orchestration (9 papers)

| # Citation Key Finding Gap It Surfaces  |                                                                                                           |                                                                                                             |                                                                                       |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 31                                      | Shen et al. (2023) — HuggingGPT / JARVIS: Solving AI Tasks with ChatGPT and its Friends — *NeurIPS*       | LLM controller plans, selects specialist models from a model hub, executes, and fuses outputs               | Domain-agnostic; no notion of geospatial evidence or spatial grounding                |
| 32                                      | Yao et al. (2023) — ReAct: Synergizing Reasoning and Acting in LLMs                                       | Interleaves reasoning traces with actions/tool calls                                                        | General-purpose; not evaluated on multimodal/geospatial tool chains                   |
| 33                                      | Schick et al. (2023) — Toolformer: LMs Can Teach Themselves to Use Tools                                  | Self-supervised tool-use learning                                                                           | No mechanism for chaining vision-specialist outputs into a final grounded answer      |
| 34                                      | Patil et al. (2023) — Gorilla: LLM Connected with Massive APIs                                            | Accurate API/tool selection under realistic interfaces                                                      | Tool-selection accuracy studied in isolation from downstream evidence fusion          |
| 35                                      | Qin et al. (2023) — ToolBench / Tool Learning with Foundation Models                                      | Benchmarks planning, tool selection, calling, response generation                                           | Confirms tool-selection benchmarks rarely test multimodal, graph-structured pipelines |
| 36                                      | AutoTool (2026) — Dynamic Tool Selection and Integration for Agentic Reasoning — *arXiv 2512.13278*       | RL-trained dynamic tool selection generalizes to unseen tools                                               | Not tested in a domain with strict evidence/audit requirements like EO                |
| 37                                      | Liu et al. — Towards Robust Multi-Modal Reasoning via Model Selection — *arXiv 2310.08446*                | LLM-as-brain selecting among vision specialist models for multimodal tasks                                  | Selection studied generically; no remote-sensing specialist-model routing             |
| 38                                      | The Evolution of Tool Use in LLM Agents — survey — *arXiv 2603.22862*                                     | States long-horizon, graph-structured multi-tool orchestration is "less often treated as a primary problem" | Directly confirms orchestration-under-constraints is still an open research area      |
| 39                                      | One Supervisor, Many Modalities — Adaptive Tool Orchestration for Autonomous Queries — *arXiv 2603.11545* | Centralized orchestrator routing across text/vision/audio beats monolithic LLM and fixed decision trees     | Not evaluated on Earth-observation specialist models (change detection, SAR, VQA)     |

### 2.6 Hallucination, Trust & Confidence in RS-LVLMs (5 papers)

| # Citation Key Finding Gap It Surfaces  |                                                                                                                          |                                                                                                            |                                                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 40                                      | Li et al. (2025) — DDFAV / RSPOPE: RS LVLM Dataset & Hallucination Evaluation Benchmark — *Remote Sensing 17(4):719*     | Builds first RS-specific hallucination benchmark; shows mainstream LVLMs hallucinate heavily on RS imagery | Domain benchmarks for hallucination barely exist — most RS-VLM papers don't measure it at all                          |
| 41                                      | Cha et al. (2025) — Measuring & Mitigating Hallucinations in VL Dataset Generation for RS (fMoW-mm) — *arXiv 2501.14905* | LLM-generated captions for RS hallucinate; map data as external grounding reduces this                     | External structured data (e.g. GIS layers) can act as a hallucination check                                            |
| 42                                      | RSHallu (2026) — Dual-Mode Hallucination Evaluation for RS MLLMs with Domain-Tailored Mitigation — *arXiv 2602.10799*    | Proposes domain-specific mitigation, not generic LVLM hallucination fixes                                  | Generic hallucination-mitigation techniques transfer poorly to RS domain                                               |
| 43                                      | DHCP — Detecting Hallucinations via Cross-Modal Attention Pattern — *arXiv 2411.18659*                                   | Lightweight, training-free hallucination flag using attention patterns                                     | Not validated on satellite/aerial imagery specifically                                                                 |
| 44                                      | Visual Hallucination Detection via Evidential Conflict — *ScienceDirect (2025)*                                          | Feature-level conflict signals catch hallucinations current benchmarks miss, incl. reasoning-driven ones   | Confirms perception-only hallucination checks miss reasoning-stage hallucination — relevant to change-reasoning claims |

### 2.7 Foundation Models, Benchmarks & Domain Generalization (6 papers)

| # Citation Key Finding Gap It Surfaces  |                                                                                                                        |                                                                                                    |                                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 45                                      | Sumbul et al. (2019) — BigEarthNet: A Large-Scale Benchmark Archive for RS Image Understanding — *IGARSS*              | Canonical large multi-label Sentinel-1/2 benchmark, the PS's named adaptation dataset              | Europe-only coverage (\~600K samples) — generalization to unseen (e.g. Indian) geography is untested  |
| 46                                      | Clasen et al. (2025) — reBEN: Refined BigEarthNet Dataset — *IGARSS*                                                   | Cleans up label noise/geolocation errors in original BigEarthNet                                   | Even the reference dataset needed correction — raw adaptation data is imperfect                       |
| 47                                      | Li, Ding & Elhoseiny (2024) — VRSBench: A Versatile Vision-Language Benchmark for RS Image Understanding — *NeurIPS*   | One of the PS's named benchmarks; unifies captioning, VQA, and referring tasks                     | Still single-image; no bi-temporal or SAR track in VRSBench itself                                    |
| 48                                      | OmniEarth — A Benchmark for Evaluating VLMs in Geospatial Tasks — *arXiv*                                              | Broader geospatial benchmark beyond captioning/VQA                                                 | Evaluates VLMs generically; not agentic multi-tool pipelines                                          |
| 49                                      | CrossEarth — Geospatial Vision Foundation Model for Domain-Generalizable RS Semantic Segmentation — *arXiv 2410.22629* | Shows large accuracy drops (mIoU) for RS foundation models under unseen-domain/unseen-sensor shift | Directly predicts the exact risk ISRO's hidden-dataset evaluation is designed to test                 |
| 50                                      | Lacoste et al. (2023) — GEO-Bench: Toward Foundation Models for Earth Monitoring — *NeurIPS*                           | Standardized benchmark suite for evaluating EO foundation models across tasks                      | Benchmark suite still classification/segmentation-centric, no conversational/agentic evaluation track |

---

## 3. Consolidated Research Gaps

Ten gaps synthesized directly from the findings above — every feature in Section 4 traces back to at least one of these.

| Gap ID Gap Evidence  |                                                                                                                                                                                                            |             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **G1**               | Generic LLMs/VLMs fail on RS imagery without domain adaptation                                                                                                                                             | #1–12, #18  |
| **G2**               | RSVQA datasets/models are closed-vocabulary, template-based, and narrow in question typology — not conversational                                                                                          | #13–16      |
| **G3**               | Change detection tells you *that* something changed but not *where* precisely or *why* — grounding remains "a formidable challenge" per the authors themselves                                             | #20–21      |
| **G4**               | CDVQA failures are frequently **decision-ambiguous**, not wrong — but no system surfaces this uncertainty to a user                                                                                        | #22–23      |
| **G5**               | SAR–optical fusion research is siloed in classification/segmentation/building-detection; never wired into a query-answering or evidence pipeline                                                           | #25–30, #19 |
| **G6**               | Hallucination in RS-LVLMs is measured in only a handful of 2024–2026 papers and mitigation techniques don't transfer well from generic LVLMs                                                               | #40–44      |
| **G7**               | Multi-tool/agentic orchestration research (HuggingGPT-style) is domain-agnostic; no orchestrator has been built/evaluated for EO specialist-model routing                                                  | #31–39      |
| **G8**               | RS foundation models/benchmarks are single-image, single-task (classification *or* segmentation *or* VQA) — none unify all of single-image + bi-temporal + SAR fusion + grounding in one deployable system | #45–50      |
| **G9**               | Domain generalization is fragile: RS foundation models show sharp accuracy drops under unseen sensor/geography shift — exactly the ISRO/SAC hidden-dataset risk                                            | #49, #45    |
| **G10**              | Full fine-tuning of RS-VLMs is computationally prohibitive; PEFT/adapters are proven cheaper but under-used in end-to-end agentic systems                                                                  | #17, #16    |

---

## 4. Proposed System: ORBITAL — Feature List (58 Features)

Each feature is tagged with the gap(s) it addresses.

### 4.1 Core Single-Image Reasoning — addresses G1, G2

1. Free-form visual question answering over a single optical satellite/aerial image
2. Automatic scene-level captioning (land-use/land-cover summary)
3. Multi-label land-cover classification (BigEarthNet-style taxonomy)
4. Open-vocabulary object/region referring expression grounding (bounding box/polygon output)
5. Counting queries (e.g. "how many water bodies are visible")
6. Spatial relationship reasoning ("is the road north of the river")
7. Multi-resolution support (low-res LR and high-res HR imagery, per RSVQA convention)
8. Query intent classifier that routes a question to the correct specialist model before execution

### 4.2 Bi-Temporal / Change Understanding — addresses G3, G4

9. Bi-temporal image ingestion and automatic co-registration check
10. Binary change/no-change classification per land-cover class
11. "What changed" free-text change captioning
12. "Where changed" — pixel/region-level change grounding (mask output), not just a text answer
13. Percentage-change quantification per land-cover class (e.g. "+17.4% built-up")
14. Decision-ambiguity flagging — when the model's top-2 answers are close in confidence, say so explicitly instead of guessing
15. Change-type attribution (urbanization, deforestation, water-body shrinkage, disaster damage)
16. Multi-date support beyond two dates (N-temporal trend queries, not just bi-temporal)
17. Change severity scoring for disaster-response prioritization

### 4.3 Optical + SAR Fusion — addresses G5

18. SAR image ingestion (Sentinel-1 style, VV/VH polarization support)
19. Optical–SAR co-registration and geometric alignment pipeline
20. Cross-modal feature fusion module (adapting MMFNet-style modal-invariant fusion) for joint reasoning
21. SAR-based structural verification of optical-derived claims ("confirm this is a building, not vegetation")
22. SAR-guided cloud/haze recovery so optical analysis remains possible under cloud cover (DehazeMamba-style)
23. Joint confidence scoring that combines optical and SAR evidence into one number

### 4.4 Agentic Query Orchestration — addresses G7

24. LLM-based controller/planner that decomposes a natural-language query into sub-tasks
25. Dynamic specialist-model selection (VQA / change / fusion / grounding) based on query + available modalities
26. Sequential and parallel task execution graph (not a fixed linear pipeline)
27. Tool/model registry with capability metadata so the controller knows what each specialist can do
28. Fallback and retry logic when a specialist model returns low confidence or fails
29. Multi-turn conversational memory so follow-up queries ("now verify with SAR") reuse prior context
30. Query re-planning when a user's follow-up requires a different modality than the first answer used
31. Execution trace logging for every tool call made per query

### 4.5 Confidence, Evidence & Explainability — addresses G4, G6

32. Per-answer confidence score, not just a raw prediction
33. Visual evidence overlay showing which pixels/regions the answer is grounded in
34. Cross-modal evidence chain display (which of optical/SAR/temporal contributed to the final answer)
35. Hallucination flagging using attention-pattern or evidential-conflict signals before returning an answer
36. "I'm not sure" abstention mode when confidence falls below a threshold, instead of forcing an answer
37. Audit trail export (JSON/PDF) of the full reasoning chain for a query, for ISRO reviewer verification
38. Benchmark self-report — showing which validated benchmark (RSVQA/CDVQA/VRSBench) a given capability was measured against

### 4.6 Domain Adaptation & Model Efficiency — addresses G1, G9, G10

39. PEFT/LoRA-based adapter fine-tuning per specialist model instead of full fine-tuning (RSAdapter/PERS-style)
40. Domain-adaptive pretraining stage on BigEarthNet before task-specific fine-tuning
41. Continual-adaptation pipeline so new sensor data (e.g. from ISRO/SAC's own satellites) can be incorporated without full retraining
42. Held-out/unseen-domain evaluation harness that simulates the hidden ISRO/SAC test set before final submission
43. Modular specialist-model versioning so a weak specialist can be swapped without retraining the whole system
44. Lightweight inference mode for lower-resource deployment (quantized adapters)

### 4.7 Geospatial Change Graph / Digital Twin — extension beyond literature, addresses G3 + G8

45. Location-indexed change graph storing detected changes over time per land-cover category
46. Conversational drill-down ("why did built-up area increase") that queries the change graph plus grounding evidence
47. Timeline view of a location across all available image dates, not just two
48. Change graph export as GeoJSON for use in external GIS tools

### 4.8 Data & Ingestion Pipeline — supports all gaps operationally

49. GeoTIFF ingestion with CRS/projection normalization
50. Automatic tiling for large scenes exceeding model input size, with result stitching
51. Metadata extraction (sensor, acquisition date, resolution, polarization) surfaced to the controller for routing decisions
52. Support for public benchmark formats (RSVQA, CDVQA, VRSBench) for reproducible internal evaluation

### 4.9 Platform, UX & Deployment — engineering layer

53. Web UI for image upload, query input, and evidence-overlay visualization
54. REST/GraphQL API so ISRO/SAC systems can call ORBITAL programmatically
55. Role-based access control for sensitive imagery
56. Batch query mode for processing many locations/dates in one run
57. Model/version dashboard showing which specialist model versions are currently active
58. Automated evaluation dashboard tracking accuracy against RSVQA/CDVQA/VRSBench/hidden test splits over time

---


## 4A. Feature Prioritization & Implementation Tiers

The 58 features are intentionally split into implementation tiers so the team can build a reliable SIH core first and then layer the research-grade differentiators on top.

| Tier | Meaning | Recommended scope |
|---|---|---|
| **P0 — Mandatory** | Directly required to demonstrate the PS's central workflow | Single-image reasoning, temporal reasoning, optical/SAR ingestion, agent routing, domain adaptation, evidence output |
| **P1 — Competitive** | Strong differentiators that make the system materially better than a baseline | grounding, co-registration checks, dynamic routing, confidence, change masks, cross-modal verification |
| **P2 — God-Tier** | Research-grade features designed to create the strongest technical differentiation | hallucination detection, abstention, adaptive re-planning, N-temporal reasoning, change graph, continual adaptation |
| **P3 — Experimental** | High-risk extensions that should only be attempted after P0–P2 are stable | advanced fusion/recovery, aggressive model compression, broader deployment integrations |

### P0 — Must work end-to-end

1. Single-image VQA
2. Scene captioning
3. Land-cover classification
4. Grounding
5. Bi-temporal ingestion
6. Change detection
7. Change grounding
8. Optical + SAR ingestion
9. Co-registration
10. Query intent classification
11. Specialist routing
12. Agent execution
13. Confidence reporting
14. Evidence overlay
15. GeoTIFF ingestion
16. Benchmark evaluation

### P1 — Competitive differentiators

- N-temporal analysis
- change-type attribution
- change severity
- cross-modal structural verification
- sequential + parallel execution
- tool/model registry
- fallback/retry
- conversational memory
- query re-planning
- audit traces
- model versioning
- quantized inference

### P2 — God-Tier research layer

- hallucination detection
- explicit abstention
- cross-modal evidence chains
- decision-ambiguity detection
- location-indexed change graph
- conversational change-graph drill-down
- timeline intelligence
- GeoJSON evidence export
- continual adaptation
- unseen-domain evaluation
- benchmark self-reporting

### P3 — Experimental / stretch

- SAR-guided optical recovery
- advanced cross-attention fusion variants
- aggressive lightweight deployment
- large-scale batch processing
- production API integrations beyond the SIH demonstration



## 4B. SIH Requirement → Architecture → Feature → Metric Traceability

| SIH capability | ORBITAL component | Feature range | Primary evaluation |
|---|---|---|---|
| Single-image analysis | Single-Image Reasoning Engine | 1–8 | VQA accuracy, caption quality, grounding IoU |
| Bi-temporal reasoning | Change Understanding Engine | 9–17 | change F1/IoU, caption quality, temporal consistency |
| Optical + SAR reasoning | Cross-Modal Fusion Engine | 18–23 | fusion accuracy, structural verification precision, confidence calibration |
| Agentic orchestration | Query Controller + Tool Registry | 24–31 | specialist-selection accuracy, task completion, tool-call efficiency |
| Trustworthy answers | Evidence & Confidence Layer | 32–38 | hallucination rate, evidence precision, abstention quality, calibration |
| Domain adaptation | Adaptation/Model Management Layer | 39–44 | benchmark gain, compute efficiency, unseen-domain robustness |
| Temporal/geospatial intelligence | Change Graph | 45–48 | spatial retrieval accuracy, temporal consistency, export correctness |
| Operational ingestion | Data Pipeline | 49–52 | ingestion success, alignment accuracy, throughput |
| Usable deployment | Platform Layer | 53–58 | latency, usability, batch throughput, reproducibility |

### Compliance principle

Every demonstrated feature should be traceable in the final submission to at least one of:

1. an explicit SIH capability,
2. a research gap G1–G10, or
3. a measurable engineering requirement needed to operate the system.

This prevents feature inflation: **ORBITAL should never present 58 features merely as a long checklist; each feature exists for a defensible reason.**


## 7. High-Level Architecture

```
                              USER QUERY (natural language)
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │   QUERY AGENT (Controller) │
                          │  intent classification +   │
                          │  task decomposition (G7)   │
                          └─────────────┬───────────────┘
                                        │
                 ┌──────────────────────┼──────────────────────┐
                 ▼                      ▼                      ▼
        SINGLE-IMAGE PATH      BI-TEMPORAL PATH        OPTICAL–SAR FUSION PATH
        VQA / Caption /        Change VQA / Change      Cross-modal fusion /
        Grounding (G1,G2)      Grounding (G3,G4)         structural verify (G5)
                 │                      │                      │
                 └──────────────────────┼──────────────────────┘
                                        ▼
                          ┌───────────────────────────┐
                          │   EVIDENCE FUSION LAYER     │
                          │  confidence scoring +       │
                          │  hallucination check (G4,G6)│
                          └─────────────┬───────────────┘
                                        ▼
                     ┌──────────────────┴──────────────────┐
                     ▼                                      ▼
              TEXT ANSWER + CONFIDENCE              VISUAL EVIDENCE OVERLAY
                     │                                      │
                     └──────────────────┬───────────────────┘
                                        ▼
                          CHANGE GRAPH / AUDIT TRACE (G3, G8)

```

---


## 7A. Evaluation & Benchmark Strategy

### A. Specialist-model metrics

**Single-image**
- VQA exact-match / task-appropriate accuracy
- captioning metrics where applicable
- grounding IoU / localization accuracy
- land-cover classification F1

**Bi-temporal**
- change detection precision / recall / F1
- change-mask IoU
- change-caption quality
- percentage-change error
- temporal consistency

**Optical + SAR**
- cross-modal classification/verification accuracy
- structural verification precision
- confidence calibration
- robustness under degraded optical imagery

### B. Agent metrics

- correct specialist-model selection rate
- successful task-completion rate
- unnecessary tool-call rate
- average tool calls per query
- fallback/recovery success rate
- re-planning success rate
- end-to-end latency

### C. Trust & evidence metrics

- hallucination rate
- unsupported-claim rate
- evidence precision
- evidence coverage
- abstention precision
- confidence calibration / reliability

### D. Generalization protocol

Do not rely only on random train/test splits. Include:

```text
Known geography
      ↓
Known held-out test
      ↓
Unseen geography
      ↓
Unseen sensor/domain
      ↓
ISRO/SAC-style hidden-domain simulation
```

This directly operationalizes G9, which identifies domain/sensor shift as a critical risk.

### E. Ablation studies

At minimum, compare:

1. Generic LVLM vs RS-adapted VLM
2. Full model vs PEFT/LoRA adaptation
3. Fixed pipeline vs dynamic agent routing
4. Optical-only vs optical + SAR
5. Answer-only vs answer + evidence grounding
6. No uncertainty layer vs confidence/abstention layer
7. No hallucination check vs hallucination-aware pipeline

The goal is to prove that ORBITAL's additional complexity produces measurable gains rather than merely increasing feature count.


## 8. Suggested Technology Stack

- **Base VLM:** open-source LVLM (e.g. Qwen-VL / LLaVA-class) adapted via LoRA/PEFT — not used generic, per PS requirement and G1/G10
- **RS domain adaptation data:** BigEarthNet / reBEN, VRSBench, RSVQA, CDVQA (all named in the PS and in Section 2)
- **SAR processing:** SNAP / GDAL for Sentinel-1 preprocessing; GeoTIFF handling via `rasterio`
- **Fusion module:** custom cross-attention fusion network (MMFNet-inspired)
- **Agent orchestration:** LangGraph-style stateful controller or a custom ReAct-pattern planner
- **Serving:** FastAPI backend, vector store for change-graph/location indexing, React/Next.js frontend for evidence visualization
- **Evaluation harness:** automated scoring against RSVQA/CDVQA/VRSBench splits + a held-out simulated "unseen domain" split (per G9)

---


## 8A. Implementation Roadmap

### Phase 1 — Reliable SIH Core

Build:

- GeoTIFF ingestion
- optical image preprocessing
- RS-adapted VLM baseline
- single-image VQA
- captioning
- grounding
- basic change detection
- basic query controller
- web interface

**Exit condition:** a user can upload imagery, ask a question, receive a correct answer, and see the relevant visual evidence.

### Phase 2 — Multimodal Intelligence

Add:

- Sentinel-1 SAR ingestion
- optical/SAR co-registration
- fusion model
- structural verification
- bi-temporal change grounding
- confidence scores
- evidence chains

**Exit condition:** the same query can trigger multiple modalities and produce a verified result.

### Phase 3 — Agentic Intelligence

Add:

- dynamic specialist selection
- sequential/parallel execution
- tool registry
- retries/fallbacks
- multi-turn memory
- query re-planning
- execution traces

**Exit condition:** the workflow is dynamically generated from the query rather than hard-coded.

### Phase 4 — Research Differentiation

Add:

- hallucination detection
- abstention
- ambiguity detection
- unseen-domain evaluation
- N-temporal change graph
- continual adapter updates
- model/version management

**Exit condition:** ORBITAL can explain not only *what* it thinks, but *where the evidence came from, how confident it is, and when it should refuse to guess*.

### Phase 5 — SIH Demo Hardening

- freeze model versions
- pre-cache benchmark/demo assets
- add failure-state UX
- add reproducible evaluation scripts
- prepare 3–5 deterministic demo scenarios
- document limitations honestly
- prepare offline fallback mode where feasible



## 8B. Final SIH Submission Checklist

Before declaring ORBITAL complete, verify:

- [ ] All mandatory SIH capabilities are demonstrated.
- [ ] The VLM is remote-sensing adapted rather than used as a generic black box.
- [ ] Optical + SAR reasoning is demonstrable.
- [ ] Bi-temporal reasoning produces spatial evidence, not only prose.
- [ ] The controller dynamically selects specialist tools/models.
- [ ] Confidence and abstention are visible to the user.
- [ ] Hallucination mitigation is measurable.
- [ ] Every major feature maps to G1–G10, an SIH requirement, or an engineering requirement.
- [ ] Benchmark results are reproducible.
- [ ] Unseen-domain evaluation is included.
- [ ] An ablation study demonstrates why the proposed architecture is useful.
- [ ] The demo has deterministic fallback scenarios.
- [ ] The 50-paper bibliography is complete and individually verifiable.
- [ ] Claims about performance are backed by measured results, not projected numbers.

### Final positioning

**ORBITAL should be presented as an evidence-grounded, agentic Earth-observation intelligence system — not as a satellite chatbot.**


## 9. Full Reference List

1. Liu, F., Chen, D., Guan, Z., et al. (2024). RemoteCLIP: A Vision Language Foundation Model for Remote Sensing. *IEEE TGRS*.
2. Zhang, Z., Zhao, T., Guo, Y., Yin, J. (2024). RS5M and GeoRSCLIP. *IEEE TGRS*.
3. Kuckreja, K., Danish, M.S., Naseer, M., et al. (2024). GeoChat: Grounded Large Vision-Language Model for Remote Sensing. *CVPR*.
4. Zhan, Y., Xiong, Z., Yuan, Y. (2024). SkyEyeGPT. *arXiv:2401.09712*.
5. Hu, Y., Yuan, J., Wen, C., Lu, X., Li, X. (2023/2025). RSGPT: A Remote Sensing Vision Language Model and Benchmark. *ISPRS J. Photogramm. & Remote Sensing, 224*.
6. Pang, C., Weng, X., Wu, J., et al. (2024). VHM / H2RSVLM. *arXiv:2403.20213*.
7. Muhtar, D., Li, Z., Gu, F., Zhang, X., Xiao, P. (2024). LHRS-Bot. *ECCV*.
8. Li, Z., Muhtar, D., Gu, F., et al. (2024/2025). LHRS-Bot-Nova. *ISPRS J. Photogramm. & Remote Sensing, 227*.
9. Zhang, W., Cai, M., Zhang, T., Zhuang, Y., Mao, X. (2024). EarthGPT. *IEEE TGRS*.
10. Li, X., Wen, C., Hu, Y., Yuan, Z., Zhu, X.X. (2024). Vision-Language Models in Remote Sensing: Current Progress and Future Trends. *IEEE GRSM, 12(2)*.
11. Zhou, Y., Feng, L., Ke, Y., et al. (2024). Towards Vision-Language Geo-Foundation Model: A Survey. *arXiv:2406.09385*.
12. Weng, X., Pang, C., Xia, G.S. Vision-Language Modeling Meets Remote Sensing: Models, Datasets, Perspectives.
13. Lobry, S., Marcos, D., Murray, J., Tuia, D. (2020). RSVQA: Visual Question Answering for Remote Sensing Data. *IEEE TGRS, 58(12)*.
14. Lobry, S., Demir, B., Tuia, D. (2021). RSVQA Meets BigEarthNet. *IGARSS*.
15. RSVLM-QA (2025). Benchmark Dataset for RS Vision Language Model-based QA. *arXiv:2508.07918*.
16. PERS: Parameter-Efficient Multi-modal Transfer Learning for RS Visual Question Answering.
17. RSAdapter Unified Framework: Adapting Dual, Hybrid, and Encoder-Decoder Architectures. *arXiv:2606.19277*.
18. Large Vision-Language Models for Remote Sensing Visual Question Answering. *arXiv:2411.10857*.
19. Text-Guided Coarse-to-Fine Fusion Network for Robust Remote Sensing VQA. *arXiv:2411.15770*.
20. Yuan, Z., Mou, L., Xiong, Z., Zhu, X.X. (2022). Change Detection Meets Visual Question Answering. *IEEE TGRS, 60*.
21. Li, K., Dong, F., Wang, D., et al. (2024). Show Me What and Where has Changed? *arXiv:2410.23828*.
22. DARFT (2025). Improving Few-Shot Change Detection VQA via Decision-Ambiguity-Guided Reinforcement Fine-Tuning. *arXiv:2512.24591*.
23. Revisiting Change VQA in Remote Sensing with Structured and Native Multimodal Qwen Models. *arXiv:2604.18429*.
24. Liu, C., Zhao, R., Chen, H., Zou, Z., Shi, Z. (2022). RS Image Change Captioning with Dual-Branch Transformers. *IEEE TGRS, 60*.
25. Deep Learning Meets SAR (survey). *arXiv:2006.10027*.
26. Progressive Fusion Learning: A Multimodal Joint Segmentation Framework (MMFNet). *ScienceDirect*.
27. Building Detection in SAR Images Based on Fusion of Classic and Deep Learning Features. *Int. J. Remote Sensing, 45(11)*, 2024.
28. Building Detection from SAR Images (U-Net, SpaceNet 6 Sentinel-1/2 data).
29. DehazeMamba: SAR-Guided Optical Remote Sensing Image Dehazing. *arXiv:2503.13073*.
30. Detection of Building Outlines Based on Fusion of SAR and Optical Features. *ScienceDirect*.
31. Shen, Y., et al. (2023). HuggingGPT / JARVIS. *NeurIPS*.
32. Yao, S., et al. (2023). ReAct: Synergizing Reasoning and Acting in Language Models.
33. Schick, T., et al. (2023). Toolformer.
34. Patil, S.G., et al. (2023). Gorilla: Large Language Model Connected with Massive APIs.
35. Qin, Y., et al. (2023). ToolBench / Tool Learning with Foundation Models.
36. AutoTool (2026). Dynamic Tool Selection and Integration for Agentic Reasoning. *arXiv:2512.13278*.
37. Liu, X., Li, R., Ji, W., Lin, T. Towards Robust Multi-Modal Reasoning via Model Selection. *arXiv:2310.08446*.
38. The Evolution of Tool Use in LLM Agents: From Single-Tool Call to Multi-Tool Orchestration. *arXiv:2603.22862*.
39. One Supervisor, Many Modalities: Adaptive Tool Orchestration for Autonomous Queries. *arXiv:2603.11545*.
40. Li, H., Zhang, X., Qu, H. (2025). DDFAV / RSPOPE. *Remote Sensing, 17(4):719*.
41. Cha, M., et al. (2025). Measuring and Mitigating Hallucinations in Vision-Language Dataset Generation for RS. *arXiv:2501.14905*.
42. RSHallu (2026). Dual-Mode Hallucination Evaluation for RS MLLMs. *arXiv:2602.10799*.
43. DHCP: Detecting Hallucinations by Cross-Modal Attention Pattern. *arXiv:2411.18659*.
44. Visual Hallucination Detection in Large Vision-Language Models via Evidential Conflict. *ScienceDirect*, 2025.
45. Sumbul, G., Charfuelan, M., Demir, B., Markl, V. (2019). BigEarthNet. *IGARSS*.
46. Clasen, K.N., Hackel, L., Burgert, T., Sumbul, G., Demir, B., Markl, V. (2025). reBEN: Refined BigEarthNet Dataset. *IGARSS*.
47. Li, X., Ding, J., Elhoseiny, M. (2024). VRSBench. *NeurIPS 37*.
48. OmniEarth: A Benchmark for Evaluating Vision-Language Models in Geospatial Tasks. *arXiv*.
49. CrossEarth: Geospatial Vision Foundation Model for Domain Generalizable RS Semantic Segmentation. *arXiv:2410.22629*.
50. Lacoste, A., Lehmann, N., Rodriguez, P., et al. (2023). GEO-Bench: Toward Foundation Models for Earth Monitoring. *NeurIPS 36*.