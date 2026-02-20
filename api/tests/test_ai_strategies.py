"""
Unit tests for AI strategies: medium (heuristic), hard (Monte Carlo), factory.
"""

import random

import pytest

from hearts.game.card import Card, Suit, QUEEN_OF_SPADES_RANK, deck_52, two_of_clubs
from hearts.game.state import GameState, Phase, PassDirection
from hearts.game.rules import get_legal_plays
from hearts.game.transitions import apply_play, apply_passes, _is_first_lead

from hearts.ai.random_ai import RandomPassStrategy, RandomPlayStrategy
from hearts.ai.medium_ai import MediumPassStrategy, MediumPlayStrategy
from hearts.ai.hard_ai import (
    HardPassStrategy,
    HardPlayStrategy,
    RoundTracker,
    _hand_danger,
    _determinize,
)
from hearts.ai.factory import create_strategies


_QS = Card(Suit.SPADES, QUEEN_OF_SPADES_RANK)
_KS = Card(Suit.SPADES, 13)
_AS = Card(Suit.SPADES, 14)
_AH = Card(Suit.HEARTS, 14)
_KH = Card(Suit.HEARTS, 13)
_QH = Card(Suit.HEARTS, 12)


# ---------------------------------------------------------------------------
# Helper: build a playing state from explicit hands
# ---------------------------------------------------------------------------


def _playing_state(
    hands,
    whose_turn=0,
    current_trick=(),
    round_scores=(0, 0, 0, 0),
    hearts_broken=False,
):
    return GameState(
        round=1,
        phase=Phase.PLAYING,
        pass_direction=PassDirection.LEFT,
        hands=tuple(tuple(h) for h in hands),
        current_trick=tuple(current_trick),
        whose_turn=whose_turn,
        scores=(0, 0, 0, 0),
        round_scores=tuple(round_scores),
        hearts_broken=hearts_broken,
        game_over=False,
        winner_index=None,
    )


# ===================================================================
# Medium: pass strategy
# ===================================================================


class TestMediumPassStrategy:
    def test_passes_queen_of_spades(self):
        hand = [
            _QS,
            Card(Suit.CLUBS, 2),
            Card(Suit.CLUBS, 3),
            Card(Suit.CLUBS, 4),
            Card(Suit.DIAMONDS, 2),
            Card(Suit.DIAMONDS, 3),
            Card(Suit.DIAMONDS, 4),
            Card(Suit.HEARTS, 2),
            Card(Suit.HEARTS, 3),
            Card(Suit.HEARTS, 4),
            Card(Suit.SPADES, 2),
            Card(Suit.SPADES, 3),
            Card(Suit.SPADES, 4),
        ]
        strat = MediumPassStrategy()
        passed = strat.choose_cards_to_pass(hand, PassDirection.LEFT)
        assert len(passed) == 3
        assert _QS in passed

    def test_passes_high_spades(self):
        hand = [
            _KS,
            _AS,
            Card(Suit.CLUBS, 2),
            Card(Suit.CLUBS, 3),
            Card(Suit.CLUBS, 4),
            Card(Suit.DIAMONDS, 2),
            Card(Suit.DIAMONDS, 3),
            Card(Suit.DIAMONDS, 4),
            Card(Suit.HEARTS, 2),
            Card(Suit.HEARTS, 3),
            Card(Suit.HEARTS, 4),
            Card(Suit.SPADES, 2),
            Card(Suit.SPADES, 3),
        ]
        strat = MediumPassStrategy()
        passed = strat.choose_cards_to_pass(hand, PassDirection.LEFT)
        assert _KS in passed
        assert _AS in passed

    def test_passes_high_hearts(self):
        hand = [
            _AH,
            _KH,
            _QH,
            Card(Suit.CLUBS, 2),
            Card(Suit.CLUBS, 3),
            Card(Suit.CLUBS, 4),
            Card(Suit.DIAMONDS, 2),
            Card(Suit.DIAMONDS, 3),
            Card(Suit.DIAMONDS, 4),
            Card(Suit.SPADES, 2),
            Card(Suit.SPADES, 3),
            Card(Suit.SPADES, 4),
            Card(Suit.SPADES, 5),
        ]
        strat = MediumPassStrategy()
        passed = strat.choose_cards_to_pass(hand, PassDirection.LEFT)
        assert _AH in passed
        assert _KH in passed

    def test_returns_exactly_3(self):
        rng = random.Random(99)
        hand = [Card(Suit.CLUBS, r) for r in range(2, 15)]
        strat = MediumPassStrategy(rng=rng)
        passed = strat.choose_cards_to_pass(hand, PassDirection.RIGHT)
        assert len(passed) == 3
        assert all(c in hand for c in passed)


# ===================================================================
# Medium: play strategy
# ===================================================================


class TestMediumPlayStrategy:
    def test_leads_low_from_safe_suit(self):
        hand = [
            Card(Suit.CLUBS, 3),
            Card(Suit.CLUBS, 10),
            Card(Suit.DIAMONDS, 5),
            Card(Suit.HEARTS, 2),
        ]
        state = _playing_state(
            [hand, [Card(Suit.CLUBS, 2)], [Card(Suit.CLUBS, 4)], [Card(Suit.CLUBS, 5)]],
            whose_turn=0,
            hearts_broken=True,
        )
        strat = MediumPlayStrategy()
        card = strat.choose_play(state, 0, hand)
        # Should lead from clubs or diamonds (safe suits), not hearts
        assert card.suit in (Suit.CLUBS, Suit.DIAMONDS)

    def test_ducks_when_following(self):
        """When following suit with cards below the current winner, play highest below."""
        trick = [(1, Card(Suit.CLUBS, 10))]
        hand = [Card(Suit.CLUBS, 3), Card(Suit.CLUBS, 7), Card(Suit.CLUBS, 14)]
        state = _playing_state(
            [
                [Card(Suit.CLUBS, 2)],
                [Card(Suit.CLUBS, 10)],
                hand,
                [Card(Suit.CLUBS, 5)],
            ],
            whose_turn=2,
            current_trick=trick,
        )
        in_suit = [c for c in hand if c.suit == Suit.CLUBS]
        strat = MediumPlayStrategy()
        card = strat.choose_play(state, 2, in_suit)
        assert card == Card(Suit.CLUBS, 7)

    def test_dumps_qs_when_void(self):
        """When void in lead suit, dump QS first."""
        trick = [(0, Card(Suit.CLUBS, 5))]
        hand = [_QS, Card(Suit.HEARTS, 3), Card(Suit.DIAMONDS, 8)]
        state = _playing_state(
            [[Card(Suit.CLUBS, 5)], [Card(Suit.CLUBS, 2)], hand, [Card(Suit.CLUBS, 3)]],
            whose_turn=2,
            current_trick=trick,
        )
        strat = MediumPlayStrategy()
        card = strat.choose_play(state, 2, hand)
        assert card == _QS

    def test_dumps_highest_heart_when_void_no_qs(self):
        trick = [(0, Card(Suit.CLUBS, 5))]
        hand = [Card(Suit.HEARTS, 14), Card(Suit.HEARTS, 3), Card(Suit.DIAMONDS, 2)]
        state = _playing_state(
            [[Card(Suit.CLUBS, 5)], [Card(Suit.CLUBS, 2)], hand, [Card(Suit.CLUBS, 3)]],
            whose_turn=2,
            current_trick=trick,
        )
        strat = MediumPlayStrategy()
        card = strat.choose_play(state, 2, hand)
        assert card == Card(Suit.HEARTS, 14)

    def test_forced_to_take_plays_highest(self):
        """When all cards in suit are above trick winner, play highest to dump."""
        trick = [(1, Card(Suit.CLUBS, 3))]
        in_suit = [Card(Suit.CLUBS, 10), Card(Suit.CLUBS, 14)]
        hand = in_suit + [Card(Suit.HEARTS, 2)]
        state = _playing_state(
            [[Card(Suit.CLUBS, 2)], [Card(Suit.CLUBS, 3)], hand, [Card(Suit.CLUBS, 5)]],
            whose_turn=2,
            current_trick=trick,
        )
        strat = MediumPlayStrategy()
        card = strat.choose_play(state, 2, in_suit)
        assert card == Card(Suit.CLUBS, 14)

    def test_single_legal_play_returned(self):
        strat = MediumPlayStrategy()
        card = Card(Suit.CLUBS, 2)
        state = _playing_state(
            [[card], [], [], []],
            whose_turn=0,
        )
        assert strat.choose_play(state, 0, [card]) == card


# ===================================================================
# Hard: pass strategy
# ===================================================================


class TestHardPassStrategy:
    def test_returns_3_valid_cards(self):
        hand = [Card(Suit.CLUBS, r) for r in range(2, 15)]
        strat = HardPassStrategy()
        passed = strat.choose_cards_to_pass(hand, PassDirection.LEFT)
        assert len(passed) == 3
        assert all(c in hand for c in passed)
        assert len(set(passed)) == 3

    def test_prefers_passing_qs(self):
        hand = [
            _QS,
            Card(Suit.CLUBS, 2),
            Card(Suit.CLUBS, 3),
            Card(Suit.CLUBS, 4),
            Card(Suit.CLUBS, 5),
            Card(Suit.DIAMONDS, 2),
            Card(Suit.DIAMONDS, 3),
            Card(Suit.DIAMONDS, 4),
            Card(Suit.HEARTS, 2),
            Card(Suit.HEARTS, 3),
            Card(Suit.SPADES, 2),
            Card(Suit.SPADES, 3),
            Card(Suit.SPADES, 4),
        ]
        strat = HardPassStrategy()
        passed = strat.choose_cards_to_pass(hand, PassDirection.LEFT)
        assert _QS in passed

    def test_hand_danger_lower_without_qs(self):
        hand_with = [
            _QS,
            Card(Suit.CLUBS, 2),
            Card(Suit.CLUBS, 3),
            Card(Suit.CLUBS, 4),
            Card(Suit.CLUBS, 5),
            Card(Suit.DIAMONDS, 2),
            Card(Suit.DIAMONDS, 3),
            Card(Suit.DIAMONDS, 4),
            Card(Suit.HEARTS, 2),
            Card(Suit.HEARTS, 3),
        ]
        hand_without = [c for c in hand_with if c != _QS] + [Card(Suit.SPADES, 2)]
        assert _hand_danger(hand_with) > _hand_danger(hand_without)


# ===================================================================
# Hard: play strategy (integration)
# ===================================================================


class TestHardPlayStrategy:
    def test_single_legal_play_returned(self):
        card = two_of_clubs()
        state = _playing_state(
            [[card], [], [], []],
            whose_turn=0,
        )
        strat = HardPlayStrategy(num_worlds=5)
        assert strat.choose_play(state, 0, [card]) == card

    def test_avoids_taking_qs_trick(self):
        """Given a choice between winning a trick with QS in it vs ducking, prefer ducking."""
        # Trick: player 1 led 5s, player 0 (void) dumped QS
        trick = [
            (1, Card(Suit.SPADES, 5)),
            (0, _QS),
        ]
        # Player 2 has low spade (duck) and high spade (take)
        legal = [Card(Suit.SPADES, 3), Card(Suit.SPADES, 14)]
        dummy_hand = legal + [Card(Suit.CLUBS, r) for r in range(2, 13)]
        state = _playing_state(
            [
                [Card(Suit.DIAMONDS, r) for r in range(2, 15)],
                [Card(Suit.CLUBS, r) for r in range(2, 14)],
                dummy_hand,
                [Card(Suit.HEARTS, r) for r in range(2, 14)],
            ],
            whose_turn=2,
            current_trick=trick,
        )
        strat = HardPlayStrategy(rng=random.Random(1), num_worlds=20)
        card = strat.choose_play(state, 2, legal)
        assert card == Card(Suit.SPADES, 3)

    def test_does_not_peek_at_other_hands(self):
        """The determinization should produce varied opponent hands, not copy the real ones."""
        rng = random.Random(7)
        hands = [
            [Card(Suit.CLUBS, r) for r in range(2, 15)],
            [Card(Suit.DIAMONDS, r) for r in range(2, 15)],
            [Card(Suit.SPADES, r) for r in range(2, 15)],
            [Card(Suit.HEARTS, r) for r in range(2, 15)],
        ]
        state = _playing_state(hands, whose_turn=0)

        # Run multiple determinizations and ensure opponent hands vary
        seen_hands_1: set = set()
        for _ in range(10):
            det = _determinize(state, 0, {}, rng)
            seen_hands_1.add(det.hands[1])

        # With 10 random samples of 13 cards from 39, we should see variation
        assert len(seen_hands_1) > 1


# ===================================================================
# Round tracker
# ===================================================================


class TestRoundTracker:
    def test_detects_void(self):
        tracker = RoundTracker()
        trick = (
            (0, Card(Suit.CLUBS, 5)),
            (1, Card(Suit.HEARTS, 10)),  # player 1 didn't follow clubs
        )
        state = _playing_state(
            [[], [], [], []],
            whose_turn=2,
            current_trick=trick,
        )
        tracker.observe(state)
        assert Suit.CLUBS in tracker.known_voids.get(1, set())

    def test_resets_on_new_round(self):
        tracker = RoundTracker()
        trick = (
            (0, Card(Suit.CLUBS, 5)),
            (1, Card(Suit.HEARTS, 10)),
        )
        state = GameState(
            round=1,
            phase=Phase.PLAYING,
            pass_direction=PassDirection.LEFT,
            hands=((), (), (), ()),
            current_trick=trick,
            whose_turn=2,
            scores=(0, 0, 0, 0),
            round_scores=(0, 0, 0, 0),
            hearts_broken=True,
            game_over=False,
        )
        tracker.observe(state)
        assert Suit.CLUBS in tracker.known_voids.get(1, set())

        state2 = GameState(
            round=2,
            phase=Phase.PLAYING,
            pass_direction=PassDirection.RIGHT,
            hands=((), (), (), ()),
            current_trick=(),
            whose_turn=0,
            scores=(0, 0, 0, 0),
            round_scores=(0, 0, 0, 0),
            hearts_broken=False,
            game_over=False,
        )
        tracker.observe(state2)
        assert 1 not in tracker.known_voids or Suit.CLUBS not in tracker.known_voids[1]


# ===================================================================
# Factory
# ===================================================================


class TestFactory:
    def test_easy(self):
        ps, pl = create_strategies("easy")
        assert isinstance(ps, RandomPassStrategy)
        assert isinstance(pl, RandomPlayStrategy)

    def test_medium(self):
        ps, pl = create_strategies("medium")
        assert isinstance(ps, MediumPassStrategy)
        assert isinstance(pl, MediumPlayStrategy)

    def test_hard(self):
        ps, pl = create_strategies("hard")
        assert isinstance(ps, HardPassStrategy)
        assert isinstance(pl, HardPlayStrategy)
        assert pl._num_worlds == 50

    def test_harder(self):
        ps, pl = create_strategies("harder")
        assert isinstance(ps, HardPassStrategy)
        assert isinstance(pl, HardPlayStrategy)
        assert pl._num_worlds == 100

    def test_hardest(self):
        ps, pl = create_strategies("hardest")
        assert isinstance(ps, HardPassStrategy)
        assert isinstance(pl, HardPlayStrategy)
        assert pl._num_worlds == 150

    def test_case_insensitive(self):
        ps, pl = create_strategies("  Medium  ")
        assert isinstance(ps, MediumPassStrategy)

    def test_unknown_raises(self):
        with pytest.raises(ValueError, match="Unknown difficulty"):
            create_strategies("impossible")


# ===================================================================
# Integration: full round with each difficulty
# ===================================================================


class TestFullRoundIntegration:
    """Smoke-test: run a complete round with each difficulty and verify the
    round_scores sum to 26 (or 0 if no points were taken due to scoring)."""

    @pytest.mark.parametrize(
        "difficulty", ["easy", "medium", "hard", "harder", "hardest"]
    )
    def test_complete_round(self, difficulty):
        from hearts.game.card import shuffle_deck, deal_into_4_hands
        from hearts.game.runner import GameRunner

        rng = random.Random(42)
        ps, pl = create_strategies(difficulty, rng=rng)
        runner = GameRunner.new_game(ps, pl, rng=rng)

        # Auto-pass
        st = runner.get_state_for_frontend()
        if st["phase"] == "passing":
            hand = [Card.from_code(c) for c in st["human_hand"]]
            runner.submit_pass(hand[:3])

        # Play the full round: human plays first legal card, AI auto-plays
        safety = 0
        while safety < 200:
            safety += 1
            st = runner.get_state_for_frontend()
            if st["game_over"] or st["phase"] == "passing":
                break
            if st["whose_turn"] == 0:
                legal = st.get("legal_plays", [])
                if not legal:
                    break
                runner.submit_play(Card.from_code(legal[0]))
            else:
                runner.advance_to_human_turn()

        # After a round, scores should be sane (total points dealt = 26)
        scores = runner.state.scores
        assert sum(scores) in (0, 26, 52, 78, 104)  # multiples of 26
