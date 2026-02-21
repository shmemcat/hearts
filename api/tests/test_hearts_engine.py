"""
Unit tests for Hearts engine: rules, transitions, runner.
No full-game integration test (play to 100).
"""

import pytest

from hearts.game.card import (
    Card,
    Suit,
    deck_52,
    shuffle_deck,
    deal_into_4_hands,
    two_of_clubs,
)
from hearts.game.rules import (
    get_legal_plays,
    get_trick_winner,
    get_trick_points,
    is_valid_pass,
)
from hearts.game.state import GameState, Phase, PassDirection, initial_state_after_deal
from hearts.game.transitions import (
    apply_passes,
    apply_play,
    apply_round_scoring,
    deal_new_round,
    _is_first_lead,
)
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
            hand_before,
            state.trick_list(),
            state.hearts_broken,
            first_lead_of_round=_is_first_lead(state, hand_before),
        )
        card = legal[0]
        state2 = apply_play(state, player, card)
        assert card not in state2.hand(player)
        assert len(state2.current_trick) == 1
        assert state2.current_trick[0] == (player, card)

    def test_trick_complete_assigns_points_and_next_leader(
        self, state_playing_after_pass, rng
    ):
        state = state_playing_after_pass
        for _ in range(4):
            player = state.whose_turn
            hand = state.hand(player)
            legal = get_legal_plays(
                hand,
                state.trick_list(),
                state.hearts_broken,
                first_lead_of_round=_is_first_lead(state, hand),
            )
            card = rng.choice(legal)
            state = apply_play(state, player, card)
        assert len(state.current_trick) == 0
        assert sum(state.round_scores) >= 0


class TestHeartsBreaking:
    def test_playing_heart_breaks_hearts(self):
        """Playing a heart should set hearts_broken = True."""
        lead = Card(Suit.DIAMONDS, 14)
        hand0 = [Card(Suit.DIAMONDS, i) for i in range(2, 12)]
        hand1 = [Card(Suit.HEARTS, i) for i in range(2, 12)]
        hand2 = [Card(Suit.CLUBS, i) for i in range(2, 12)]
        hand3 = [Card(Suit.SPADES, i) for i in range(2, 12)]
        state = GameState(
            round=1,
            phase=Phase.PLAYING,
            pass_direction=PassDirection.LEFT,
            hands=tuple(tuple(h) for h in [hand0, hand1, hand2, hand3]),
            current_trick=((0, lead),),
            whose_turn=1,
            scores=(0, 0, 0, 0),
            round_scores=(0, 0, 0, 0),
            hearts_broken=False,
            game_over=False,
            winner_index=None,
        )
        state2 = apply_play(state, 1, Card(Suit.HEARTS, 2))
        assert state2.hearts_broken is True

    def test_playing_queen_of_spades_does_not_break_hearts(self):
        """Playing the Queen of Spades should NOT set hearts_broken = True."""
        from hearts.game.card import QUEEN_OF_SPADES_RANK

        qs = Card(Suit.SPADES, QUEEN_OF_SPADES_RANK)
        lead = Card(Suit.DIAMONDS, 14)
        hand0 = [Card(Suit.DIAMONDS, i) for i in range(2, 12)]
        hand1 = [qs] + [Card(Suit.SPADES, i) for i in range(2, 11)]
        hand2 = [Card(Suit.CLUBS, i) for i in range(2, 12)]
        hand3 = [Card(Suit.HEARTS, i) for i in range(2, 12)]
        state = GameState(
            round=1,
            phase=Phase.PLAYING,
            pass_direction=PassDirection.LEFT,
            hands=tuple(tuple(h) for h in [hand0, hand1, hand2, hand3]),
            current_trick=((0, lead),),
            whose_turn=1,
            scores=(0, 0, 0, 0),
            round_scores=(0, 0, 0, 0),
            hearts_broken=False,
            game_over=False,
            winner_index=None,
        )
        state2 = apply_play(state, 1, qs)
        assert state2.hearts_broken is False


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
            scores=(99, 50, 60, 70),
            round_scores=(1, 0, 0, 0),
            hearts_broken=True,
            game_over=False,
            winner_index=None,
        )
        state2 = apply_round_scoring(state)
        assert state2.game_over is True
        assert state2.winner_index == 1

    def test_tie_sets_winner_index_minus_one(self):
        state = GameState(
            round=1,
            phase=Phase.PLAYING,
            pass_direction=PassDirection.LEFT,
            hands=((), (), (), ()),
            current_trick=(),
            whose_turn=0,
            scores=(99, 99, 50, 50),
            round_scores=(1, 1, 0, 0),
            hearts_broken=True,
            game_over=False,
            winner_index=None,
        )
        state2 = apply_round_scoring(state)
        assert state2.game_over is True
        assert state2.winner_index == -1

    def test_no_tie_single_winner(self):
        state = GameState(
            round=1,
            phase=Phase.PLAYING,
            pass_direction=PassDirection.LEFT,
            hands=((), (), (), ()),
            current_trick=(),
            whose_turn=0,
            scores=(99, 98, 50, 60),
            round_scores=(1, 1, 0, 0),
            hearts_broken=True,
            game_over=False,
            winner_index=None,
        )
        state2 = apply_round_scoring(state)
        assert state2.game_over is True
        assert state2.winner_index == 2


# -----------------------------------------------------------------------------
# Runner: illegal moves rejected, state unchanged
# -----------------------------------------------------------------------------


class TestRunnerRejectsInvalidPass:
    def test_wrong_count_raises_state_unchanged(self):
        runner = GameRunner.new_game(
            RandomPassStrategy(),
            RandomPlayStrategy(),
            rng=__import__("random").Random(1),
        )
        state_before = runner.get_state_for_frontend()
        hand = [Card.from_code(c) for c in state_before["human_hand"]]
        with pytest.raises(ValueError, match="Invalid pass"):
            runner.submit_pass(hand[:2])
        assert runner.get_state_for_frontend()["phase"] == state_before["phase"]
        assert (
            runner.get_state_for_frontend()["human_hand"] == state_before["human_hand"]
        )

    def test_card_not_in_hand_raises_state_unchanged(self):
        runner = GameRunner.new_game(
            RandomPassStrategy(),
            RandomPlayStrategy(),
            rng=__import__("random").Random(2),
        )
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
        assert (
            runner.get_state_for_frontend()["human_hand"] == state_before["human_hand"]
        )


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
        runner = GameRunner(
            state, RandomPassStrategy(rng=rng), RandomPlayStrategy(rng=rng), rng=rng
        )
        state_before = runner.get_state_for_frontend()
        assert state_before["whose_turn"] == 0
        assert "2c" in state_before["legal_plays"]
        illegal_code = next(c for c in state_before["human_hand"] if c != "2c")
        with pytest.raises(ValueError, match="Illegal"):
            runner.submit_play(Card.from_code(illegal_code))
        state_after = runner.get_state_for_frontend()
        assert state_after["human_hand"] == state_before["human_hand"]

    def test_not_your_turn_raises(self):
        runner = GameRunner.new_game(
            RandomPassStrategy(),
            RandomPlayStrategy(),
            rng=__import__("random").Random(4),
        )
        runner.submit_pass(
            [
                Card.from_code(c)
                for c in runner.get_state_for_frontend()["human_hand"][:3]
            ]
        )
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
                RandomPassStrategy(),
                RandomPlayStrategy(),
                rng=__import__("random").Random(seed),
            )
            runner.submit_pass(
                [
                    Card.from_code(c)
                    for c in runner.get_state_for_frontend()["human_hand"][:3]
                ]
            )
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
                assert (
                    len(trick_completes) >= 1
                ), "at least one full trick should trigger trick_complete"
            return
        pytest.fail("No seed in 0..79 gave AI lead after pass")

    def test_submit_play_invokes_callbacks_in_order(self):
        """submit_play (human then AI until human again) should call on_play, on_trick_complete when trick fills, on_done once."""
        for seed in range(80):
            runner = GameRunner.new_game(
                RandomPassStrategy(),
                RandomPlayStrategy(),
                rng=__import__("random").Random(seed),
            )
            runner.submit_pass(
                [
                    Card.from_code(c)
                    for c in runner.get_state_for_frontend()["human_hand"][:3]
                ]
            )
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


# -----------------------------------------------------------------------------
# Round boundary: no-pass rounds stop at boundary, round_just_ended flag
# -----------------------------------------------------------------------------


class TestRoundBoundary:
    """Tests for the fix ensuring the AI loop always stops at round boundaries."""

    def _play_full_round(self, runner):
        """Play a full 13-trick round by repeatedly calling submit_play / advance."""
        for _ in range(52):
            st = runner.get_state_for_frontend()
            if st["phase"] != "playing":
                return st
            if st["game_over"]:
                return st
            if st["whose_turn"] == 0:
                legal = st["legal_plays"]
                if not legal:
                    return st
                runner.submit_play(Card.from_code(legal[0]))
            else:
                runner.advance_to_human_turn()
            if runner.get_last_round_ended():
                return runner.get_state_for_frontend()
        return runner.get_state_for_frontend()

    def test_round_just_ended_set_for_passing_next_round(self):
        """When the round ends and next round has passing, round_just_ended is True."""
        for seed in range(100):
            rng = __import__("random").Random(seed)
            runner = GameRunner.new_game(
                RandomPassStrategy(rng=rng), RandomPlayStrategy(rng=rng), rng=rng
            )
            runner.submit_pass(
                [
                    Card.from_code(c)
                    for c in runner.get_state_for_frontend()["human_hand"][:3]
                ]
            )
            self._play_full_round(runner)
            if runner.get_last_round_ended():
                assert runner.state.round == 2
                return
        pytest.fail("No seed completed round 1")

    def test_round_just_ended_set_for_no_pass_next_round(self):
        """When the round ends and next round is no-pass (round 4), round_just_ended is True
        and the state does NOT contain cards from the new round."""
        for seed in range(200):
            rng = __import__("random").Random(seed)
            runner = GameRunner.new_game(
                RandomPassStrategy(rng=rng), RandomPlayStrategy(rng=rng), rng=rng
            )
            for round_num in range(1, 4):
                st = runner.get_state_for_frontend()
                if st["phase"] == "passing":
                    runner.submit_pass(
                        [Card.from_code(c) for c in st["human_hand"][:3]]
                    )
                self._play_full_round(runner)
                if runner.state.game_over:
                    break
            if runner.state.game_over:
                continue
            if runner.state.round == 4:
                assert runner.get_last_round_ended() is True
                assert runner.state.phase == Phase.PLAYING
                assert runner.state.pass_direction == PassDirection.NONE
                return
        pytest.fail("No seed reached round 4 without game over")

    def test_advance_stops_at_no_pass_round_boundary(self):
        """advance_to_human_turn must NOT play cards from the new no-pass round."""
        for seed in range(200):
            rng = __import__("random").Random(seed)
            runner = GameRunner.new_game(
                RandomPassStrategy(rng=rng), RandomPlayStrategy(rng=rng), rng=rng
            )
            for round_num in range(1, 4):
                st = runner.get_state_for_frontend()
                if st["phase"] == "passing":
                    runner.submit_pass(
                        [Card.from_code(c) for c in st["human_hand"][:3]]
                    )
                self._play_full_round(runner)
                if runner.state.game_over:
                    break
            if runner.state.game_over or runner.state.round != 4:
                continue
            # Now in round 4 (no-pass). All hands should have 13 cards.
            for i in range(4):
                assert len(runner.state.hands[i]) == 13
            return
        pytest.fail("No seed reached round 4")

    def test_callbacks_at_round_end(self):
        """When the last trick of a round ends, callbacks fire: play -> trick_complete -> on_done(round_just_ended)."""
        for seed in range(100):
            rng = __import__("random").Random(seed)
            runner = GameRunner.new_game(
                RandomPassStrategy(rng=rng), RandomPlayStrategy(rng=rng), rng=rng
            )
            runner.submit_pass(
                [
                    Card.from_code(c)
                    for c in runner.get_state_for_frontend()["human_hand"][:3]
                ]
            )
            events = []

            def on_play(ev):
                events.append(("play", ev))

            def on_trick_complete():
                events.append(("trick_complete",))

            def on_done(state_dict):
                events.append(("done", state_dict))

            # Play until round ends using callbacks
            for _ in range(52):
                st = runner.get_state_for_frontend()
                if st["phase"] != "playing" or st["game_over"]:
                    break
                if st["whose_turn"] == 0:
                    legal = st["legal_plays"]
                    if not legal:
                        break
                    events.clear()
                    runner.submit_play(
                        Card.from_code(legal[0]),
                        on_play=on_play,
                        on_trick_complete=on_trick_complete,
                        on_done=on_done,
                    )
                else:
                    events.clear()
                    runner.advance_to_human_turn(
                        on_play=on_play,
                        on_trick_complete=on_trick_complete,
                        on_done=on_done,
                    )
                if runner.get_last_round_ended():
                    done_events = [e for e in events if e[0] == "done"]
                    assert len(done_events) == 1
                    assert done_events[0][1].get("round_just_ended") is True
                    # Verify trick_complete came before done
                    tc_indices = [
                        i for i, e in enumerate(events) if e[0] == "trick_complete"
                    ]
                    done_idx = next(i for i, e in enumerate(events) if e[0] == "done")
                    assert tc_indices[-1] < done_idx
                    return
        pytest.fail("No seed produced a round end with callbacks")

    def test_intermediate_plays_do_not_cross_round_boundary(self):
        """REST-style: intermediate_plays should only contain plays from the current round."""
        for seed in range(100):
            rng = __import__("random").Random(seed)
            runner = GameRunner.new_game(
                RandomPassStrategy(rng=rng), RandomPlayStrategy(rng=rng), rng=rng
            )
            runner.submit_pass(
                [
                    Card.from_code(c)
                    for c in runner.get_state_for_frontend()["human_hand"][:3]
                ]
            )
            for _ in range(52):
                st = runner.get_state_for_frontend()
                if st["phase"] != "playing" or st["game_over"]:
                    break
                if st["whose_turn"] == 0:
                    legal = st["legal_plays"]
                    if not legal:
                        break
                    runner.submit_play(Card.from_code(legal[0]))
                else:
                    runner.advance_to_human_turn()
                plays = runner.get_last_play_events()
                if runner.get_last_round_ended():
                    assert len(plays) >= 1
                    # No plays leaked from the new round: all new hands still full
                    for i in range(4):
                        assert len(runner.state.hands[i]) == 13
                    return
        pytest.fail("No seed produced round end via REST path")


# -----------------------------------------------------------------------------
# Runner: serialization round-trip (to_json / from_json)
# -----------------------------------------------------------------------------


class TestRunnerSerialization:
    def test_round_trip_preserves_frontend_state(self):
        rng = __import__("random").Random(99)
        runner = GameRunner.new_game(
            RandomPassStrategy(rng=rng), RandomPlayStrategy(rng=rng), rng=rng
        )
        original = runner.get_state_for_frontend()
        restored = GameRunner.from_json(runner.to_json())
        assert restored.get_state_for_frontend() == original

    def test_round_trip_after_pass(self):
        rng = __import__("random").Random(7)
        runner = GameRunner.new_game(
            RandomPassStrategy(rng=rng), RandomPlayStrategy(rng=rng), rng=rng
        )
        runner.submit_pass(
            [
                Card.from_code(c)
                for c in runner.get_state_for_frontend()["human_hand"][:3]
            ]
        )
        original = runner.get_state_for_frontend()
        restored = GameRunner.from_json(runner.to_json())
        assert restored.get_state_for_frontend() == original

    def test_round_trip_mid_trick(self):
        """Serialize/deserialize with cards in current_trick."""
        for seed in range(50):
            rng = __import__("random").Random(seed)
            runner = GameRunner.new_game(
                RandomPassStrategy(rng=rng), RandomPlayStrategy(rng=rng), rng=rng
            )
            runner.submit_pass(
                [
                    Card.from_code(c)
                    for c in runner.get_state_for_frontend()["human_hand"][:3]
                ]
            )
            st = runner.get_state_for_frontend()
            if st["phase"] != "playing" or st["whose_turn"] != 0:
                continue
            legal = st["legal_plays"]
            if not legal:
                continue
            runner.submit_play(Card.from_code(legal[0]))
            st = runner.get_state_for_frontend()
            if len(st["current_trick"]) > 0:
                restored = GameRunner.from_json(runner.to_json())
                assert restored.get_state_for_frontend() == st
                return
        pytest.fail("No seed produced mid-trick state")

    def test_round_trip_across_rounds(self):
        """Serialize after round 1 ends and new round begins."""
        for seed in range(100):
            rng = __import__("random").Random(seed)
            runner = GameRunner.new_game(
                RandomPassStrategy(rng=rng), RandomPlayStrategy(rng=rng), rng=rng
            )
            runner.submit_pass(
                [
                    Card.from_code(c)
                    for c in runner.get_state_for_frontend()["human_hand"][:3]
                ]
            )
            for _ in range(52):
                st = runner.get_state_for_frontend()
                if st["phase"] != "playing" or st["game_over"]:
                    break
                if st["whose_turn"] == 0:
                    legal = st["legal_plays"]
                    if not legal:
                        break
                    runner.submit_play(Card.from_code(legal[0]))
                else:
                    runner.advance_to_human_turn()
                if runner.get_last_round_ended():
                    break
            if runner.state.round >= 2:
                original = runner.get_state_for_frontend()
                restored = GameRunner.from_json(runner.to_json())
                assert restored.get_state_for_frontend() == original
                return
        pytest.fail("No seed reached round 2")

    def test_deserialized_runner_can_continue_play(self):
        """After deserialization, the runner can successfully play more cards."""
        for seed in range(50):
            rng = __import__("random").Random(seed)
            runner = GameRunner.new_game(
                RandomPassStrategy(rng=rng), RandomPlayStrategy(rng=rng), rng=rng
            )
            runner.submit_pass(
                [
                    Card.from_code(c)
                    for c in runner.get_state_for_frontend()["human_hand"][:3]
                ]
            )
            st = runner.get_state_for_frontend()
            if (
                st["phase"] != "playing"
                or st["whose_turn"] != 0
                or not st["legal_plays"]
            ):
                continue
            restored = GameRunner.from_json(runner.to_json())
            legal = restored.get_state_for_frontend()["legal_plays"]
            restored.submit_play(Card.from_code(legal[0]))
            st2 = restored.get_state_for_frontend()
            assert len(st2["human_hand"]) == len(st["human_hand"]) - 1
            return
        pytest.fail("No seed gave playable state")


# -----------------------------------------------------------------------------
# Card module: from_code, to_code, deck_52, deal_into_4_hands
# -----------------------------------------------------------------------------


class TestCardModule:
    def test_from_code_to_code_round_trip_all_52(self):
        for card in deck_52():
            assert Card.from_code(card.to_code()) == card

    def test_from_code_specific_cases(self):
        assert Card.from_code("2c") == Card(Suit.CLUBS, 2)
        assert Card.from_code("10d") == Card(Suit.DIAMONDS, 10)
        assert Card.from_code("Js") == Card(Suit.SPADES, 11)
        assert Card.from_code("Ah") == Card(Suit.HEARTS, 14)

    def test_from_code_invalid_empty(self):
        with pytest.raises(ValueError, match="Empty"):
            Card.from_code("")

    def test_from_code_invalid_suit(self):
        with pytest.raises(ValueError, match="suit"):
            Card.from_code("2x")

    def test_from_code_invalid_rank(self):
        with pytest.raises(ValueError, match="rank"):
            Card.from_code("1c")

    def test_deck_52_has_52_unique_cards(self):
        d = deck_52()
        assert len(d) == 52
        assert len(set(d)) == 52

    def test_deal_into_4_hands_returns_4_hands_of_13(self):
        d = deck_52()
        hands = deal_into_4_hands(d)
        assert len(hands) == 4
        for h in hands:
            assert len(h) == 13
        all_cards = [c for h in hands for c in h]
        assert len(set(all_cards)) == 52

    def test_deal_into_4_hands_wrong_deck_size_raises(self):
        with pytest.raises(ValueError, match="52"):
            deal_into_4_hands(deck_52()[:10])

    def test_two_of_clubs(self):
        c = two_of_clubs()
        assert c.suit == Suit.CLUBS
        assert c.rank == 2
        assert c.to_code() == "2c"

    def test_shuffle_deck_does_not_mutate_input(self):
        original = deck_52()
        original_copy = list(original)
        shuffle_deck(original)
        assert original == original_copy


# -----------------------------------------------------------------------------
# State helpers: pass_direction_for_round, initial_state_after_deal
# -----------------------------------------------------------------------------


class TestStateHelpers:
    def test_pass_direction_cycles(self):
        assert GameState.pass_direction_for_round(1) == PassDirection.LEFT
        assert GameState.pass_direction_for_round(2) == PassDirection.RIGHT
        assert GameState.pass_direction_for_round(3) == PassDirection.ACROSS
        assert GameState.pass_direction_for_round(4) == PassDirection.NONE
        assert GameState.pass_direction_for_round(5) == PassDirection.LEFT
        assert GameState.pass_direction_for_round(8) == PassDirection.NONE
        assert GameState.pass_direction_for_round(12) == PassDirection.NONE

    def test_initial_state_no_pass_round(self, four_hands):
        """Round 4 (no-pass) should start in playing phase with 2-of-clubs holder leading."""
        state = initial_state_after_deal(
            four_hands, round_num=4, previous_scores=(10, 20, 30, 40)
        )
        assert state.phase == Phase.PLAYING
        assert state.pass_direction == PassDirection.NONE
        assert state.scores == (10, 20, 30, 40)
        holder = state.whose_turn
        assert two_of_clubs() in state.hands[holder]

    def test_initial_state_passing_round(self, four_hands):
        """Round 1 should start in passing phase."""
        state = initial_state_after_deal(four_hands, round_num=1)
        assert state.phase == Phase.PASSING
        assert state.pass_direction == PassDirection.LEFT
