"""
ORBITAL Execution Audit Trace
Generates structured, traceable logs of every tool call, model decision, and intermediate output.
"""

from typing import List, Dict, Any
from datetime import datetime


class AuditTrail:
    def __init__(self, query: str, context: Dict[str, Any]):
        self.query = query
        self.context = context
        self.start_time = datetime.utcnow().isoformat() + "Z"
        self.steps: List[Dict[str, Any]] = []

    def log_step(self, step_name: str, tool_name: str, inputs: Dict[str, Any], outputs: Dict[str, Any], duration_ms: float):
        self.steps.append({
            "step_index": len(self.steps) + 1,
            "step_name": step_name,
            "tool_invoked": tool_name,
            "inputs": inputs,
            "outputs_summary": outputs,
            "latency_ms": round(duration_ms, 1),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        })

    def export_trace(self, final_confidence: float, abstained: bool) -> Dict[str, Any]:
        return {
            "query": self.query,
            "session_start": self.start_time,
            "session_completed": datetime.utcnow().isoformat() + "Z",
            "total_agent_steps": len(self.steps),
            "calibrated_confidence": final_confidence,
            "abstained": abstained,
            "execution_graph": self.steps,
            "system": "ORBITAL Agentic Engine v1.0 (SIH26167 Compliant)"
        }
