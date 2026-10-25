"""An abandoned multiplayer seat never receives a completed-game result."""

from dataclasses import replace

import pytest

from hearts_server import multiplayer_socket as mp
from hearts_server.extensions import db
from hearts_server.models import DifficultyStats, GameResult, UserStats
from tests.test_service import multiplayer, signed


@pytest.mark.parametrize("game_over", [False, True])
def test_conceded_multiplayer_seat_preserves_completed_statistics(app, game_over):
    signed(app)
    stats = UserStats(user_id=42, games_played=3, games_won=2,
                      current_win_streak=2, max_win_streak=2, total_points=120,
                      best_score=10, worst_score=80)
    category = DifficultyStats(user_id=42, category="multiplayer", games_played=3,
                               games_won=2, current_win_streak=2, max_win_streak=2,
                               total_points=120, best_score=10, worst_score=80)
    db.session.add_all([stats, category])
    db.session.commit()
    before, category_before = stats.to_dict(), category.to_dict()
    runner = multiplayer(app)
    runner.seats[0].conceded = True
    runner.seats[0].is_human = False
    runner._state = replace(runner.state, game_over=game_over, scores=(0, 20, 40, 100))
    mp._on_game_complete("saved-multi", runner, app.extensions["socketio"])
    assert stats.to_dict() == before
    assert category.to_dict() == category_before
    assert GameResult.query.count() == 0
