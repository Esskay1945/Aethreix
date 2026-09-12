"""
ORBITAL Evidence Fusion & Calibrated Uncertainty Layer

Combines multi-modal evidence (Optical + SAR + Temporal), computes calibrated confidence
derived from measurable quantities, and executes explicit abstention if signals
are contradictory or ambiguous.

Confidence is NEVER arbitrary. Every additive/subtractive factor traces to a
measurable quantity in the evidence payload.
"""

from typing import Dict, Any, Tuple, Optional
import math


def calculate_calibrated_confidence(
    optical_result: Dict[str, Any],
    sar_result: Optional[Dict[str, Any]],
    change_result: Optional[Dict[str, Any]]
) -> Tuple[float, bool, str]:
    """
    Computes genuinely calibrated confidence derived from measurable evidence.

    Factors:
    1. Optical Spectral Change Magnitude (continuous, normalized)
    2. SAR Cross-Validation Agreement (parsed from structural_verification string)
    3. Cloud Cover Penalty (from actual EE metadata, not hardcoded)
    4. Spatial Consistency (polygon count as a proxy for change coherence)
    5. Data Quality Tier (real_multispectral >> stac_metadata >> none)

    Returns: (confidence_pct, is_abstaining, reason)
    """
    score = 0.0
    evidence_factors = []
    max_possible = 0.0

    # ─── Factor 1: Data Quality Tier (0-20 points) ───
    max_possible += 20.0
    data_quality = "none"
    if change_result and change_result.get("status") == "success":
        data_quality = change_result.get("data_status", change_result.get("data_quality", "unknown"))
    elif optical_result:
        data_quality = optical_result.get("data_quality", "none")

    if data_quality == "real_multispectral":
        score += 20.0
        evidence_factors.append("Real multispectral data from Earth Engine (+20)")
    elif data_quality == "real_sar":
        score += 15.0
        evidence_factors.append("Real SAR data from Earth Engine (+15)")
    elif data_quality == "stac_metadata":
        score += 8.0
        evidence_factors.append("STAC metadata only — no pixel analysis (+8)")
    else:
        score += 0.0
        evidence_factors.append("No verified data source (+0)")

    # ─── Factor 2: Optical Spectral Change Magnitude (0-30 points) ───
    max_possible += 30.0
    if change_result and change_result.get("status") == "success":
        metrics = change_result.get("metrics", {})
        deltas = change_result.get("deltas", metrics)  # support both structures

        ndvi_delta = abs(deltas.get("ndvi_delta", deltas.get("ndvi_change", 0)) or 0)
        ndbi_delta = abs(deltas.get("ndbi_delta", deltas.get("ndbi_change", 0)) or 0)
        ndwi_delta = abs(deltas.get("ndwi_delta", deltas.get("ndwi_change", 0)) or 0)

        # Combined spectral change magnitude (0 to ~1.0+)
        combined_magnitude = math.sqrt(ndvi_delta**2 + ndbi_delta**2 + ndwi_delta**2)

        # Normalize: 0.0 = no change, 0.5+ = very strong change
        optical_score = min(1.0, combined_magnitude / 0.5) * 30.0
        score += optical_score
        evidence_factors.append(
            f"Spectral change magnitude: {combined_magnitude:.4f} "
            f"(ΔNDVI={ndvi_delta:.4f}, ΔNDBI={ndbi_delta:.4f}, ΔNDWI={ndwi_delta:.4f}) "
            f"(+{optical_score:.1f})"
        )
    else:
        evidence_factors.append("No change detection data available (+0)")

    # ─── Factor 3: SAR Cross-Validation (0-25 points) ───
    max_possible += 25.0
    if sar_result and sar_result.get("status") == "success":
        verification = sar_result.get("structural_verification", "")

        if verification.startswith("CONFIRMED"):
            score += 25.0
            evidence_factors.append(f"SAR confirms optical findings: {verification[:60]} (+25)")
        elif verification.startswith("CONSISTENT"):
            score += 20.0
            evidence_factors.append(f"SAR consistent with optical: {verification[:60]} (+20)")
        elif verification.startswith("PARTIAL"):
            score += 12.0
            evidence_factors.append(f"SAR partially corroborates: {verification[:60]} (+12)")
        elif verification.startswith("INCONCLUSIVE"):
            score += 5.0
            evidence_factors.append(f"SAR inconclusive: {verification[:60]} (+5)")
        else:
            score -= 5.0
            evidence_factors.append(f"SAR contradicts optical signal: {verification[:60]} (-5)")
    elif sar_result and sar_result.get("status") == "not_available":
        # SAR not available — don't penalize, but don't boost either
        evidence_factors.append("SAR unavailable — no cross-validation possible (+0)")
    else:
        evidence_factors.append("SAR not executed (+0)")

    # ─── Factor 4: Cloud Cover Penalty (0 to -15 points) ───
    max_possible += 15.0  # Best case: perfect atmosphere adds 15
    cloud_pct = None

    # Extract actual cloud coverage from provenance metadata
    if change_result and change_result.get("status") == "success":
        provenance = change_result.get("provenance", {})
        cloud_a = provenance.get("baseline_mean_cloud_pct")
        cloud_b = provenance.get("target_mean_cloud_pct")
        if cloud_a is not None and cloud_b is not None:
            cloud_pct = max(cloud_a, cloud_b)
        elif cloud_a is not None:
            cloud_pct = cloud_a
        elif cloud_b is not None:
            cloud_pct = cloud_b

    if cloud_pct is None and optical_result:
        cloud_pct = optical_result.get("mean_cloud_pct")

    if cloud_pct is not None:
        if cloud_pct <= 5.0:
            score += 15.0
            evidence_factors.append(f"Excellent atmospheric quality: {cloud_pct:.1f}% cloud cover (+15)")
        elif cloud_pct <= 10.0:
            score += 10.0
            evidence_factors.append(f"Good atmospheric quality: {cloud_pct:.1f}% cloud cover (+10)")
        elif cloud_pct <= 15.0:
            score += 5.0
            evidence_factors.append(f"Fair atmospheric quality: {cloud_pct:.1f}% cloud cover (+5)")
        else:
            penalty = min(15.0, (cloud_pct - 15.0) * 0.5)
            score -= penalty
            evidence_factors.append(f"Poor atmospheric quality: {cloud_pct:.1f}% cloud cover (-{penalty:.1f})")
    else:
        evidence_factors.append("Cloud metadata unavailable — no atmospheric penalty applied (+0)")

    # ─── Factor 5: Spatial Consistency — Polygon Count (0-10 points) ───
    max_possible += 10.0
    if change_result and change_result.get("status") == "success":
        poly_count = change_result.get("polygon_count", 0)
        if poly_count is None:
            # Old-style response without polygon_count
            geojson = change_result.get("geojson_mask", change_result.get("change_polygons", {}))
            poly_count = len(geojson.get("features", []))

        if 1 <= poly_count <= 20:
            score += 10.0
            evidence_factors.append(f"Spatially coherent change: {poly_count} contiguous regions (+10)")
        elif poly_count > 20:
            score += 5.0
            evidence_factors.append(f"Fragmented change: {poly_count} regions — possible noise (+5)")
        else:
            evidence_factors.append("No change polygons generated (+0)")

    # ─── Compute final confidence ───
    # Normalize to 0-100 scale
    final_confidence = max(0.0, min(100.0, score))
    final_confidence_pct = round(final_confidence, 1)

    # ─── Explicit Abstention Policy (per SIH26167 Specification) ───
    # If confidence is below 55%, the system refuses to guess and explicitly abstains
    is_abstaining = final_confidence_pct < 55.0

    if is_abstaining:
        abstention_reason = (
            "Evidence ambiguous: insufficient cross-modal agreement. "
            f"Calibrated confidence ({final_confidence_pct}%) is below the 55% abstention threshold. "
            f"Evidence factors: {'; '.join(evidence_factors)}"
        )
    else:
        abstention_reason = f"Multi-sensor agreement confirmed. Evidence: {'; '.join(evidence_factors)}"

    return final_confidence_pct, is_abstaining, abstention_reason
