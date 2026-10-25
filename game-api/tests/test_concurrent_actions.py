"""Hearts passes already validate each seat independently of other submissions."""

import pytest

from hearts_server.game.card import Card
from hearts_server.game.state import Phase
from tests.test_multiplayer_runner import _find_runner_at_phase


@pytest.mark.parametrize("order", [(0, 1, 2, 3), (3, 2, 1, 0), (2, 0, 3, 1)])
def test_all_players_can_pass_from_the_same_snapshot_without_duplicate_submissions(
    order,
):
    runner = _find_runner_at_phase(Phase.PASSING, num_humans=4)
    displayed = [runner.get_state_for_player(i) for i in range(4)]
    for index, seat in enumerate(order):
        cards = [Card.from_code(code) for code in displayed[seat]["my_hand"][:3]]
        assert runner.submit_pass(seat, cards) == (
            "applied" if index == 3 else "waiting"
        )
        if index < 3:
            with pytest.raises(ValueError, match="already submitted"):
                runner.submit_pass(seat, cards)
    assert runner.state.phase == Phase.PLAYING
    with pytest.raises(ValueError, match="Not in passing"):
        runner.submit_pass(
            order[0],
            [Card.from_code(code) for code in displayed[order[0]]["my_hand"][:3]],
        )
