"""
ORBITAL Agentic Controller
Query-driven orchestrator that dynamically decomposes questions into a structured
execution plan (DAG), selects specialist models, fuses multi-sensor evidence,
and produces auditable conclusions.

Issue #8 Fix: Replaced regex keyword routing with a structured Mission Planner
that generates a dynamic Directed Acyclic Graph (DAG) for each query.
"""

import time
import re
from typing import Dict, Any, List
from server.agent.specialists import OpticalVQASpecialist, ChangeDetectionSpecialist, SARFusionSpecialist, VisualGeolocationSpecialist
from server.agent.fusion import calculate_calibrated_confidence
from server.agent.audit import AuditTrail
from server.data.stac_pipeline import query_stac_scenes


# ═══════════════════════════════════════════════════════════════════════════
# MISSION PLANNER — Dynamic Execution Plan Generator
# ═══════════════════════════════════════════════════════════════════════════

# Intent taxonomy: each intent maps to a required evidence chain
INTENT_TAXONOMY = {
    "bitemporal_change": {
        "description": "Bi-temporal land-cover change analysis",
        "required_evidence": ["optical_baseline", "optical_target", "spectral_change", "geojson_polygons"],
        "execution_plan": [
            {"step": "stac_discovery", "tool": "Copernicus_STAC_Pipeline", "depends_on": []},
            {"step": "optical_analysis", "tool": "OpticalVQASpecialist", "depends_on": ["stac_discovery"]},
            {"step": "change_detection", "tool": "BiTemporalChangeSpecialist", "depends_on": ["optical_analysis"]},
            {"step": "sar_verification", "tool": "SARFusionSpecialist", "depends_on": ["optical_analysis"]},
            {"step": "evidence_fusion", "tool": "EvidenceFusion", "depends_on": ["change_detection", "sar_verification"]},
        ],
    },
    "sar_verification": {
        "description": "SAR-focused structural verification",
        "required_evidence": ["optical_scene", "sar_backscatter", "cross_validation"],
        "execution_plan": [
            {"step": "stac_discovery", "tool": "Copernicus_STAC_Pipeline", "depends_on": []},
            {"step": "optical_analysis", "tool": "OpticalVQASpecialist", "depends_on": ["stac_discovery"]},
            {"step": "sar_verification", "tool": "SARFusionSpecialist", "depends_on": ["optical_analysis"]},
            {"step": "evidence_fusion", "tool": "EvidenceFusion", "depends_on": ["sar_verification"]},
        ],
    },
    "vegetation_analysis": {
        "description": "Vegetation health and cover analysis",
        "required_evidence": ["optical_scene", "ndvi", "evi", "temporal_ndvi"],
        "execution_plan": [
            {"step": "stac_discovery", "tool": "Copernicus_STAC_Pipeline", "depends_on": []},
            {"step": "optical_analysis", "tool": "OpticalVQASpecialist", "depends_on": ["stac_discovery"]},
            {"step": "change_detection", "tool": "BiTemporalChangeSpecialist", "depends_on": ["optical_analysis"]},
            {"step": "evidence_fusion", "tool": "EvidenceFusion", "depends_on": ["change_detection"]},
        ],
    },
    "water_analysis": {
        "description": "Water body detection and monitoring",
        "required_evidence": ["optical_scene", "ndwi", "mndwi"],
        "execution_plan": [
            {"step": "stac_discovery", "tool": "Copernicus_STAC_Pipeline", "depends_on": []},
            {"step": "optical_analysis", "tool": "OpticalVQASpecialist", "depends_on": ["stac_discovery"]},
            {"step": "change_detection", "tool": "BiTemporalChangeSpecialist", "depends_on": ["optical_analysis"]},
            {"step": "evidence_fusion", "tool": "EvidenceFusion", "depends_on": ["change_detection"]},
        ],
    },
    "optical_vqa": {
        "description": "Single-image scene analysis and visual question answering",
        "required_evidence": ["optical_scene", "spectral_indices"],
        "execution_plan": [
            {"step": "stac_discovery", "tool": "Copernicus_STAC_Pipeline", "depends_on": []},
            {"step": "optical_analysis", "tool": "OpticalVQASpecialist", "depends_on": ["stac_discovery"]},
            {"step": "evidence_fusion", "tool": "EvidenceFusion", "depends_on": ["optical_analysis"]},
        ],
    },
}

# Signal keywords for intent classification (expanded beyond simple regex)
INTENT_SIGNALS = {
    "bitemporal_change": [
        "change", "changed", "construction", "built", "develop", "development",
        "growth", "expand", "expansion", "history", "difference", "compare",
        "comparison", "urban", "urbanization", "deforestation", "before",
        "after", "transform", "transition", "conversion", "encroachment",
    ],
    "sar_verification": [
        "sar", "radar", "verify", "structural", "structure", "microwave",
        "backscatter", "c-band", "sentinel-1",
    ],
    "vegetation_analysis": [
        "vegetation", "ndvi", "green", "forest", "crop", "tree", "canopy",
        "agriculture", "farming", "plantation", "biomass", "chlorophyll",
    ],
    "water_analysis": [
        "water", "flood", "river", "lake", "ocean", "reservoir", "wetland",
        "drought", "inundation", "ndwi", "coastal",
    ],
}


class OrbitalAgent:
    def __init__(self):
        self.optical_specialist = OpticalVQASpecialist()
        self.change_specialist = ChangeDetectionSpecialist()
        self.sar_specialist = SARFusionSpecialist()
        self.visual_geo_specialist = VisualGeolocationSpecialist()

    def plan_mission(self, query: str) -> Dict[str, Any]:
        """
        Dynamic Mission Planner: Generates a structured execution plan (DAG)
        based on the query's intent.

        Returns:
            {
                "intent": str,
                "description": str,
                "required_evidence": [str],
                "execution_plan": [{step, tool, depends_on}],
                "temporal_params": {from_year, to_year},
                "detected_signals": [str],
            }
        """
        q = query.lower()

        # ── Extract temporal parameters ──
        from_year = 2020
        to_year = 2026

        since_match = re.search(r'since\s+(\d{4})', q)
        if since_match:
            from_year = int(since_match.group(1))

        between_match = re.search(r'(?:between|from)\s+(\d{4})\s+(?:and|to)\s+(\d{4})', q)
        if between_match:
            from_year = int(between_match.group(1))
            to_year = int(between_match.group(2))

        # ── Intent classification with signal scoring ──
        intent_scores = {}
        detected_signals = {}

        for intent, keywords in INTENT_SIGNALS.items():
            matches = [kw for kw in keywords if kw in q]
            intent_scores[intent] = len(matches)
            if matches:
                detected_signals[intent] = matches

        # Select highest-scoring intent (default to optical_vqa)
        best_intent = max(intent_scores, key=intent_scores.get)
        if intent_scores[best_intent] == 0:
            best_intent = "optical_vqa"

        # If temporal keywords present but no explicit change intent, upgrade to bitemporal
        has_temporal = from_year != 2020 or to_year != 2026
        if has_temporal and best_intent == "optical_vqa":
            best_intent = "bitemporal_change"

        plan_template = INTENT_TAXONOMY[best_intent]

        return {
            "intent": best_intent,
            "description": plan_template["description"],
            "required_evidence": plan_template["required_evidence"],
            "execution_plan": plan_template["execution_plan"],
            "temporal_params": {
                "from_year": from_year,
                "to_year": to_year,
            },
            "detected_signals": detected_signals.get(best_intent, []),
        }

    def parse_intent(self, query: str) -> Dict[str, Any]:
        """Legacy-compatible wrapper around plan_mission. Returns the same
        shape expected by the SSE stream and old code paths."""
        mission = self.plan_mission(query)
        tp = mission["temporal_params"]

        # Determine which specialists are in the plan
        tools_in_plan = [step["tool"] for step in mission["execution_plan"]]
        requires_sar = "SARFusionSpecialist" in tools_in_plan
        requires_change = "BiTemporalChangeSpecialist" in tools_in_plan

        return {
            "intent": mission["intent"],
            "from_year": tp["from_year"],
            "to_year": tp["to_year"],
            "requires_sar": requires_sar,
            "requires_multitemporal": requires_change,
            "is_vegetation": mission["intent"] == "vegetation_analysis",
            "is_water": mission["intent"] == "water_analysis",
            "mission_plan": mission,
        }

    def execute_pipeline(self, query: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes the agentic tool graph DYNAMICALLY based on the mission plan DAG.
        Each step is dispatched according to the plan, not hardcoded if/else blocks.
        """
        audit = AuditTrail(query, context)
        mission = self.plan_mission(query)
        plan = mission["execution_plan"]
        tp = mission["temporal_params"]

        lat = context.get("lat", 19.3)
        lon = context.get("lon", 73.209)
        loc_name = context.get("name", "Target Coordinate")
        selected_year = context.get("selectedYear", 2024)
        aoi_geojson = context.get("aoi")

        image_b64 = context.get("image_base64")
        if image_b64:
            t0 = time.time()
            geo_out = self.visual_geo_specialist.execute(image_b64)
            audit.log_step(
                "Image_Geolocation",
                "VisualGeolocationSpecialist",
                {"image_attached": True},
                geo_out.get("location_match", {}),
                (time.time() - t0) * 1000
            )

            if geo_out.get("status") == "success":
                glat = geo_out["location_match"]["lat"]
                glon = geo_out["location_match"]["lon"]
                gname = geo_out["location_match"]["name"]

                text_response = (
                    f"### 🎯 **ORBITAL Visual Geolocation Successful**\n\n"
                    f"**Extracted Coordinates:** `{glat}°N, {glon}°E`\n"
                    f"**Predicted Location:** {gname}\n"
                    f"**Localization Method:** {geo_out['geolocation_method']}\n\n"
                    f"**Identified Features:**\n"
                )
                for f in geo_out["extracted_features"]:
                    text_response += f"• {f}\n"

                return {
                    "text": text_response,
                    "evidence": {
                        "type": "visual_geolocation",
                        "model": "Visual_Geolocation_Specialist",
                        "confidence": int(geo_out["confidence"] * 100),
                        "sources": ["EXIF GPS Metadata"],
                        "location_match": geo_out["location_match"]
                    },
                    "audit_trail": audit.get_trail() if hasattr(audit, 'get_trail') else audit.export_trace(100, False)
                }
            else:
                return {
                    "text": f"### ⚠️ Geolocation Result\n\n{geo_out.get('error', 'Could not determine location from image.')}",
                    "evidence": None,
                    "confidence": 0,
                    "audit_trail": audit.export_trace(0, True)
                }

        specialist_context = {
            "lat": lat,
            "lon": lon,
            "name": loc_name,
            "year": selected_year,
            "from_year": tp["from_year"],
            "to_year": tp["to_year"],
            "aoi": aoi_geojson,
        }

        # ── Dynamic DAG execution ──
        step_results = {}
        optical_out = None
        change_out = None
        sar_out = None

        for step in plan:
            step_name = step["step"]
            tool_name = step["tool"]

            t0 = time.time()

            if step_name == "stac_discovery":
                stac_scenes = query_stac_scenes(lat, lon, tp["from_year"], tp["to_year"])
                stac_count = len(stac_scenes)
                step_results["stac_discovery"] = {"scenes_discovered": stac_count}
                audit.log_step(
                    "STAC_Discovery", tool_name,
                    {"lat": lat, "lon": lon, "span": f"{tp['from_year']}-{tp['to_year']}"},
                    {"scenes_discovered": stac_count},
                    (time.time() - t0) * 1000
                )

            elif step_name == "optical_analysis":
                optical_out = self.optical_specialist.execute(query, specialist_context)
                step_results["optical_analysis"] = optical_out
                audit.log_step(
                    "Optical_Perception", tool_name,
                    {"query": query, "year": selected_year},
                    {"status": optical_out["status"], "data_source": optical_out.get("data_source", "unknown")},
                    (time.time() - t0) * 1000
                )

            elif step_name == "change_detection":
                change_out = self.change_specialist.execute(query, specialist_context)
                step_results["change_detection"] = change_out
                audit.log_step(
                    "Change_Inference", tool_name,
                    {"baseline": tp["from_year"], "target": tp["to_year"]},
                    {
                        "status": change_out.get("status"),
                        "data_status": change_out.get("data_status", "unknown"),
                        "polygon_count": change_out.get("polygon_count", 0),
                    },
                    (time.time() - t0) * 1000
                )

            elif step_name == "sar_verification":
                sar_out = self.sar_specialist.execute(optical_out or {}, specialist_context)
                step_results["sar_verification"] = sar_out
                audit.log_step(
                    "SAR_CrossValidation", tool_name,
                    {"polarization": "VV/VH"},
                    {"status": sar_out["status"], "structural_verification": sar_out.get("structural_verification", "N/A")},
                    (time.time() - t0) * 1000
                )

            elif step_name == "evidence_fusion":
                # Handled below after all specialists complete
                pass

        # ── Evidence Fusion & Calibrated Confidence ──
        confidence_pct, is_abstained, abstention_reason = calculate_calibrated_confidence(
            optical_out or {}, sar_out, change_out
        )

        # Determine overall data quality
        data_quality = "unknown"
        if optical_out and optical_out.get("data_quality") == "real_multispectral":
            data_quality = "real_multispectral"
        elif change_out and change_out.get("data_status") == "real_multispectral":
            data_quality = "real_multispectral"
        elif change_out and change_out.get("data_status"):
            data_quality = change_out["data_status"]

        # ── Text Synthesis — honest about data quality ──
        stac_count = step_results.get("stac_discovery", {}).get("scenes_discovered", 0)

        if change_out and change_out.get("status") == "success":
            metrics = change_out["metrics"]
            data_status = change_out.get("data_status", "unknown")

            text_response = (
                f"### **ORBITAL Multi-Sensor Intelligence Report**\n\n"
                f"**Target:** {loc_name} (`{lat:.4f} N, {lon:.4f} E`)\n"
                f"**Observation Period:** {tp['from_year']} to {tp['to_year']} ({tp['to_year'] - tp['from_year']} years)\n"
                f"**Mission Plan:** {mission['description']}\n"
            )

            # Data quality badge
            if data_status == "real_multispectral":
                text_response += f"**Data Source:** Google Earth Engine — Real Sentinel-2 L2A Multispectral\n\n"
            elif data_status == "rgb_proxy":
                text_response += (
                    "\n> **Data Quality Notice:** Analysis used RGB composite imagery (not real multispectral bands). "
                    "Index values are approximations.\n\n"
                )
            else:
                text_response += "\n"

            text_response += (
                f"#### **1. Quantitative Land-Cover Change Detection:**\n"
                f"- **Total Area Changed:** **{metrics.get('total_changed_area_sq_km', 0)} km2** "
                f"({metrics.get('total_change_percentage', 0)}% of monitored zone)\n"
            )

            if metrics.get('built_up_expansion_ha', 0) > 0:
                text_response += f"- **Built-Up Expansion:** **+{metrics['built_up_expansion_ha']} hectares**\n"
            if metrics.get('vegetation_loss_ha', 0) > 0:
                text_response += f"- **Vegetation Loss:** **-{metrics['vegetation_loss_ha']} hectares**\n"
            if metrics.get('change_polygon_count', 0) > 0:
                text_response += f"- **Change Regions Detected:** **{metrics['change_polygon_count']} contiguous areas**\n"

            # Real index values
            if metrics.get('ndvi_delta') is not None:
                text_response += f"- **NDVI Delta:** {metrics['ndvi_delta']:+.4f}\n"
            if metrics.get('ndbi_delta') is not None:
                text_response += f"- **NDBI Delta:** {metrics['ndbi_delta']:+.4f}\n"
            if metrics.get('ndwi_delta') is not None:
                text_response += f"- **NDWI Delta:** {metrics['ndwi_delta']:+.4f}\n"

            text_response += (
                f"\n#### **2. Multi-Sensor Verification:**\n"
                f"- **Optical NDVI:** {metrics.get('mean_ndvi_baseline', 'N/A')} ({tp['from_year']}) to {metrics.get('mean_ndvi_target', 'N/A')} ({tp['to_year']})\n"
                f"- **Optical NDBI:** {metrics.get('mean_ndbi_baseline', 'N/A')} ({tp['from_year']}) to {metrics.get('mean_ndbi_target', 'N/A')} ({tp['to_year']})\n"
            )

            # SAR status — honest
            if sar_out and sar_out.get("status") == "success":
                text_response += (
                    f"- **SAR Verification:** {sar_out['structural_verification']}\n"
                    f"- **SAR Backscatter:** VV={sar_out.get('radar_backscatter_vv_db', 'N/A')} dB, "
                    f"VH={sar_out.get('radar_backscatter_vh_db', 'N/A')} dB\n"
                    f"- **Surface Type:** {sar_out.get('surface_interpretation', 'N/A')}\n"
                )
            elif sar_out and sar_out.get("status") == "not_available":
                text_response += f"- **SAR:** Not available — {sar_out.get('reason', 'Requires Earth Engine')}\n"

            text_response += f"\n**Calibrated Confidence:** **{confidence_pct}%**\n"

        elif change_out and change_out.get("status") in ("not_available", "data_unavailable"):
            text_response = (
                f"### **Data Unavailable**\n\n"
                f"**Target:** {loc_name} (`{lat:.4f} N, {lon:.4f} E`)\n\n"
                f"{change_out.get('reason', 'Could not retrieve satellite imagery for the requested dates.')}\n"
            )
        else:
            # Scene-level analysis (no change detection)
            optical_findings = (optical_out or {}).get('findings', {})
            scene_class = optical_findings.get('scene_classification', 'Unknown')
            spectral = optical_findings.get('spectral_signature', {})

            text_response = (
                f"### **ORBITAL Scene Analysis**\n\n"
                f"**Target:** {loc_name} (`{lat:.4f} N, {lon:.4f} E`)\n"
                f"**Active Feed:** {optical_findings.get('resolution_effective', 'Unknown')}\n\n"
                f"- **Scene Classification:** {scene_class}\n"
            )

            if isinstance(spectral, dict) and spectral.get('ndvi') is not None:
                text_response += (
                    f"- **NDVI:** {spectral['ndvi']:.4f}\n"
                    f"- **NDWI:** {spectral.get('ndwi', 'N/A')}\n"
                    f"- **NDBI:** {spectral.get('ndbi', 'N/A')}\n"
                )

            text_response += (
                f"- **STAC Scenes Discovered:** {stac_count}\n"
                f"- **Calibrated Confidence:** **{confidence_pct}%**"
            )

        audit_trace = audit.export_trace(confidence_pct, is_abstained)

        return {
            "text": text_response,
            "confidence": confidence_pct,
            "abstained": is_abstained,
            "abstention_reason": abstention_reason,
            "geojson_mask": change_out.get("geojson_mask") if change_out and change_out.get("status") == "success" else None,
            "change_polygons": change_out.get("change_polygons") if change_out and change_out.get("status") == "success" else None,
            "quantitative_metrics": change_out.get("metrics") if change_out and change_out.get("status") == "success" else None,
            "transitions": change_out.get("transitions") if change_out and change_out.get("status") == "success" else None,
            "sar_verification": sar_out,
            "optical_findings": optical_out,
            "audit_trail": audit_trace,
            "agent_metadata": {
                "planner": "ORBITAL Dynamic Mission Planner (DAG-based)",
                "mission_intent": mission["intent"],
                "mission_description": mission["description"],
                "required_evidence": mission["required_evidence"],
                "specialists_invoked": [s["tool_invoked"] for s in audit_trace["execution_graph"]],
                "stac_catalog": "Copernicus Data Space Ecosystem (CDSE)",
                "data_quality": data_quality,
            }
        }
