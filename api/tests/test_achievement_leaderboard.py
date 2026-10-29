from hearts.extensions import db
from hearts.models import User, UserStats


def test_legacy_hearts_api_serves_the_same_achievement_totals(default_test_app):
    with default_test_app.app_context():
        db.create_all()
        user = User(
            username="Collector", email="collector@example.test", password_hash="unused"
        )
        db.session.add(user)
        db.session.flush()
        db.session.add(UserStats(user_id=user.id, hardest_wins=1, geezer=True))
        db.session.commit()
    response = default_test_app.test_client().get("/leaderboard?category=achievements")
    assert response.status_code == 200
    assert response.json == {
        "monthly": [],
        "all_time": [
            {
                "rank": 1,
                "username": "Collector",
                "profile_icon": "user",
                "achievement_count": 5,
            }
        ],
    }
