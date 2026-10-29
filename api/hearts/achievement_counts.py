"""The account badge rules, counting bronze, silver and gold separately."""

SINGLES = (
    "wimp",
    "photo_finish",
    "lucky_seven",
    "demolition",
    "speed_demon",
    "marathon",
    "biggest_loser",
    "double_moon",
    "eclipse",
    "heartbreaker",
    "better_with_friends",
    "early_bird",
    "night_owl",
    "monthly_star",
    "hall_of_fame",
    "geezer",
    "new_year",
    "lonely_heart",
    "lucky_clover",
    "easter_egg",
    "fireworks",
    "spooky",
    "thankful",
    "christmas_spirit",
)


def achievement_count(stats):
    count = sum(bool(getattr(stats, key)) for key in SINGLES)
    count += int(stats.max_win_streak >= 5) + int(stats.hardest_wins >= 1)
    for key, targets in {
        "games_played": (10, 50, 200),
        "games_won": (10, 25, 100),
        "moon_shots": (5, 10, 25),
    }.items():
        count += sum(getattr(stats, key) >= target for target in targets)
    count += sum(
        stats.best_score is not None and stats.best_score <= target
        for target in (10, 5, 0)
    )
    rate = 100 * stats.games_won / stats.games_played if stats.games_played else 0
    count += sum(
        stats.games_played >= games and rate >= target
        for games, target in ((20, 50), (30, 60), (50, 75))
    )
    # A higher Challenger tier also includes the lower tiers.
    count += (
        3
        if stats.hardest_wins
        else 2 if stats.harder_wins else 1 if stats.hard_wins else 0
    )
    return count
