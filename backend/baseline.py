"""
The actual Merchant Category Hopper detection logic: build a per-customer
"normal" category baseline, then score a recent window of transactions
against it.

This is deliberately plain arithmetic (frequency counting + a weighted sum)
-- no ML libraries needed. That's the point: fast to build, fast to tune,
and easy to explain to judges as "rarity-weighted velocity scoring."

Run this file directly (`python baseline.py`) to see it work against fake
data with no Nessie connection required -- useful for tuning thresholds
before you've even wired up the real API.
"""

from collections import Counter
from dataclasses import dataclass, field


# ---- tune these while testing against your seeded data ----
VELOCITY_WEIGHT = 15      # points per distinct unusual category in the window
RARITY_WEIGHT = 40        # points for how rare the window's categories are on average
FLAG_THRESHOLD = 50       # risk score at/above this gets flagged


@dataclass
class Baseline:
    category_counts: Counter
    total_transactions: int

    def frequency(self, category: str) -> float:
        if self.total_transactions == 0:
            return 0.0
        return self.category_counts.get(category, 0) / self.total_transactions

    def rarity(self, category: str) -> float:
        """1 = category this customer has never used. 0 = category they use constantly."""
        return 1.0 - self.frequency(category)


def build_baseline(purchases: list[dict], category_key: str = "category") -> Baseline:
    """
    purchases: list of dicts, each with at least a category field, e.g.
        {"category": "Groceries", "amount": 42.50, "purchase_date": "2026-08-01"}

    In your real pipeline, `category` will come from joining a purchase's
    merchant_id against /merchants to get that merchant's category -- Nessie
    purchases don't carry category directly. Do that join once when you pull
    the data, then pass plain dicts like the above into this function.
    """
    counts = Counter(p[category_key] for p in purchases)
    return Baseline(category_counts=counts, total_transactions=len(purchases))


@dataclass
class RiskResult:
    score: float
    flagged: bool
    distinct_unusual_categories: list[str]
    explanation: str
    # Ordered, per-transaction detail for the window -- this is what a
    # frontend needs to draw the actual hop-path tiles (one entry per
    # purchase, in order, with that purchase's rarity against the baseline).
    sequence: list[dict] = field(default_factory=list)


def score_window(recent_purchases: list[dict], baseline: Baseline,
                  category_key: str = "category",
                  unusual_rarity_threshold: float = 0.6) -> RiskResult:
    """
    recent_purchases: the sliding window you're checking right now -- e.g.
    the last N transactions, or everything in the last 30-60 minutes.
    """
    categories_in_window = [p[category_key] for p in recent_purchases]

    unusual = [c for c in set(categories_in_window)
               if baseline.rarity(c) >= unusual_rarity_threshold]

    avg_rarity = (
        sum(baseline.rarity(c) for c in categories_in_window) / len(categories_in_window)
        if categories_in_window else 0.0
    )

    score = (len(unusual) * VELOCITY_WEIGHT) + (avg_rarity * RARITY_WEIGHT)
    flagged = score >= FLAG_THRESHOLD

    if flagged:
        seq = " → ".join(categories_in_window)
        explanation = (
            f"{len(unusual)} unusual merchant categor{'y' if len(unusual) == 1 else 'ies'} "
            f"in this burst ({seq}) — this account doesn't normally shop in "
            f"{', '.join(unusual)}."
        )
    else:
        explanation = "Within normal spending pattern for this account."

    sequence = [
        {
            "category": p[category_key],
            "rarity": round(baseline.rarity(p[category_key]), 2),
            "unusual": baseline.rarity(p[category_key]) >= unusual_rarity_threshold,
            "typical_frequency_pct": round(baseline.frequency(p[category_key]) * 100),
        }
        for p in recent_purchases
    ]

    return RiskResult(
        score=round(score, 1),
        flagged=flagged,
        distinct_unusual_categories=unusual,
        explanation=explanation,
        sequence=sequence,
    )


if __name__ == "__main__":
    # Fake "normal" history for a customer who mostly buys groceries, gas,
    # and the occasional coffee.
    history = (
        [{"category": "Groceries"}] * 20
        + [{"category": "Gas"}] * 12
        + [{"category": "Coffee Shops"}] * 8
        + [{"category": "Streaming Services"}] * 3
    )
    baseline = build_baseline(history)

    print("Baseline built from", baseline.total_transactions, "past transactions")
    for cat in ["Groceries", "Gas", "Electronics", "Jewelry", "Gift Cards"]:
        print(f"  rarity({cat}) = {baseline.rarity(cat):.2f}")

    # Normal burst -- should NOT flag
    normal_window = [{"category": "Groceries"}, {"category": "Gas"}]
    result = score_window(normal_window, baseline)
    print("\nNormal window:", result)

    # Fraud-like burst -- SHOULD flag
    fraud_window = [
        {"category": "Gas"},           # small "card test" charge
        {"category": "Electronics"},
        {"category": "Jewelry"},
        {"category": "Gift Cards"},
    ]
    result = score_window(fraud_window, baseline)
    print("\nSuspicious window:", result)
