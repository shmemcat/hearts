"""
Unit tests for Hearts engine: rules, transitions, runner.
No full-game integration test (play to 100).
"""

import pytest

from hearts.game.card import Card, Suit, deck_52, shuffle_deck, deal_into_4_hands, two_of_clubs
from hearts.game.rules import get_legal_plays, get_trick_winner, get_trick_points, is_valid_pass
from hearts.game.state import GameState, Phase, PassDirection, initial_state_after_deal
from hearts.game.transitions import apply_passes, apply_play, apply_round_scoring, deal_new_round, _is_first_lead
from hearts.game.runner import GameRunner
from hearts.ai import RandomPassStrategy, RandomPlayStrategy


# -----------------------------------------------------------------------------
# Rules: get_legal_plays
# -----------------------------------------------------------------------------

class TestGetLegalPlays:
    def test_first_lead_of_round_must_play_2c_if_in_hand(self):
        hand = [two_of_clubs(), Card(Suit.HEARTS, 14), Card(Suit.CLUBS, 10)]
        legal = get_legal_plays(hand, [], False, first_lead_of_round=True)
        assert legal == [two_of_clubs()]

    def test_first_lead_of_round_no_2c_returns_all_legal_leads(self):
        hand = [Card(Suit.CLUBS, 5), Card(Suit.DIAMONDS, 10)]
        legal = get_legal_plays(hand, [], False, first_lead_of_round=True)
        assert set(legal) == set(hand)

    def test_leading_hearts_not_broken_cannot_lead_hearts(self):
        hand = [Card(Suit.HEARTS, 10), Card(Suit.CLUBS, 5)]
        legal = get_legal_plays(hand, [], False)
        assert legal == [Card(Suit.CLUBS, 5)]

    def test_leading_hearts_broken_can_lead_any(self):
        hand = [Card(Suit.HEARTS, 10), Card(Suit.CLUBS, 5)]
        legal = get_legal_plays(hand, [], True)
        assert set(legal) == set(hand)

    def test_leading_only_hearts_can_lead_hearts_even_not_broken(self):
        hand = [Card(Suit.HEARTS, 10), Card(Suit.HEARTS, 14)]
        legal = get_legal_plays(hand, [], False)
        assert set(legal) == set(hand)

    def test_must_follow_suit(self):
        lead = Card(Suit.CLUBS, 5)
        trick = [(0, lead)]
        hand = [Card(Suit.CLUBS, 10), Card(Suit.HEARTS, 14)]
        legal = get_legal_plays(hand, trick, True)
        assert legal == [Card(Suit.CLUBS, 10)]

    def test_void_in_lead_suit_can_play_any(self):
        trick = [(0, Card(Suit.CLUBS, 5))]
        hand = [Card(Suit.HEARTS, 14), Card(Suit.SPADES, 12)]
        legal = get_legal_plays(hand, trick, True)
        assert set(legal) == set(hand)

    def test_empty_hand_returns_empty(self):
        assert get_legal_plays([], [], False) == []


# -----------------------------------------------------------------------------
# Rules: get_trick_winner, get_trick_points
# -----------------------------------------------------------------------------

class TestGetTrickWinner:
    def test_highest_in_lead_suit_wins(self):
        trick = [
            (0, Card(Suit.CLUBS, 5)),
            (1, Card(Suit.CLUBS, 10)),
            (2, Card(Suit.CLUBS, 14)),
            (3, Card(Suit.HEARTS, 13)),
        ]
        assert get_trick_winner(trick, Suit.CLUBS) == 2

    def test_only_lead_suit_cards_compete(self):
        trick = [
            (0, Card(Suit.CLUBS, 14)),
            (1, Card(Suit.HEARTS, 13)),
            (2, Card(Suit.CLUBS, 5)),
            (3, Card(Suit.CLUBS, 10)),
        ]
        assert get_trick_winner(trick, Suit.CLUBS) == 0


class TestGetTrickPoints:
    def test_hearts_one_each(self):
        trick = [(0, Card(Suit.HEARTS, 5)), (1, Card(Suit.HEARTS, 10))]
        assert get_trick_points(trick) == 2

    def test_queen_of_spades_13(self):
        from hearts.game.card import QUEEN_OF_SPADES_RANK
        trick = [(0, Card(Suit.SPADES, QUEEN_OF_SPADES_RANK))]
        assert get_trick_points(trick) == 13

    def test_mixed(self):
        from hearts.game.card import QUEEN_OF_SPADES_RANK
        trick = [
            (0, Card(Suit.HEARTS, 5)),
            (1, Card(Suit.SPADES, QUEEN_OF_SPADES_RANK)),
        ]
        assert get_trick_points(trick) == 14


# -----------------------------------------------------------------------------
# Rules: is_valid_pass
# -----------------------------------------------------------------------------

class TestIsValidPass:
    def test_exactly_three_all_in_hand(self):
        hand = [Card(Suit.CLUBS, 2), Card(Suit.CLUBS, 3), Card(Suit.CLUBS, 4)]
        assert is_valid_pass(hand, hand) is True

    def test_wrong_count_fails(self):
        hand = [Card(Suit.CLUBS, i) for i in range(2, 15)]
        assert is_valid_pass(hand, hand[:2]) is False
        assert is_valid_pass(hand, hand[:4]) is False

    def test_duplicate_fails(self):
        c = Card(Suit.CLUBS, 2)
        hand = [c, Card(Suit.CLUBS, 3), Card(Suit.CLUBS, 4)]
        assert is_valid_pass(hand, [c, c, Card(Suit.CLUBS, 4)]) is False

    def test_card_not_in_hand_fails(self):
        hand = [Card(Suit.CLUBS, 2), Card(Suit.CLUBS, 3), Card(Suit.CLUBS, 4)]
        other = Card(Suit.HEARTS, 5)
        assert is_valid_pass(hand, [hand[0], hand[1], other]) is False


# -----------------------------------------------------------------------------
# Transitions
# -----------------------------------------------------------------------------

class TestApplyPasses:
    def test_distributes_correctly(self, state_passing):
        hands_before = [list(state_passing.hands[i]) for i in range(4)]
        passes = [[hands_before[i][j] for j in range(3)] for i in range(4)]
        state2 = apply_passes(state_passing, passes)
        assert state2.phase == Phase.PLAYING
        for i in range(4):
            assert len(state2.hands[i]) == 13
        assert two_of_clubs() in [c for h in state2.hands for c in h]

    def test_wrong_phase_raises(self, four_hands):
        state = initial_state_after_deal(four_hands, 4, previous_scores=(0, 0, 0, 0))
        assert state.phase == Phase.PLAYING
        passes = [[state.hands[i][j] for j in range(3)] for i in range(4)]
        with pytest.raises(ValueError, match="passing phase"):
            apply_passes(state, passes)


class TestApplyPlay:
    def test_removes_card_from_hand_and_adds_to_trick(self, state_playing_after_pass):
        state = state_playing_after_pass
        player = state.whose_turn
        hand_before = state.hand(player)
        legal = get_legal_plays(
            hand_before, state.trick_list(), state.hearts_broken,
            first_lead_of_round=_is_first_lead(state, hand_before),
        )
        card = legal[0]
        state2 = apply_play(state, player, card)
        assert card not in state2.hand(player)
        assert len(state2.current_trick) == 1
        assert state2.current_trick[0] == (player, card)

    def test_trick_complete_assigns_points_and_next_leader(self, state_playing_after_pass, rng):
        state = state_playing_after_pass
        for _ in range(4):
            player = state.whose_turn
            hand = state.hand(player)
            legal = get_legal_plays(
                hand, state.trick_list(), state.hearts_broken,
                first_lead_of_round=_is_first_lead(state, hand),
            )
            card = rng.choice(legal)
            state = apply_play(state, player, card)
        assert len(state.current_trick) == 0
        assert sum(state.round_scores) >= 0


class TestApplyRoundScoring:
    def test_shoot_the_moon(self):
        state = GameState(
            round=1,
            phase=Phase.PLAYING,
            pass_direction=PassDirection.LEFT,
            hands=((), (), (), ()),
            current_trick=(),
            whose_turn=0,
            scores=(10, 20, 30, 40),
            round_scores=(26, 0, 0, 0),
            hearts_broken=True,
            game_over=False,
            winner_index=None,
        )
        state2 = apply_round_scoring(state)
        assert state2.scores[0] == 10
        assert state2.scores[1] == 46
        assert state2.scores[2] == 56
        assert state2.scores[3] == 66

    def test_game_over_at_100(self):
        state = GameState(
            round=1,
            phase=Phase.PLAYING,
            pass_direction=PassDirection.LEFT,
            hands=((), (), (), ()),
            current_trick=(),
            whose_turn=0,
            scores=(99, 50, 50, 50),
            round_scores=(1, 0, 0, 0),
            hearts_broken=True,
            game_over=False,
            winner_index=None,
        )
        state2 = apply_round_scoring(state)
        assert state2.game_over is True
        assert state2.winner_index == 1


# -----------------------------------------------------------------------------
# Runner: illegal moves rejected, state unchanged
# -----------------------------------------------------------------------------

class TestRunnerRejectsInvalidPass:
    def test_wrong_count_raises_state_unchanged(self):
        runner = GameRunner.new_game(RandomPassStrategy(), RandomPlayStrategy(), rng=__import__("random").Random(1))
        state_before = runner.get_state_for_frontend()
        hand = [Card.from_code(c) for c in state_before["human_hand"]]
        with pytest.raises(ValueError, match="Invalid pass"):
            runner.submit_pass(hand[:2])
        assert runner.get_state_for_frontend()["phase"] == state_before["phase"]
        assert runner.get_state_for_frontend()["human_hand"] == state_before["human_hand"]

    def test_card_not_in_hand_raises_state_unchanged(self):
        runner = GameRunner.new_game(RandomPassStrategy(), RandomPlayStrategy(), rng=__import__("random").Random(2))
        state_before = runner.get_state_for_frontend()
        hand_codes = state_before["human_hand"]
        wrong = [Card.from_code(hand_codes[0]), Card.from_code(hand_codes[1])]
        other = Card(Suit.HEARTS, 14)
        if other.to_code() not in hand_codes:
            wrong.append(other)
        else:
            wrong.append(Card(Suit.SPADES, 14))
        with pytest.raises(ValueError, match="Invalid pass"):
            runner.submit_pass(wrong)
        assert runner.get_state_for_frontend()["human_hand"] == state_before["human_hand"]


class TestRunnerRejectsInvalidPlay:
    def test_illegal_card_raises_state_unchanged(self):
        # Build state where human (0) has 2c and must lead it; playing anything else is illegal
        all_cards = deck_52()
        two_c = two_of_clubs()
        rest = [c for c in all_cards if c != two_c]
        hand0 = [two_c] + rest[:12]
        hand1 = rest[12:25]
        hand2 = rest[25:38]
        hand3 = rest[38:51]
        hands = [hand0, hand1, hand2, hand3]
        state = GameState(
            round=1,
            phase=Phase.PLAYING,
            pass_direction=PassDirection.LEFT,
            hands=tuple(tuple(h) for h in hands),
            current_trick=(),
            whose_turn=0,
            scores=(0, 0, 0, 0),
            round_scores=(0, 0, 0, 0),
            hearts_broken=False,
            game_over=False,
            winner_index=None,
        )
        rng = __import__("random").Random(1)
        runner = GameRunner(state, RandomPassStrategy(rng=rng), RandomPlayStrategy(rng=rng), rng=rng)
        state_before = runner.get_state_for_frontend()
        assert state_before["whose_turn"] == 0
        assert "2c" in state_before["legal_plays"]
        illegal_code = next(c for c in state_before["human_hand"] if c != "2c")
        with pytest.raises(ValueError, match="Illegal"):
            runner.submit_play(Card.from_code(illegal_code))
        state_after = runner.get_state_for_frontend()
        assert state_after["human_hand"] == state_before["human_hand"]

    def test_not_your_turn_raises(self):
        runner = GameRunner.new_game(RandomPassStrategy(), RandomPlayStrategy(), rng=__import__("random").Random(4))
        runner.submit_pass([Card.from_code(c) for c in runner.get_state_for_frontend()["human_hand"][:3]])
        state = runner.get_state_for_frontend()
        if state["whose_turn"] != 0:
            with pytest.raises(ValueError, match="Not your turn"):
                runner.submit_play(Card.from_code(state["human_hand"][0]))


# -----------------------------------------------------------------------------
# Runner: WebSocket-style callbacks (on_play, on_trick_complete, on_done)
# -----------------------------------------------------------------------------

class TestRunnerCallbacks:
    def test_advance_to_human_turn_invokes_callbacks_in_order(self):
        """advance_to_human_turn should emit on_play per card, on_trick_complete after each 4-card trick, on_done once at end."""
        plays = []
        trick_completes = []
        dones = []

        for seed in range(80):
            runner = GameRunner.new_game(
                RandomPassStrategy(), RandomPlayStrategy(), rng=__import__("random").Random(seed)
            )
            runner.submit_pass([Card.from_code(c) for c in runner.get_state_for_frontend()["human_hand"][:3]])
            st = runner.get_state_for_frontend()
            if st["phase"] != "playing" or st["whose_turn"] == 0:
                continue

            plays.clear()
            trick_completes.clear()
            dones.clear()

            def on_play(ev):
                plays.append(ev)

            def on_trick_complete():
                trick_completes.append(1)

            def on_done(state_dict):
                dones.append(state_dict)

            runner.advance_to_human_turn(
                on_play=on_play,
                on_trick_complete=on_trick_complete,
                on_done=on_done,
            )

            assert len(dones) == 1, "on_done should be called exactly once"
            assert dones[0]["whose_turn"] == 0 or dones[0]["phase"] == "passing"
            assert len(plays) == len(runner.get_last_play_events())
            assert all("player_index" in p and "card" in p for p in plays)
            if len(plays) >= 4:
                assert len(trick_completes) >= 1, "at least one full trick should trigger trick_complete"
            return
        pytest.fail("No seed in 0..79 gave AI lead after pass")

    def test_submit_play_invokes_callbacks_in_order(self):
        """submit_play (human then AI until human again) should call on_play, on_trick_complete when trick fills, on_done once."""
        for seed in range(80):
            runner = GameRunner.new_game(
                RandomPassStrategy(), RandomPlayStrategy(), rng=__import__("random").Random(seed)
            )
            runner.submit_pass([Card.from_code(c) for c in runner.get_state_for_frontend()["human_hand"][:3]])
            st = runner.get_state_for_frontend()
            if st["phase"] != "playing" or st["whose_turn"] != 0:
                continue
            legal = st.get("legal_plays", [])
            if not legal:
                continue
            card_code = legal[0]
            plays = []
            trick_completes = []
            dones = []

            def on_play(ev):
                plays.append(ev)

            def on_trick_complete():
                trick_completes.append(1)

            def on_done(state_dict):
                dones.append(state_dict)

            runner.submit_play(
                Card.from_code(card_code),
                on_play=on_play,
                on_trick_complete=on_trick_complete,
                on_done=on_done,
            )

            assert len(dones) == 1
            assert dones[0]["whose_turn"] == 0 or dones[0]["phase"] == "passing"
            assert len(plays) == len(runner.get_last_play_events())
            assert plays[0]["player_index"] == 0 and plays[0]["card"] == card_code
            return
        pytest.fail("No seed in 0..79 gave human lead after pass with legal plays")
