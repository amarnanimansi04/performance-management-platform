from datetime import date
from typing import Optional


def clamp(val: float, lo: float = 0, hi: float = 100) -> float:
    return max(lo, min(hi, val))


def calc_score(
    uom_type: str,
    direction: Optional[str],
    baseline: float,
    target: float,
    actual: float,
    planned_date: Optional[date] = None,
    actual_date: Optional[date] = None,
) -> float:
    if uom_type == "timeline":
        if planned_date and actual_date:
            return 100.0 if actual_date <= planned_date else 0.0
        return 0.0

    if uom_type == "zero_based":
        if actual == 0:
            return 100.0
        return clamp((1 - actual / baseline) * 100) if baseline != 0 else 0.0

    # numeric or percent
    if direction == "higher":
        denom = target - baseline
        if denom == 0:
            return 100.0 if actual >= target else 0.0
        return clamp((actual - baseline) / denom * 100)

    if direction == "lower":
        denom = baseline - target
        if denom == 0:
            return 100.0 if actual <= target else 0.0
        return clamp((baseline - actual) / denom * 100)

    return 0.0


def calc_overall_score(goals: list[dict]) -> float:
    total_weight = sum(g.get("weightage", 0) for g in goals)
    if total_weight == 0:
        return 0.0
    weighted_sum = sum(
        g.get("score", 0) * g.get("weightage", 0) for g in goals
    )
    return weighted_sum / total_weight


def predict_q4_score(q1: Optional[float], q2: Optional[float]) -> Optional[float]:
    if q1 is None or q2 is None:
        return None
    predicted = q2 + (q2 - q1) * 2
    return clamp(predicted)


def get_risk_status(predicted: Optional[float]) -> str:
    if predicted is None:
        return "behind"
    if predicted >= 85:
        return "on_track"
    if predicted >= 65:
        return "at_risk"
    return "behind"


def calc_ambition_score(uom_type: str, baseline: float, target: float) -> float:
    if uom_type in ("timeline", "zero_based"):
        return 50.0

    if baseline == 0:
        return clamp(abs(target) * 10)

    stretch_pct = abs((target - baseline) / baseline) * 100
    return clamp(stretch_pct)


def get_nine_box_quadrant(performance: float, ambition: float) -> str:
    if performance >= 67:
        perf_band = "high"
    elif performance >= 34:
        perf_band = "mid"
    else:
        perf_band = "low"

    if ambition >= 67:
        amb_band = "high"
    elif ambition >= 34:
        amb_band = "mid"
    else:
        amb_band = "low"

    labels = {
        ("high", "high"): "Star",
        ("high", "mid"): "High Performer",
        ("high", "low"): "Reliable Performer",
        ("mid", "high"): "High Potential",
        ("mid", "mid"): "Core Player",
        ("mid", "low"): "Effective",
        ("low", "high"): "Risk",
        ("low", "mid"): "Needs Coaching",
        ("low", "low"): "Underperformer",
    }
    return labels[(perf_band, amb_band)]


def validate_weightage(weightages: list[float]) -> dict:
    total = sum(weightages)
    valid = abs(total - 100.0) < 0.01
    message = "Weightage is valid." if valid else f"Weightage sums to {total:.2f}, must equal 100."
    return {"total": total, "valid": valid, "message": message}
