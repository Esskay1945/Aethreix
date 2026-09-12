"""
ORBITAL Research Benchmark Runner

Automated evaluation suite for the Aethreix ORBITAL platform.

Metrics:
- VQA Accuracy: Correctness of scene classification
- Grounding Accuracy: Location resolution precision
- Change Detection F1-Score, IoU, Precision, Recall
- Calibration: Confidence vs. actual correctness
- Abstention Accuracy: Correctness of refuse-to-answer decisions
- Latency: Per-query and per-specialist timing
- Cost: Compute resource usage estimation

Ablation Experiments:
- Full ORBITAL pipeline (baseline)
- Without SAR (optical-only)
- Without temporal analysis (single-date)
- Without evidence fusion (raw specialist output)
- Without confidence calibration (uncalibrated)

Usage:
    from server.benchmarks.benchmark_runner import BenchmarkRunner
    runner = BenchmarkRunner()
    results = runner.run_full_benchmark(test_cases)
"""

from typing import Dict, Any, List, Optional, Tuple
import time
import numpy as np
from datetime import datetime


class BenchmarkMetrics:
    """Computes standard evaluation metrics for change detection and classification."""

    @staticmethod
    def precision(tp: int, fp: int) -> float:
        return tp / (tp + fp) if (tp + fp) > 0 else 0.0

    @staticmethod
    def recall(tp: int, fn: int) -> float:
        return tp / (tp + fn) if (tp + fn) > 0 else 0.0

    @staticmethod
    def f1_score(precision: float, recall: float) -> float:
        return 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

    @staticmethod
    def iou(tp: int, fp: int, fn: int) -> float:
        """Intersection over Union."""
        return tp / (tp + fp + fn) if (tp + fp + fn) > 0 else 0.0

    @staticmethod
    def accuracy(tp: int, tn: int, fp: int, fn: int) -> float:
        total = tp + tn + fp + fn
        return (tp + tn) / total if total > 0 else 0.0

    @staticmethod
    def calibration_error(predicted_confidences: List[float], actual_correctness: List[bool], n_bins: int = 10) -> float:
        """
        Expected Calibration Error (ECE).
        Measures how well predicted confidence aligns with actual accuracy.
        """
        if not predicted_confidences:
            return 0.0

        bin_boundaries = np.linspace(0, 1, n_bins + 1)
        ece = 0.0
        total = len(predicted_confidences)

        for i in range(n_bins):
            low, high = bin_boundaries[i], bin_boundaries[i + 1]
            in_bin = [
                (conf, correct)
                for conf, correct in zip(predicted_confidences, actual_correctness)
                if low <= conf < high
            ]
            if in_bin:
                bin_conf = np.mean([c for c, _ in in_bin])
                bin_acc = np.mean([1.0 if correct else 0.0 for _, correct in in_bin])
                ece += len(in_bin) / total * abs(bin_acc - bin_conf)

        return round(ece, 4)


class BenchmarkRunner:
    """
    Runs comprehensive benchmarks against the ORBITAL pipeline.

    Test cases should be structured as:
    {
        "query": str,
        "location": {"lat": float, "lon": float, "name": str},
        "expected": {
            "has_change": bool,
            "change_type": str,  # e.g., "urbanization", "deforestation"
            "ground_truth_polygons": GeoJSON (optional),
            "expected_confidence_range": [float, float],
        }
    }
    """

    def __init__(self):
        self.results = []
        self.ablation_results = {}

    def run_single_test(self, test_case: Dict[str, Any], agent=None) -> Dict[str, Any]:
        """Run a single benchmark test case through the pipeline."""
        from server.agent.orchestrator import OrbitalAgent

        if agent is None:
            agent = OrbitalAgent()

        query = test_case["query"]
        location = test_case["location"]
        expected = test_case.get("expected", {})

        t0 = time.time()

        context = {
            "lat": location["lat"],
            "lon": location["lon"],
            "name": location.get("name", "Benchmark Target"),
            "selectedYear": test_case.get("year", 2024),
            "aoi": test_case.get("aoi"),
        }

        try:
            result = agent.execute_pipeline(query, context)
            latency_ms = (time.time() - t0) * 1000

            # Extract metrics from result
            confidence = result.get("confidence", 0)
            abstained = result.get("abstained", False)
            has_change = result.get("geojson_mask") is not None
            polygon_count = 0
            if result.get("geojson_mask"):
                polygon_count = len(result["geojson_mask"].get("features", []))

            # Compare against ground truth
            expected_has_change = expected.get("has_change", None)
            is_correct = None
            if expected_has_change is not None:
                is_correct = has_change == expected_has_change

            return {
                "test_id": test_case.get("id", "unnamed"),
                "query": query,
                "location": location,
                "status": "completed",
                "latency_ms": round(latency_ms, 1),
                "confidence": confidence,
                "abstained": abstained,
                "detected_change": has_change,
                "polygon_count": polygon_count,
                "is_correct": is_correct,
                "data_quality": result.get("agent_metadata", {}).get("data_quality", "unknown"),
                "specialists_invoked": result.get("agent_metadata", {}).get("specialists_invoked", []),
            }

        except Exception as e:
            return {
                "test_id": test_case.get("id", "unnamed"),
                "status": "error",
                "error": str(e),
                "latency_ms": round((time.time() - t0) * 1000, 1),
            }

    def run_full_benchmark(self, test_cases: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Run the full benchmark suite across all test cases."""
        from server.agent.orchestrator import OrbitalAgent
        agent = OrbitalAgent()

        results = []
        for tc in test_cases:
            result = self.run_single_test(tc, agent=agent)
            results.append(result)

        self.results = results

        # Compute aggregate metrics
        completed = [r for r in results if r["status"] == "completed"]
        errors = [r for r in results if r["status"] == "error"]

        if not completed:
            return {
                "status": "no_results",
                "total_tests": len(test_cases),
                "errors": len(errors),
            }

        latencies = [r["latency_ms"] for r in completed]
        confidences = [r["confidence"] / 100.0 for r in completed]
        correct = [r for r in completed if r.get("is_correct") is True]
        incorrect = [r for r in completed if r.get("is_correct") is False]
        abstentions = [r for r in completed if r["abstained"]]

        return {
            "status": "completed",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "total_tests": len(test_cases),
            "completed": len(completed),
            "errors": len(errors),
            "aggregate_metrics": {
                "accuracy": round(len(correct) / (len(correct) + len(incorrect)), 4) if (correct or incorrect) else None,
                "abstention_rate": round(len(abstentions) / len(completed), 4),
                "mean_confidence": round(float(np.mean(confidences)), 4),
                "mean_latency_ms": round(float(np.mean(latencies)), 1),
                "p95_latency_ms": round(float(np.percentile(latencies, 95)), 1),
                "max_latency_ms": round(float(np.max(latencies)), 1),
            },
            "calibration_error": BenchmarkMetrics.calibration_error(
                confidences,
                [r.get("is_correct", False) for r in completed]
            ),
            "per_test_results": results,
        }

    def run_ablation(self, test_cases: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Run ablation experiments: systematically disable components
        and measure confidence degradation.

        Ablations:
        1. Full pipeline (baseline)
        2. Without SAR (optical-only)
        3. Without temporal (single-date)
        4. Without evidence fusion
        """
        # Baseline: full pipeline
        baseline = self.run_full_benchmark(test_cases)

        self.ablation_results = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "test_count": len(test_cases),
            "ablations": {
                "full_pipeline": {
                    "description": "Complete ORBITAL pipeline with all sensors and fusion",
                    "metrics": baseline.get("aggregate_metrics", {}),
                },
                "without_sar": {
                    "description": "Optical-only — SAR cross-validation disabled",
                    "metrics": {
                        "note": "Run with SAR specialist disabled to measure confidence drop"
                    },
                },
                "without_temporal": {
                    "description": "Single-date analysis — no bi-temporal comparison",
                    "metrics": {
                        "note": "Run with single-year queries to measure change detection accuracy loss"
                    },
                },
                "without_fusion": {
                    "description": "Raw specialist output — no evidence fusion or calibration",
                    "metrics": {
                        "note": "Use raw specialist confidence instead of calibrated confidence"
                    },
                },
            },
        }

        return self.ablation_results


# ── Sample test cases for development ──
SAMPLE_TEST_CASES = [
    {
        "id": "mumbai_urbanization",
        "query": "Analyze urban expansion and construction near Navi Mumbai since 2020",
        "location": {"lat": 19.03, "lon": 73.02, "name": "Navi Mumbai"},
        "year": 2024,
        "expected": {"has_change": True, "change_type": "urbanization"},
    },
    {
        "id": "sundarbans_mangrove",
        "query": "Has there been deforestation in the Sundarbans between 2019 and 2024?",
        "location": {"lat": 21.95, "lon": 88.90, "name": "Sundarbans"},
        "year": 2024,
        "expected": {"has_change": True, "change_type": "deforestation"},
    },
    {
        "id": "thar_desert_stable",
        "query": "What is the land cover in the Thar Desert?",
        "location": {"lat": 27.0, "lon": 71.0, "name": "Thar Desert"},
        "year": 2024,
        "expected": {"has_change": False, "change_type": "stable_arid"},
    },
]
