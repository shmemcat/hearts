"""
Hard AI: determinized Monte Carlo with fair play (no peeking at opponent hands).

Uses Information Set Monte Carlo sampling: for each decision, generates possible
worlds consistent with known information, simulates with medium strategy, and
picks the move with the lowest expected score.
"""

import random
from collections import defaultdict
from itertools import combinations
from typing import Dict, List, Optional, Set, Tuple

from hearts.game.card import Card, Suit, QUEEN_OF_SPADES_RANK, deck_52
from hearts.game.state import GameState, PassDirection
from hearts.game.rules import get_legal_plays
from hearts.game.transitions import apply_play, _is_first_lead, _is_first_trick_of_round

from hearts.ai.base import PassStrategy, PlayStrategy
from hearts.ai.medium_ai import MediumPlayStrategy

_QS = Card(Suit.SPADES, QUEEN_OF_SPADES_RANK)
_ALL_CARDS = set(deck_52())

NUM_DETERMINIZATIONS = 75


# ---------------------------------------------------------------------------
# Round tracker: observes voids from trick play
# ---------------------------------------------------------------------------

class RoundTracker:
    """Lightweight tracker for void information, reset each round.

    Called at every ``choose_play`` invocation (shared strategy sees all AI
    turns).  Detects when a player fails to follow suit and records the void.
    """

    def __init__(self) -> None:
        self._round: int = -1
        self._known_voids: Dict[int, Set[Suit]] = {}

    def observe(self, state: GameState) -> None:
        if state.round != self._round:
            self._round = state.round
            self._known_voids = {i: set() for i in range(4)}

        trick = state.current_trick
        if len(trick) >= 2:
            lead_suit = trick[0][1].suit
            for pi, card in trick[1:]:
                if card.suit != lead_suit:
                    self._known_voids.setdefault(pi, set()).add(lead_suit)

    @property
    def known_voids(self) -> Dict[int, Set[Suit]]:
        return {k: set(v) for k, v in self._known_voids.items()}


# ---------------------------------------------------------------------------
# Determinization: deal unknown cards to opponents
# ---------------------------------------------------------------------------

def _determinize(
    state: GameState,
    player_index: int,
    voids: Dict[int, Set[Suit]],
    rng: random.Random,
) -> GameState:
    """Build a plausible state by randomly assigning unknown cards to opponents.

    Respects known void constraints (best-effort).  The AI's own hand and the
    current trick remain unchanged.
    """
    my_hand = set(state.hands[player_index])
    trick_cards = {card for _, card in state.current_trick}
    unknown = list(_ALL_CARDS - my_hand - trick_cards)
    rng.shuffle(unknown)

    my_hand_size = len(state.hands[player_index])
    trick_players = {pi for pi, _ in state.current_trick}
    opponents = [j for j in range(4) if j != player_index]

    sizes: Dict[int, int] = {}
    for j in opponents:
        sizes[j] = my_hand_size - 1 if j in trick_players else my_hand_size

    # Deal to most-constrained opponents first
    opp_order = sorted(
        opponents,
        key=lambda j: len(voids.get(j, set())),
        reverse=True,
    )

    dealt: Dict[int, List[Card]] = {}
    used: Set[Card] = set()

    for j in opp_order:
        void_suits = voids.get(j, set())
        eligible = [c for c in unknown if c not in used and c.suit not in void_suits]
        need = sizes[j]
        if len(eligible) < need:
            # Relax constraint if not satisfiable (very rare)
            eligible = [c for c in unknown if c not in used]
        dealt[j] = eligible[:need]
        used.update(dealt[j])

    new_hands: List[List[Card]] = [[] for _ in range(4)]
    new_hands[player_index] = list(state.hands[player_index])
    for j in opponents:
        new_hands[j] = dealt[j]

    return GameState(
        round=state.round,
        phase=state.phase,
        pass_direction=state.pass_direction,
        hands=tuple(tuple(h) for h in new_hands),
        current_trick=state.current_trick,
        whose_turn=state.whose_turn,
        scores=state.scores,
        round_scores=state.round_scores,
        hearts_broken=state.hearts_broken,
        game_over=state.game_over,
        winner_index=state.winner_index,
    )


# ---------------------------------------------------------------------------
# Simulation: play out remaining tricks using medium strategy
# ---------------------------------------------------------------------------

def _simulate_remaining(
    state: GameState,
    rollout: PlayStrategy,
) -> Tuple[int, ...]:
    """Play out remaining tricks, return final ``round_scores``."""
    while True:
        total_cards = sum(len(state.hands[i]) for i in range(4))
        if total_cards == 0:
            break

        player = state.whose_turn
        hand = state.hand(player)
        if not hand:
            break

        trick = state.trick_list()
        first_lead = _is_first_lead(state, hand)
        legal = get_legal_plays(
            hand, trick, state.hearts_broken,
            first_lead_of_round=first_lead,
            first_trick=_is_first_trick_of_round(state),
        )
        if not legal:
            break

        card = rollout.choose_play(state, player, legal)
        state = apply_play(state, player, card)

    return state.round_scores


def _evaluate_round_scores(
    scores: Tuple[int, ...],
    player_index: int,
) -> float:
    """Convert raw round_scores into the effective score for *player_index*.

    Accounts for shoot-the-moon: a player with 26 gets 0, others get +26.
    """
    if any(s == 26 for s in scores):
        return 0.0 if scores[player_index] == 26 else 26.0
    return float(scores[player_index])


# ---------------------------------------------------------------------------
# Hard pass strategy
# ---------------------------------------------------------------------------

def _hand_danger(hand: List[Card]) -> float:
    """Evaluate how dangerous a hand is.  Lower = safer."""
    score = 0.0

    # QS danger (mitigated by having many low spades to cover)
    if _QS in hand:
        low_spades = sum(
            1 for c in hand
            if c.suit == Suit.SPADES and c.rank < QUEEN_OF_SPADES_RANK
        )
        score += max(15.0 - low_spades * 2.0, 5.0)

    # King / Ace of spades sit above QS
    for c in hand:
        if c.suit == Suit.SPADES and c.rank > QUEEN_OF_SPADES_RANK:
            score += 10.0

    # High hearts are direct point liabilities
    for c in hand:
        if c.suit == Suit.HEARTS and c.rank > 6:
            score += (c.rank - 6) * 0.8

    # Void potential: fewer suits present = more dumping opportunities
    suits_present = len({c.suit for c in hand})
    score -= (4 - suits_present) * 5.0

    # Short-suit bonus (close to creating a void)
    for suit in Suit:
        count = sum(1 for c in hand if c.suit == suit)
        if count == 1:
            score -= 3.0
        elif count == 2:
            score -= 1.0

    return score


class HardPassStrategy(PassStrategy):
    """Evaluate all C(13,3) = 286 pass combos; keep the safest hand."""

    def __init__(self, rng: Optional[random.Random] = None) -> None:
        self._rng = rng or random.Random()

    def choose_cards_to_pass(
        self,
        hand: List[Card],
        direction: PassDirection,
    ) -> List[Card]:
        if len(hand) < 3:
            raise ValueError("Hand must have at least 3 cards to pass")

        best_score = float("inf")
        best_pass: Optional[List[Card]] = None

        for combo in combinations(hand, 3):
            remaining = [c for c in hand if c not in combo]
            danger = _hand_danger(remaining)
            if danger < best_score:
                best_score = danger
                best_pass = list(combo)

        assert best_pass is not None
        return best_pass


# ---------------------------------------------------------------------------
# Hard play strategy
# ---------------------------------------------------------------------------

class HardPlayStrategy(PlayStrategy):
    """Determinized Monte Carlo: sample possible worlds, simulate, pick best."""

    def __init__(
        self,
        rng: Optional[random.Random] = None,
        num_worlds: int = NUM_DETERMINIZATIONS,
    ) -> None:
        self._rng = rng or random.Random()
        self._num_worlds = num_worlds
        self._tracker = RoundTracker()
        # Separate RNG for rollout so it doesn't perturb the main RNG
        self._rollout = MediumPlayStrategy(rng=random.Random(42))

    def choose_play(
        self,
        state: GameState,
        player_index: int,
        legal_plays: List[Card],
    ) -> Card:
        if not legal_plays:
            raise ValueError("No legal plays")
        if len(legal_plays) == 1:
            return legal_plays[0]

        self._tracker.observe(state)
        voids = self._tracker.known_voids

        best_card = legal_plays[0]
        best_avg = float("inf")

        for card in legal_plays:
            total_score = 0.0

            for _ in range(self._num_worlds):
                sim_state = _determinize(state, player_index, voids, self._rng)
                sim_state = apply_play(sim_state, player_index, card)
                final_scores = _simulate_remaining(sim_state, self._rollout)
                total_score += _evaluate_round_scores(final_scores, player_index)

            avg = total_score / self._num_worlds
            if avg < best_avg:
                best_avg = avg
                best_card = card

        return best_card
