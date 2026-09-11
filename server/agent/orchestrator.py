"""
ORBITAL Agentic Controller
Query-driven orchestrator that decomposes questions, selects specialist models,
fuses multi-sensor evidence, and produces auditable conclusions.

Updated to work with honest specialist outputs (no fake data).
"""

import time
import re
from typing import Dict, Any
from server.agent.specialists import OpticalVQASpecialist, ChangeDetectionSpecialist, SARFusionSpecialist, VisualGeolocationSpecialist
from server.agent.fusion import calculate_calibrated_confidence
from server.agent.audit import AuditTrail
from server.data.stac_pipeline import query_stac_scenes


class OrbitalAgent:
    def __init__(self):
        self.optical_specialist = OpticalVQASpecialist()
        self.change_specialist = ChangeDetectionSpecialist()
        self.sar_specialist = SARFusionSpecialist()
        self.visual_geo_specialist = VisualGeolocationSpecialist()

    def parse_intent(self, query: str) -> Dict[str, Any]:
        """Classifies intent and extracts temporal parameters."""
        q = query.lower()

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
        is_water = any(w in q for w in ["water", "flood", "river", "lake", "ocean"])

        intent = "bitemporal_change" if is_change else "sar_verification" if is_sar else "optical_vqa"

        return {
            "intent": intent,
            "from_year": from_year,
            "to_year": to_year,
            "requires_sar": is_sar or is_change,
            "requires_multitemporal": is_change or from_year != to_year,
            "is_vegetation": is_veg,
            "is_water": is_water,
        }

    def execute_pipeline(self, query: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Executes the agentic tool graph dynamically per query."""
        audit = AuditTrail(query, context)
        plan = self.parse_intent(query)

        lat = context.get("lat", 19.3)
        lon = context.get("lon", 73.209)
        loc_name = context.get("name", "Target Coordinate")
        selected_year = context.get("selectedYear", 2024)

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
            "from_year": plan["from_year"],
            "to_year": plan["to_year"],
            "aoi": context.get("aoi"),
        }

        # Step 1: STAC Scene Catalog Discovery
        t0 = time.time()
        stac_scenes = query_stac_scenes(lat, lon, plan["from_year"], plan["to_year"])
        stac_count = len(stac_scenes)
        audit.log_step(
            "STAC_Discovery",
            "Copernicus_STAC_Pipeline",
            {"lat": lat, "lon": lon, "span": f"{plan['from_year']}-{plan['to_year']}"},
            {"scenes_discovered": stac_count, "source": "Copernicus STAC" if stac_count > 0 else "unavailable"},
            (time.time() - t0) * 1000
        )

        # Step 2: Optical VQA Specialist
        t0 = time.time()
        optical_out = self.optical_specialist.execute(query, specialist_context)
        audit.log_step(
            "Optical_Perception",
            "OpticalVQASpecialist",
            {"query": query, "year": selected_year},
            {"status": optical_out["status"], "data_source": optical_out.get("data_source", "unknown")},
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
                {
                    "change_pct": change_out["metrics"].get("total_change_percentage", 0),
                    "polygons": len(change_out["geojson_mask"]["features"]),
                    "data_status": change_out.get("data_status", "unknown"),
                },
                (time.time() - t0) * 1000
            )

        # Step 4: SAR Fusion Specialist (cross-validation)
        if plan["requires_sar"]:
            t0 = time.time()
            sar_out = self.sar_specialist.execute(optical_out, specialist_context)
            audit.log_step(
                "SAR_CrossValidation",
                "SARFusionSpecialist",
                {"polarization": "VV/VH", "mode": "Planned"},
                {"status": sar_out["status"], "structural_verification": sar_out["structural_verification"]},
                (time.time() - t0) * 1000
            )

        # Step 5: Evidence Fusion & Calibrated Confidence
        confidence_pct, is_abstained, abstention_reason = calculate_calibrated_confidence(
            optical_out, sar_out, change_out
        )

        # Determine overall data quality
        data_quality = "unknown"
        if optical_out.get("data_quality") == "real_multispectral":
            data_quality = "real_multispectral"
        elif change_out and change_out.get("data_status") == "real_multispectral":
            data_quality = "real_multispectral"
        elif change_out and change_out.get("data_status"):
            data_quality = change_out["data_status"]

        # Step 6: Text Synthesis — honest about data quality
        if change_out and change_out.get("status") == "success":
            metrics = change_out["metrics"]
            data_status = change_out.get("data_status", "unknown")

            text_response = (
                f"### **ORBITAL Multi-Sensor Intelligence Report**\n\n"
                f"**Target:** {loc_name} (`{lat:.4f} N, {lon:.4f} E`)\n"
                f"**Observation Period:** {plan['from_year']} to {plan['to_year']} ({plan['to_year'] - plan['from_year']} years)\n"
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

            # Real index values
            if metrics.get('ndvi_delta') is not None:
                text_response += f"- **NDVI Delta:** {metrics['ndvi_delta']:+.4f}\n"
            if metrics.get('ndbi_delta') is not None:
                text_response += f"- **NDBI Delta:** {metrics['ndbi_delta']:+.4f}\n"
            if metrics.get('ndwi_delta') is not None:
                text_response += f"- **NDWI Delta:** {metrics['ndwi_delta']:+.4f}\n"

            text_response += (
                f"\n#### **2. Multi-Sensor Verification:**\n"
                f"- **Optical NDVI:** {metrics.get('mean_ndvi_baseline', 'N/A')} ({plan['from_year']}) to {metrics.get('mean_ndvi_target', 'N/A')} ({plan['to_year']})\n"
                f"- **Optical NDBI:** {metrics.get('mean_ndbi_baseline', 'N/A')} ({plan['from_year']}) to {metrics.get('mean_ndbi_target', 'N/A')} ({plan['to_year']})\n"
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
                text_response += f"- **SAR:** Not available -- {sar_out.get('reason', 'Requires Earth Engine')}\n"

            text_response += f"\n**Calibrated Confidence:** **{confidence_pct}%**\n"

        elif change_out and change_out.get("status") == "data_unavailable":
            text_response = (
                f"### **Data Unavailable**\n\n"
                f"**Target:** {loc_name} (`{lat:.4f} N, {lon:.4f} E`)\n\n"
                f"Could not retrieve satellite imagery for the requested dates. "
                f"Please check the location and date range."
            )
        else:
            # Scene-level analysis (no change detection)
            optical_findings = optical_out.get('findings', {})
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
            "geojson_mask": change_out["geojson_mask"] if change_out and change_out.get("status") == "success" else None,
            "quantitative_metrics": change_out["metrics"] if change_out and change_out.get("status") == "success" else None,
            "transitions": change_out["transitions"] if change_out and change_out.get("status") == "success" else None,
            "sar_verification": sar_out,
            "optical_findings": optical_out,
            "audit_trail": audit_trace,
            "agent_metadata": {
                "planner": "ORBITAL ReAct Dynamic Controller",
                "specialists_invoked": [s["tool_invoked"] for s in audit_trace["execution_graph"]],
                "stac_catalog": "Copernicus Data Space Ecosystem (CDSE)",
                "data_quality": data_quality,
            }
        }
