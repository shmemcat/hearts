"""Factory function to create AI strategy pairs by difficulty level."""

import random
from typing import Optional, Tuple

from hearts.ai.base import PassStrategy, PlayStrategy
from hearts.ai.random_ai import RandomPassStrategy, RandomPlayStrategy
from hearts.ai.medium_ai import MediumPassStrategy, MediumPlayStrategy
from hearts.ai.hard_ai import HardPassStrategy, HardPlayStrategy


def create_strategies(
    difficulty: str = "easy",
    rng: Optional[random.Random] = None,
) -> Tuple[PassStrategy, PlayStrategy]:
    """Return (PassStrategy, PlayStrategy) for the given difficulty level.

    Valid levels: ``"easy"``, ``"medium"``, ``"hard"``.
    """
    difficulty = difficulty.lower().strip()

    if difficulty == "easy":
        return RandomPassStrategy(rng=rng), RandomPlayStrategy(rng=rng)
    if difficulty == "medium":
        return MediumPassStrategy(rng=rng), MediumPlayStrategy(rng=rng)
    if difficulty == "hard":
        return HardPassStrategy(rng=rng), HardPlayStrategy(rng=rng)

    raise ValueError(
        f"Unknown difficulty: {difficulty!r}. Use 'easy', 'medium', or 'hard'."
    )
