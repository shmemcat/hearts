import pytest

from hearts_server.achievement_counts import achievement_count
from hearts_server.extensions import db
from hearts_server.models import UserStats
from tests.conftest import add_profile


@pytest.mark.parametrize("wins, expected", [(0, 0), (1, 1), (2, 2), (3, 4)])
def test_challenger_tiers_include_lower_tiers(app, wins, expected):
    add_profile(app, 1, "Player")
    stats = UserStats(user_id=1, hard_wins=int(wins == 1), harder_wins=int(wins == 2), hardest_wins=int(wins == 3))
    db.session.add(stats)
    db.session.commit()
    # Hardest also earns Hi Mom.
    assert achievement_count(stats) == expected


def test_all_tiers_and_secrets_count_once(app):
    add_profile(app, 1, "Player")
    stats = UserStats(user_id=1, games_played=200, games_won=150, moon_shots=25,
                      best_score=0, hardest_wins=1, max_win_streak=5, geezer=True)
    db.session.add(stats)
    db.session.commit()
    assert achievement_count(stats) == 18 + 3  # Six gold badges, Hi Mom, streak, music.


def test_public_top_ten_filters_missing_profiles_and_uses_stable_ties(app):
    for uid in range(1, 15):
        add_profile(app, uid, f"Player{uid:02}")
        db.session.add(UserStats(user_id=uid, geezer=True))
    add_profile(app, 15, "Missing")
    app.extensions["accounts"].profiles.pop(15)
    db.session.add(UserStats(user_id=15, geezer=True, hardest_wins=1))
    db.session.commit()
    stats = UserStats.query.filter_by(user_id=14).one()
    stats.hardest_wins = 1
    db.session.commit()
    response = app.test_client().get("/leaderboard?category=achievements")
    assert response.status_code == 200
    assert response.json["monthly"] == []
    rows = response.json["all_time"]
    assert len(rows) == 10
    assert rows[0] == dict(rank=1, username="Player14", profile_icon="user", achievement_count=5)
    assert [row["username"] for row in rows[1:]] == [f"Player{uid:02}" for uid in range(1, 10)]
    assert [row["rank"] for row in rows] == list(range(1, 11))
    app.extensions["accounts"].unavailable = True
    assert app.test_client().get("/leaderboard?category=achievements").status_code == 503
