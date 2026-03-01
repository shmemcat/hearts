"""Tests for MultiplayerRunner and SeatConfig."""

import json
import random
import pytest

from hearts.multiplayer_runner import MultiplayerRunner, SeatConfig
from hearts.game.card import Card
from hearts.game.state import Phase


def _make_seats(num_humans=2):
    """Create a standard 4-seat config: first `num_humans` are human, rest are bots."""
    seats = []
    for i in range(4):
        if i < num_humans:
            seats.append(
                SeatConfig(f"Player {i}", is_human=True, player_token=f"tok{i}")
            )
        else:
            seats.append(SeatConfig(f"Bot {i}", is_human=False))
    return seats


def _make_runner(num_humans=2, seed=42):
    rng = random.Random(seed)
    seats = _make_seats(num_humans)
    return MultiplayerRunner.new_game(seats, difficulty="easy", rng=rng)


def _find_runner_at_phase(phase, num_humans=2, seed_range=50):
    """Try seeds until we get a runner at the desired phase."""
    for seed in range(seed_range):
        runner = _make_runner(num_humans=num_humans, seed=seed)
        if runner.state.phase == phase:
            return runner
    pytest.fail(f"No seed gave phase {phase}")


class TestSeatConfig:
    def test_defaults(self):
        seat = SeatConfig("Alice")
        assert seat.name == "Alice"
        assert seat.is_human is False
        assert seat.player_token is None
        assert seat.conceded is False

    def test_round_trip(self):
        seat = SeatConfig("Bob", is_human=True, player_token="abc123", conceded=True)
        d = seat.to_dict()
        restored = SeatConfig.from_dict(d)
        assert restored.name == "Bob"
        assert restored.is_human is True
        assert restored.player_token == "abc123"
        assert restored.conceded is True


class TestNewGame:
    def test_creates_valid_initial_state(self):
        runner = _make_runner()
        assert runner.state.round == 1
        assert runner.state.phase in (Phase.PASSING, Phase.PLAYING)
        assert runner.state.game_over is False
        assert len(runner.seats) == 4

    def test_seats_assigned(self):
        runner = _make_runner(num_humans=2)
        assert runner.seats[0].is_human is True
        assert runner.seats[1].is_human is True
        assert runner.seats[2].is_human is False
        assert runner.seats[3].is_human is False

    def test_each_player_gets_13_cards(self):
        runner = _make_runner()
        for i in range(4):
            assert len(runner.state.hands[i]) == 13

    def test_difficulty_preserved(self):
        seats = _make_seats()
        runner = MultiplayerRunner.new_game(seats, difficulty="hard")
        assert runner.difficulty == "hard"


class TestSubmitPass:
    def test_returns_waiting_when_not_all_submitted(self):
        runner = _find_runner_at_phase(Phase.PASSING)
        hand0 = list(runner.state.hands[0])
        result = runner.submit_pass(0, hand0[:3])
        assert result == "waiting"

    def test_returns_applied_when_all_humans_submit(self):
        runner = _find_runner_at_phase(Phase.PASSING)
        hand0 = list(runner.state.hands[0])
        hand1 = list(runner.state.hands[1])
        runner.submit_pass(0, hand0[:3])
        result = runner.submit_pass(1, hand1[:3])
        assert result == "applied"
        assert runner.state.phase == Phase.PLAYING

    def test_raises_for_bot_seat(self):
        runner = _find_runner_at_phase(Phase.PASSING)
        hand2 = list(runner.state.hands[2])
        with pytest.raises(ValueError, match="active human"):
            runner.submit_pass(2, hand2[:3])

    def test_raises_for_wrong_card_count(self):
        runner = _find_runner_at_phase(Phase.PASSING)
        hand0 = list(runner.state.hands[0])
        with pytest.raises(ValueError, match="Invalid pass"):
            runner.submit_pass(0, hand0[:2])

    def test_raises_for_duplicate_submission(self):
        runner = _find_runner_at_phase(Phase.PASSING)
        hand0 = list(runner.state.hands[0])
        runner.submit_pass(0, hand0[:3])
        with pytest.raises(ValueError, match="already submitted"):
            runner.submit_pass(0, hand0[3:6])

    def test_raises_when_not_in_passing_phase(self):
        runner = _find_runner_at_phase(Phase.PASSING)
        h0 = list(runner.state.hands[0])
        h1 = list(runner.state.hands[1])
        runner.submit_pass(0, h0[:3])
        runner.submit_pass(1, h1[:3])
        assert runner.state.phase == Phase.PLAYING
        hand0 = list(runner.state.hands[0])
        with pytest.raises(ValueError, match="Not in passing"):
            runner.submit_pass(0, hand0[:3])


class TestSubmitPlay:
    def _get_playing_runner_at_human_turn(self, seed_range=80):
        """Find a runner where it's a human's turn to play."""
        for seed in range(seed_range):
            runner = _make_runner(num_humans=2, seed=seed)
            if runner.state.phase == Phase.PASSING:
                h0 = list(runner.state.hands[0])
                h1 = list(runner.state.hands[1])
                runner.submit_pass(0, h0[:3])
                runner.submit_pass(1, h1[:3])
            if runner.state.phase == Phase.PLAYING:
                turn = runner.state.whose_turn
                if runner.seats[turn].is_human and not runner.seats[turn].conceded:
                    return runner
                runner.advance_to_human_turn()
                turn = runner.state.whose_turn
                if runner.seats[turn].is_human:
                    return runner
        pytest.fail("No seed gave human turn in playing phase")

    def test_valid_play_fires_on_play(self):
        runner = self._get_playing_runner_at_human_turn()
        turn = runner.state.whose_turn
        hand = list(runner.state.hands[turn])
        from hearts.game.rules import get_legal_plays
        from hearts.game.transitions import _is_first_lead, _is_first_trick_of_round

        legal = get_legal_plays(
            hand,
            runner.state.trick_list(),
            runner.state.hearts_broken,
            first_lead_of_round=_is_first_lead(runner.state, hand),
            first_trick=_is_first_trick_of_round(runner.state),
        )
        plays = []
        runner.submit_play(turn, legal[0], on_play=lambda ev: plays.append(ev))
        assert len(plays) >= 1
        assert plays[0]["player_index"] == turn
        assert plays[0]["card"] == legal[0].to_code()

    def test_raises_for_wrong_turn(self):
        runner = self._get_playing_runner_at_human_turn()
        turn = runner.state.whose_turn
        other = 0 if turn == 1 else 1
        hand = list(runner.state.hands[other])
        if hand:
            with pytest.raises(ValueError, match="Not your turn"):
                runner.submit_play(other, hand[0])

    def test_raises_for_illegal_card(self):
        runner = self._get_playing_runner_at_human_turn()
        turn = runner.state.whose_turn
        hand = list(runner.state.hands[turn])
        from hearts.game.rules import get_legal_plays
        from hearts.game.transitions import _is_first_lead, _is_first_trick_of_round

        legal = get_legal_plays(
            hand,
            runner.state.trick_list(),
            runner.state.hearts_broken,
            first_lead_of_round=_is_first_lead(runner.state, hand),
            first_trick=_is_first_trick_of_round(runner.state),
        )
        illegal = [c for c in hand if c not in legal]
        if illegal:
            with pytest.raises(ValueError, match="Illegal play"):
                runner.submit_play(turn, illegal[0])

    def test_on_done_fires(self):
        runner = self._get_playing_runner_at_human_turn()
        turn = runner.state.whose_turn
        hand = list(runner.state.hands[turn])
        from hearts.game.rules import get_legal_plays
        from hearts.game.transitions import _is_first_lead, _is_first_trick_of_round

        legal = get_legal_plays(
            hand,
            runner.state.trick_list(),
            runner.state.hearts_broken,
            first_lead_of_round=_is_first_lead(runner.state, hand),
            first_trick=_is_first_trick_of_round(runner.state),
        )
        done_calls = []
        runner.submit_play(turn, legal[0], on_done=lambda d: done_calls.append(d))
        assert len(done_calls) >= 1


class TestConcedePlayer:
    def test_concede_returns_conceded(self):
        runner = _make_runner(num_humans=2)
        result = runner.concede_player(0)
        assert result == "conceded"
        assert runner.seats[0].conceded is True
        assert "(Bot)" in runner.seats[0].name

    def test_all_concede_returns_terminated(self):
        runner = _make_runner(num_humans=2)
        runner.concede_player(0)
        result = runner.concede_player(1)
        assert result == "terminated"
        assert runner.state.game_over is True

    def test_raises_for_bot_seat(self):
        runner = _make_runner(num_humans=2)
        with pytest.raises(ValueError, match="active human"):
            runner.concede_player(2)

    def test_raises_for_already_conceded(self):
        runner = _make_runner(num_humans=2)
        runner.concede_player(0)
        with pytest.raises(ValueError, match="active human"):
            runner.concede_player(0)

    def test_removes_pending_pass(self):
        runner = _find_runner_at_phase(Phase.PASSING)
        hand0 = list(runner.state.hands[0])
        runner.submit_pass(0, hand0[:3])
        assert 0 in runner.pending_passes
        runner.concede_player(0)
        assert 0 not in runner.pending_passes

    def test_concede_during_passing_triggers_apply_if_remaining_done(self):
        runner = _find_runner_at_phase(Phase.PASSING)
        hand1 = list(runner.state.hands[1])
        runner.submit_pass(1, hand1[:3])
        runner.concede_player(0)
        assert runner.state.phase == Phase.PLAYING


class TestAdvanceToHumanTurn:
    def test_runs_bots_until_human(self):
        runner = _make_runner(num_humans=1, seed=42)
        if runner.state.phase == Phase.PASSING:
            hand0 = list(runner.state.hands[0])
            runner.submit_pass(0, hand0[:3])
        plays = []
        runner.advance_to_human_turn(on_play=lambda ev: plays.append(ev))
        if not runner.state.game_over:
            assert runner.seats[runner.state.whose_turn].is_human

    def test_fires_on_done(self):
        runner = _make_runner(num_humans=1, seed=42)
        if runner.state.phase == Phase.PASSING:
            hand0 = list(runner.state.hands[0])
            runner.submit_pass(0, hand0[:3])
        done_calls = []
        runner.advance_to_human_turn(on_done=lambda d: done_calls.append(d))
        assert len(done_calls) >= 1


class TestStateViews:
    def test_player_sees_own_hand(self):
        runner = _make_runner()
        view = runner.get_state_for_player(0)
        assert len(view["my_hand"]) == 13
        assert view["my_seat"] == 0

    def test_player_hand_matches_state(self):
        runner = _make_runner()
        view = runner.get_state_for_player(0)
        expected = [c.to_code() for c in runner.state.hands[0]]
        assert sorted(view["my_hand"]) == sorted(expected)

    def test_spectator_sees_no_hand(self):
        runner = _make_runner()
        view = runner.get_state_for_spectator()
        assert view["my_hand"] == []
        assert view["legal_plays"] == []
        assert view["my_seat"] is None

    def test_player_state_includes_player_info(self):
        runner = _make_runner()
        view = runner.get_state_for_player(0)
        assert len(view["players"]) == 4
        assert view["players"][0]["is_human"] is True
        assert view["players"][2]["is_human"] is False

    def test_pass_submitted_flag(self):
        runner = _find_runner_at_phase(Phase.PASSING)
        view_before = runner.get_state_for_player(0)
        assert view_before["pass_submitted"] is False
        hand0 = list(runner.state.hands[0])
        runner.submit_pass(0, hand0[:3])
        view_after = runner.get_state_for_player(0)
        assert view_after["pass_submitted"] is True


class TestSerialization:
    def test_to_dict_from_dict_round_trip(self):
        runner = _make_runner()
        data = runner.to_dict()
        restored = MultiplayerRunner.from_dict(data)
        assert restored.state.round == runner.state.round
        assert restored.state.phase == runner.state.phase
        assert restored.difficulty == runner.difficulty
        assert len(restored.seats) == 4
        for i in range(4):
            assert restored.seats[i].name == runner.seats[i].name
            assert restored.seats[i].is_human == runner.seats[i].is_human
        for i in range(4):
            original_hand = [c.to_code() for c in runner.state.hands[i]]
            restored_hand = [c.to_code() for c in restored.state.hands[i]]
            assert original_hand == restored_hand

    def test_to_json_from_json_round_trip(self):
        runner = _make_runner()
        json_str = runner.to_json()
        restored = MultiplayerRunner.from_json(json_str)
        assert restored.state.round == runner.state.round
        assert restored.state.phase == runner.state.phase
        assert json.loads(json_str) == runner.to_dict()

    def test_pending_passes_preserved(self):
        runner = _find_runner_at_phase(Phase.PASSING)
        hand0 = list(runner.state.hands[0])
        runner.submit_pass(0, hand0[:3])
        data = runner.to_dict()
        restored = MultiplayerRunner.from_dict(data)
        assert 0 in restored.pending_passes
        assert len(restored.pending_passes[0]) == 3
