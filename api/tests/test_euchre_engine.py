"""Pass-out rules, saved games and normal dealer rotation."""

import random

import pytest

from hearts.euchre_engine import apply_action, legal_actions, new_game


def pass_out(game):
    for _ in range(8):
        game = apply_action(game, dict(type="pass"))
    return game


@pytest.mark.parametrize("round_number", [1, 2])
@pytest.mark.parametrize("alone", [False, True])
def test_call_resets_pass_out_count_and_played_hand_rotates_dealer(round_number, alone):
    game = pass_out(new_game(rng=random.Random(3)))
    game = apply_action(game, dict(type="advance"))
    dealer = game["dealer"]
    assert game["consecutivePassOuts"] == 1
    if round_number == 2:
        for _ in range(4):
            game = apply_action(game, dict(type="pass"))
    action = next(
        a for a in legal_actions(game) if a["type"] == "call" and a["alone"] == alone
    )
    game = apply_action(game, action)
    assert game["consecutivePassOuts"] == 0
    while game["phase"] != "round_complete":
        game = apply_action(game, legal_actions(game)[0])
    game = apply_action(game, dict(type="advance"))
    assert game["dealer"] == (dealer + 1) % 4
    scores, results = game["scores"], game["results"]
    game = pass_out(game)
    assert game["message"] == "No calls — Re-deal"
    assert game["scores"] == scores and game["results"] == results
    game = apply_action(game, dict(type="advance"))
    assert game["dealer"] == (dealer + 1) % 4


def test_legacy_game_without_counter_gets_same_dealer_redeal():
    game = new_game()
    del game["consecutivePassOuts"]
    dealer = game["dealer"]
    game = pass_out(game)
    assert game["message"] == "No calls — Re-deal"
    game = apply_action(game, dict(type="advance"))
    assert game["dealer"] == dealer
    assert game["consecutivePassOuts"] == 1
