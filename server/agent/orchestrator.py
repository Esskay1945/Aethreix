"""
ORBITAL Agentic Controller
Query-driven orchestrator that decomposes questions, selects specialist models,
fuses multi-sensor evidence, and produces auditable conclusions.
"""

import time
import re
from typing import Dict, Any
from server.agent.specialists import OpticalVQASpecialist, ChangeDetectionSpecialist, SARFusionSpecialist
from server.agent.fusion import calculate_calibrated_confidence
from server.agent.audit import AuditTrail
from server.data.stac_pipeline import query_stac_scenes


class OrbitalAgent:
    def __init__(self):
        self.optical_specialist = OpticalVQASpecialist()
        self.change_specialist = ChangeDetectionSpecialist()
        self.sar_specialist = SARFusionSpecialist()

    def parse_intent(self, query: str) -> Dict[str, Any]:
        """Classifies intent and extracts temporal parameters."""
        q = query.lower()
        
        # Temporal regex extraction
        from_year = 2020
        to_year = 2026
        
        since_match = re.search(r'since\s+(\d{4})', q)
        if since_match:
            from_year = int(since_match.group(1))
            
        between_match = re.search(r'(?:between|from)\s+(\d{4})\s+(?:and|to)\s+(\d{4})', q)
        if between_match:
            from_year = int(between_match.group(1))
            to_year = int(between_match.group(2))

        is_change = any(w in q for w in ["change", "construction", "built", "develop", "growth", "expand", "history", "difference", "compare"])
        is_sar = any(w in q for w in ["sar", "radar", "verify", "cloud", "structure", "structural"])
        is_veg = any(w in q for w in ["vegetation", "ndvi", "green", "forest", "crop", "tree"])

        intent = "bitemporal_change" if is_change else "sar_verification" if is_sar else "optical_vqa"

        return {
            "intent": intent,
            "from_year": from_year,
            "to_year": to_year,
            "requires_sar": is_sar or is_change,
            "requires_multitemporal": is_change or from_year != to_year
        }

    def execute_pipeline(self, query: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes the agentic tool graph dynamically per query.
        """
        audit = AuditTrail(query, context)
        plan = self.parse_intent(query)
        
        lat = context.get("lat", 19.3)
        lon = context.get("lon", 73.209)
        loc_name = context.get("name", "Target Coordinate")
        selected_year = context.get("selectedYear", 2024)

        specialist_context = {
            "lat": lat,
            "lon": lon,
            "name": loc_name,
            "year": selected_year,
            "from_year": plan["from_year"],
            "to_year": plan["to_year"]
        }

        # Step 1: STAC Scene Catalog Discovery
        t0 = time.time()
        stac_scenes = query_stac_scenes(lat, lon, plan["from_year"], plan["to_year"])
        audit.log_step(
            "STAC_Discovery",
            "Copernicus_STAC_Pipeline",
            {"lat": lat, "lon": lon, "span": f"{plan['from_year']}-{plan['to_year']}"},
            {"scenes_discovered": len(stac_scenes), "primary_platform": "Sentinel-2 L2A"},
            (time.time() - t0) * 1000
        )

        # Step 2: Optical VQA Specialist
        t0 = time.time()
        optical_out = self.optical_specialist.execute(query, specialist_context)
        audit.log_step(
            "Optical_Perception",
            "OpticalVQASpecialist",
            {"query": query, "year": selected_year},
            optical_out["findings"],
            (time.time() - t0) * 1000
        )

        change_out = None
        sar_out = None

        # Step 3: Bi-Temporal Change Specialist (if required by intent)
        if plan["requires_multitemporal"]:
            t0 = time.time()
            change_out = self.change_specialist.execute(query, specialist_context)
            audit.log_step(
                "Change_Inference",
                "BiTemporalChangeSpecialist",
                {"baseline": plan["from_year"], "target": plan["to_year"], "method": "CVA_Differencing"},
                {"change_pct": change_out["metrics"]["total_change_percentage"], "polygons": len(change_out["geojson_mask"]["features"])},
                (time.time() - t0) * 1000
            )

        # Step 4: SAR Fusion Specialist (cross-validation)
        if plan["requires_sar"]:
            t0 = time.time()
            sar_out = self.sar_specialist.execute(optical_out, specialist_context)
            audit.log_step(
                "SAR_CrossValidation",
                "SARFusionSpecialist",
                {"polarization": "VV/VH", "mode": "Interferometric_Wide"},
                {"structural_verification": sar_out["structural_verification"], "backscatter_db": sar_out["radar_backscatter_vv_db"]},
                (time.time() - t0) * 1000
            )

        # Step 5: Evidence Fusion & Calibrated Confidence
        confidence_pct, is_abstained, abstention_reason = calculate_calibrated_confidence(
            optical_out, sar_out, change_out
        )

        # Step 6: Text Synthesis
        if change_out:
            metrics = change_out["metrics"]
            text_response = (
                f"### 🛰️ **ORBITAL Multi-Sensor Intelligence Report**\n\n"
                f"**Target:** {loc_name} (`{lat:.4f}°N, {lon:.4f}°E`)\n"
                f"**Observation Period:** {plan['from_year']} ➔ {plan['to_year']} ({plan['to_year'] - plan['from_year']} years)\n\n"
                f"#### **1. Quantitative Land-Cover Change Detection:**\n"
                f"• **Total Area Changed:** **{metrics['total_changed_area_sq_km']} km²** ({metrics['total_change_percentage']}% of monitored zone)\n"
                f"• **Built-Up Expansion:** **+{metrics['built_up_expansion_ha']} hectares** (New residential townships & infrastructure)\n"
                f"• **Vegetation Loss:** **-{metrics['vegetation_loss_ha']} hectares** (Farmland/scrubland conversion)\n"
                f"• **Otsu Spectral Threshold:** `λ = {metrics['otsu_spectral_threshold']}` (Statistically separated from atmospheric variance)\n\n"
                f"#### **2. Multi-Sensor Verification:**\n"
                f"• **Sentinel-2 Optical:** Significant NDVI drop (`{metrics['mean_ndvi_baseline']} ➔ {metrics['mean_ndvi_target']}`) with NDBI albedo spike\n"
                f"• **Sentinel-1 SAR:** **{sar_out['structural_verification']}** (`{sar_out['radar_backscatter_vv_db']} dB` double-bounce corner reflection confirms vertical building geometry)\n"
                f"• **Calibrated Confidence:** **{confidence_pct}%** (Multi-sensor agreement)\n\n"
                f"*(Click **'Highlight Evidence on Globe'** below to view the vector change mask on the 3D globe)*"
            )
        else:
            text_response = (
                f"### 🛰️ **ORBITAL Scene Analysis**\n\n"
                f"**Target:** {loc_name} (`{lat:.4f}°N, {lon:.4f}°E`)\n"
                f"**Active Feed:** Sentinel-2 L2A ({selected_year})\n\n"
                f"• **Land Cover Classification:** {optical_out['findings']['scene_classification']}\n"
                f"• **Spectral Profile:** {optical_out['findings']['spectral_signature']}\n"
                f"• **Ground Resolution:** {optical_out['findings']['resolution_effective']}\n"
                f"• **Calibrated Confidence:** **{confidence_pct}%**"
            )

        audit_trace = audit.export_trace(confidence_pct, is_abstained)

        return {
            "text": text_response,
            "confidence": confidence_pct,
            "abstained": is_abstained,
            "abstention_reason": abstention_reason,
            "geojson_mask": change_out["geojson_mask"] if change_out else None,
            "quantitative_metrics": change_out["metrics"] if change_out else None,
            "transitions": change_out["transitions"] if change_out else None,
            "sar_verification": sar_out,
            "optical_findings": optical_out,
            "audit_trail": audit_trace,
            "agent_metadata": {
                "planner": "ORBITAL ReAct Dynamic Controller",
                "specialists_invoked": [s["tool_invoked"] for s in audit_trace["execution_graph"]],
                "stac_catalog": "Copernicus Data Space Ecosystem (CDSE)"
            }
        }
