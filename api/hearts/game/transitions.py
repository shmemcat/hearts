"""
State transitions for Hearts. Pure functions: take state + inputs, return new state (no mutation).
"""

from typing import List, Tuple

from hearts.game.card import Card, Suit, QUEEN_OF_SPADES_RANK, two_of_clubs
from hearts.game.rules import get_legal_plays, get_trick_winner, get_trick_points
from hearts.game.state import (
    GameState,
    Phase,
    PassDirection,
    initial_state_after_deal,
)


def _apply_pass_direction(
    hands: List[List[Card]], passes: List[List[Card]], direction: PassDirection
) -> List[List[Card]]:
    """
    Apply the 4 passes to hands. passes[i] = 3 cards from player i to give away.
    Left: 0->1, 1->2, 2->3, 3->0.
    Right: 0->3, 1->0, 2->1, 3->2.
    Across: 0->2, 1->3, 2->0, 3->1.
    """
    if direction == PassDirection.NONE:
        return [list(h) for h in hands]
    # Remove passed cards from each hand
    new_hands = []
    for i in range(4):
        out = [c for c in hands[i] if c not in passes[i]]
        if len(out) != 10:
            raise ValueError(f"Player {i} did not pass exactly 3 cards")
        new_hands.append(out)
    # Who receives from whom: player i receives the pass from recv_from[i]
    # Left: i passes to (i+1)%4, so i receives from (i-1)%4 = (i+3)%4
    if direction == PassDirection.LEFT:
        recv_from = {0: 3, 1: 0, 2: 1, 3: 2}
    elif direction == PassDirection.RIGHT:
        recv_from = {0: 1, 1: 2, 2: 3, 3: 0}
    else:  # ACROSS: 0<->2, 1<->3
        recv_from = {0: 2, 1: 3, 2: 0, 3: 1}
    for i in range(4):
        new_hands[i].extend(passes[recv_from[i]])
    return new_hands


def apply_passes(
    state: GameState,
    passes_per_player: List[List[Card]],
) -> GameState:
    """
    Apply all 4 passes and distribute. Return new state with phase=playing,
    hands updated, current_trick empty, whose_turn = player who has 2♣.
    """
    if state.phase != Phase.PASSING:
        raise ValueError("apply_passes only in passing phase")
    if len(passes_per_player) != 4 or any(len(p) != 3 for p in passes_per_player):
        raise ValueError("Need exactly 4 lists of 3 cards each")
    hands_list = [list(state.hands[i]) for i in range(4)]
    new_hands = _apply_pass_direction(
        hands_list, passes_per_player, state.pass_direction
    )
    # Find who has 2♣ and will lead
    two_c = two_of_clubs()
    first_leader = None
    for i in range(4):
        if two_c in new_hands[i]:
            first_leader = i
            break
    if first_leader is None:
        raise ValueError("2♣ not found after passes")
    return GameState(
        round=state.round,
        phase=Phase.PLAYING,
        pass_direction=state.pass_direction,
        hands=tuple(tuple(h) for h in new_hands),
        current_trick=(),
        whose_turn=first_leader,
        scores=state.scores,
        round_scores=state.round_scores,
        hearts_broken=False,
        game_over=state.game_over,
        winner_index=state.winner_index,
    )


def apply_play(state: GameState, player_index: int, card: Card) -> GameState:
    """
    Play one card. Validates via get_legal_plays (caller must ensure card is legal).
    Returns new state: hand updated, trick updated; if trick complete, points to winner and next leader.
    """
    if state.phase != Phase.PLAYING:
        raise ValueError("apply_play only in playing phase")
    if state.whose_turn != player_index:
        raise ValueError(f"Not player {player_index}'s turn")
    hand = state.hand(player_index)
    if card not in hand:
        raise ValueError("Card not in hand")
    trick_list = state.trick_list()
    first_lead = _is_first_lead(state, hand)
    legal = get_legal_plays(
        hand,
        trick_list,
        state.hearts_broken,
        first_lead_of_round=first_lead,
        first_trick=_is_first_trick_of_round(state),
    )
    if card not in legal:
        raise ValueError(f"Illegal play: {card} not in legal plays")

    new_hand = [c for c in hand if c != card]
    new_trick = state.trick_list() + [(player_index, card)]
    played_hearts_or_qs = card.suit == Suit.HEARTS or (
        card.suit == Suit.SPADES and card.rank == QUEEN_OF_SPADES_RANK
    )
    new_hearts_broken = state.hearts_broken or played_hearts_or_qs

    if len(new_trick) < 4:
        next_turn = (player_index + 1) % 4
        return GameState(
            round=state.round,
            phase=Phase.PLAYING,
            pass_direction=state.pass_direction,
            hands=_replace_hand(state.hands, player_index, new_hand),
            current_trick=tuple(new_trick),
            whose_turn=next_turn,
            scores=state.scores,
            round_scores=state.round_scores,
            hearts_broken=new_hearts_broken,
            game_over=state.game_over,
            winner_index=state.winner_index,
        )

    # Trick complete
    lead_suit = new_trick[0][1].suit
    winner = get_trick_winner(new_trick, lead_suit)
    points = get_trick_points(new_trick)
    new_round_scores = list(state.round_scores)
    new_round_scores[winner] += points

    # 13 tricks per round - if we've played 13 tricks, round is over (handled by runner calling apply_round_scoring)
    return GameState(
        round=state.round,
        phase=Phase.PLAYING,
        pass_direction=state.pass_direction,
        hands=_replace_hand(state.hands, player_index, new_hand),
        current_trick=(),
        whose_turn=winner,
        scores=state.scores,
        round_scores=tuple(new_round_scores),
        hearts_broken=new_hearts_broken,
        game_over=state.game_over,
        winner_index=state.winner_index,
    )


def _replace_hand(
    hands: Tuple[Tuple[Card, ...], ...], player_index: int, new_hand: List[Card]
) -> Tuple[Tuple[Card, ...], ...]:
    lst = [list(hands[i]) for i in range(4)]
    lst[player_index] = new_hand
    return tuple(tuple(h) for h in lst)


def _is_first_trick_of_round(state: GameState) -> bool:
    """True if we're in the first trick of this round (no tricks completed yet)."""
    total_played = sum(13 - len(state.hands[i]) for i in range(4))
    return total_played < 4


def _is_first_lead(state: GameState, hand: List[Card]) -> bool:
    """True if this player is about to make the very first lead of the round (must play 2 of clubs)."""
    return (
        len(state.current_trick) == 0
        and _is_first_trick_of_round(state)
        and two_of_clubs() in hand
    )


def apply_round_scoring(state: GameState) -> GameState:
    """
    Apply round scores to totals (shoot the moon: one player took 26 -> they get 0, others +26).
    Set game_over and winner_index if any player >= 100.
    Zero out round_scores. Does not advance round or deal; runner calls deal_new_round for next round.
    """
    rs = state.round_scores
    # Shoot the moon: if any player has 26 points, they get 0 and each opponent gets +26
    if any(r == 26 for r in rs):
        new_scores = tuple(
            state.scores[i] + (0 if rs[i] == 26 else 26) for i in range(4)
        )
    else:
        new_scores = tuple(state.scores[i] + rs[i] for i in range(4))
    game_over = any(s >= 100 for s in new_scores)
    winner = None
    if game_over:
        min_score = min(new_scores)
        winners = [i for i, s in enumerate(new_scores) if s == min_score]
        winner = winners[0] if len(winners) == 1 else -1
    return GameState(
        round=state.round,
        phase=state.phase,
        pass_direction=state.pass_direction,
        hands=state.hands,
        current_trick=state.current_trick,
        whose_turn=state.whose_turn,
        scores=new_scores,
        round_scores=(0, 0, 0, 0),
        hearts_broken=state.hearts_broken,
        game_over=game_over,
        winner_index=winner,
    )


def deal_new_round(
    previous_scores: Tuple[int, ...],
    round_num: int,
    hands: List[List[Card]],
) -> GameState:
    """
    Start a new round after the previous one ended. previous_scores are the 4 totals;
    hands is the result of deal + shuffle (4 lists of 13). Phase is passing unless round_num % 4 == 0 (no pass).
    """
    return initial_state_after_deal(hands, round_num, previous_scores=previous_scores)
