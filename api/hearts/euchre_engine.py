"""Authoritative partnership Euchre. Wire fields match the browser engine."""

import copy
import random
import uuid
from datetime import datetime, timezone

SUITS = "cdsh"
RANKS = ["9", "10", "J", "Q", "K", "A"]
DECK = [rank + suit for suit in SUITS for rank in RANKS]
NAMES = dict(c="clubs", d="diamonds", s="spades", h="hearts")


def effective(card, trump):
    return (
        trump
        if trump and card == "J" + dict(c="s", s="c", d="h", h="d")[trump]
        else card[-1]
    )


def strength(card, trump):
    if trump and effective(card, trump) == trump:
        return (
            (30 if card[-1] == trump else 29)
            if card[0] == "J"
            else 20 + RANKS.index(card[:-1])
        )
    return RANKS.index(card[:-1])


def legal_cards(hand, trick, trump):
    matching = [
        c
        for c in hand
        if trick and effective(c, trump) == effective(trick[0]["card"], trump)
    ]
    return matching or list(hand)


def winner(plays, trump):
    led = effective(plays[0]["card"], trump)
    return max(
        plays,
        key=lambda p: strength(p["card"], trump)
        + (10 if effective(p["card"], trump) == led else 0),
    )["seat"]


def next_active(seat, sitting_out):
    seat = (seat + 1) % 4
    return (seat + 1) % 4 if seat == sitting_out else seat


def deal(game, rng):
    deck = list(DECK)
    rng.shuffle(deck)
    hands = [[], [], [], []]
    offset = 0
    for count in (2, 3):
        for step in range(1, 5):
            seat = (game["dealer"] + step) % 4
            hands[seat].extend(deck[offset : offset + count])
            offset += count
    game.update(
        phase="bidding1",
        turn=(game["dealer"] + 1) % 4,
        hands=hands,
        kitty=deck[20:],
        upCard=deck[20],
        trump=None,
        maker=None,
        alone=False,
        sittingOut=None,
        passes=0,
        trick=[],
        completedTricks=[],
        tricks=[0, 0],
        message="Choose trump, or pass.",
    )
    return game


def new_game(difficulty="easy", rng=None):
    rng = rng or random.SystemRandom()
    return deal(
        dict(
            version=1,
            id=uuid.uuid4().hex,
            difficulty=difficulty,
            playerName="You",
            handNumber=1,
            dealer=rng.randrange(4),
            scores=[0, 0],
            results=[],
            target=10,
            finishedAt=None,
            conceded=False,
        ),
        rng,
    )


def legal_actions(g):
    phase = g["phase"]
    if phase in ("bidding1", "bidding2"):
        suits = (
            [g["upCard"][-1]]
            if phase == "bidding1"
            else [s for s in SUITS if s != g["upCard"][-1]]
        )
        return [dict(type="pass")] + [
            dict(type="call", suit=s, alone=a) for s in suits for a in (False, True)
        ]
    if phase in ("discard", "playing"):
        cards = g["hands"][g["turn"]]
        if phase == "playing":
            cards = legal_cards(cards, g["trick"], g["trump"])
        return [
            dict(type="discard" if phase == "discard" else "play", card=c)
            for c in cards
        ]
    return (
        [dict(type="advance")] if phase in ("trick_complete", "round_complete") else []
    )


def apply_action(original, action, rng=None):
    if not isinstance(action, dict) or action not in legal_actions(original):
        raise ValueError("That action is not legal right now.")
    g = copy.deepcopy(original)
    rng = rng or random.SystemRandom()
    seat = g["turn"]
    kind = action["type"]
    if kind == "pass":
        g["passes"] += 1
        g["message"] = f"Seat {seat + 1} passes."
        if g["passes"] == 4:
            if g["phase"] == "bidding1":
                g.update(
                    phase="bidding2",
                    passes=0,
                    turn=(g["dealer"] + 1) % 4,
                    message="Everyone passed. Choose another trump suit, or pass.",
                )
            else:
                g.update(dealer=(g["dealer"] + 1) % 4, handNumber=g["handNumber"] + 1)
                return deal(g, rng)
        else:
            g["turn"] = (seat + 1) % 4
    elif kind == "call":
        g.update(
            trump=action["suit"],
            maker=seat,
            alone=action["alone"],
            sittingOut=(seat + 2) % 4 if action["alone"] else None,
        )
        if g["phase"] == "bidding1":
            g["hands"][g["dealer"]].append(g["upCard"])
            g["kitty"].remove(g["upCard"])
            g.update(
                phase="discard", turn=g["dealer"], message="The dealer is discarding."
            )
        else:
            begin_play(g)
    elif kind == "discard":
        g["hands"][seat].remove(action["card"])
        g["kitty"].append(action["card"])
        begin_play(g)
    elif kind == "play":
        g["hands"][seat].remove(action["card"])
        g["trick"].append(dict(seat=seat, card=action["card"]))
        if len(g["trick"]) == (3 if g["alone"] else 4):
            won = winner(g["trick"], g["trump"])
            g["tricks"][won % 2] += 1
            g["completedTricks"].append(
                dict(plays=copy.deepcopy(g["trick"]), winner=won)
            )
            g.update(
                turn=won,
                phase="trick_complete",
                message=f"Seat {won + 1} takes the trick.",
            )
        else:
            g["turn"] = next_active(seat, g["sittingOut"])
    elif kind == "advance":
        if g["phase"] == "round_complete":
            g.update(dealer=(g["dealer"] + 1) % 4, handNumber=g["handNumber"] + 1)
            return deal(g, rng)
        if len(g["completedTricks"]) == 5:
            maker = g["maker"] % 2
            tricks = g["tricks"][maker]
            side = 1 - maker if tricks < 3 else maker
            points = [0, 0]
            points[side] = (
                2 if tricks < 3 else (4 if g["alone"] else 2) if tricks == 5 else 1
            )
            g["scores"] = [g["scores"][i] + points[i] for i in range(2)]
            g["results"].append(
                dict(
                    hand=g["handNumber"],
                    maker=g["maker"],
                    trump=g["trump"],
                    alone=g["alone"],
                    tricks=list(g["tricks"]),
                    points=points,
                    scores=list(g["scores"]),
                )
            )
            g["phase"] = "game_over" if max(g["scores"]) >= 10 else "round_complete"
            if g["phase"] == "game_over":
                g["finishedAt"] = datetime.now(timezone.utc).isoformat()
            g["message"] = (
                "Euchred!"
                if tricks < 3
                else (
                    "A lone-hand sweep!"
                    if tricks == 5 and g["alone"]
                    else (
                        "Marched! All five tricks!" if tricks == 5 else "Hand complete."
                    )
                )
            )
        else:
            g.update(phase="playing", trick=[])
    return g


def begin_play(g):
    g.update(
        phase="playing",
        turn=next_active(g["dealer"], g["sittingOut"]),
        message=f"{NAMES[g['trump']].capitalize()} trump{' · Going alone' if g['alone'] else ''}.",
    )


def discard_choice(hand, trump):
    def value(c):
        suit = effective(c, trump)
        count = sum(effective(x, trump) == suit for x in hand)
        return (
            40 + strength(c, trump)
            if suit == trump
            else 20 if c[0] == "A" else strength(c, trump)
        ) - (4 if count == 1 and suit != trump else 0)

    return min(hand, key=value)


def hand_value(hand, trump):
    trumps = [c for c in hand if effective(c, trump) == trump]
    value = sum(
        1.55 if strength(c, trump) >= 29 else 1.1 if c[0] == "A" else 0.55
        for c in trumps
    )
    value += sum(0.85 for c in hand if effective(c, trump) != trump and c[0] == "A")
    if len(trumps) >= 3:
        value += (len(trumps) - 2) * 0.4
    if len(trumps) >= 2:
        value += sum(
            0.25
            for s in SUITS
            if s != trump and not any(effective(c, trump) == s for c in hand)
        )
    return value


def medium_action(g):
    """Same hand valuation, discard and cooperative policy as browser Medium."""
    actions = legal_actions(g)
    seat, trump = g["turn"], g["trump"]
    hand = g["hands"][seat]
    if g["phase"].startswith("bidding"):
        choices = [a for a in actions if a["type"] == "call" and not a["alone"]]

        def power(a):
            s = a["suit"]
            cards = list(hand)
            if g["phase"] == "bidding1" and seat == g["dealer"]:
                cards.append(g["upCard"])
                cards.remove(discard_choice(cards, s))
            value = hand_value(cards, s)
            if g["phase"] == "bidding1":
                value += (
                    0.25
                    if g["dealer"] == (seat + 2) % 4
                    else -0.2 if g["dealer"] % 2 != seat % 2 else 0
                )
            return value

        best = max(choices, key=power)
        value = power(best)
        return dict(best, alone=value >= 5) if value >= 2.65 else dict(type="pass")
    if g["phase"] == "discard":
        return dict(type="discard", card=discard_choice(hand, trump))
    if g["phase"] == "playing":
        low = lambda a: strength(a["card"], trump)
        if g["trick"]:
            current = winner(g["trick"], trump)
            winning = [
                a
                for a in actions
                if winner(g["trick"] + [dict(seat=seat, card=a["card"])], trump) == seat
            ]
            return min(
                winning if current % 2 != seat % 2 and winning else actions, key=low
            )
        aces = [
            a
            for a in actions
            if a["card"][0] == "A" and effective(a["card"], trump) != trump
        ]
        trumps = [a for a in actions if effective(a["card"], trump) == trump]
        plain = [a for a in actions if effective(a["card"], trump) != trump]
        if seat % 2 == g["maker"] % 2 and len(trumps) >= 2:
            return max(trumps, key=low)
        return (
            aces[0]
            if aces
            else min(
                plain if g["sittingOut"] is not None and plain else actions, key=low
            )
        )
    return actions[0]


def sample_game(g, rng):
    """Sample from own hand and public history, respecting exposed voids."""
    seat = g["turn"]
    own = g["hands"][seat]
    plays = [p for t in g["completedTricks"] for p in t["plays"]] + g["trick"]
    played = {p["card"] for p in plays}
    picked_up = g["maker"] is not None and g["trump"] == g["upCard"][-1]
    dead = set() if picked_up else {g["upCard"]}
    if picked_up and seat == g["dealer"] and g["phase"] != "discard":
        dead.add(g["kitty"][-1])  # A dealer remembers only their own discard.
    unknown = [c for c in DECK if c not in own and c not in played and c not in dead]
    voids = [set() for _ in range(4)]
    for trick in [t["plays"] for t in g["completedTricks"]] + [g["trick"]]:
        if trick:
            led = effective(trick[0]["card"], g["trump"])
            for p in trick[1:]:
                if effective(p["card"], g["trump"]) != led:
                    voids[p["seat"]].add(led)
    # Try independent shuffles; invalid deals are discarded, never relaxed.
    for _ in range(80):
        rng.shuffle(unknown)
        hands = [[], [], [], []]
        hands[seat] = list(own)
        offset = 0
        for other in range(4):
            if other == seat:
                continue
            count = len(g["hands"][other])
            hands[other] = unknown[offset : offset + count]
            offset += count
        if any(
            effective(c, g["trump"]) in voids[i] for i, h in enumerate(hands) for c in h
        ):
            continue
        if (
            picked_up
            and g["phase"] == "discard"
            and g["upCard"] not in hands[g["dealer"]]
        ):
            continue
        # After pickup the upcard may be held, played or discarded by the dealer.
        if picked_up and g["upCard"] not in own and g["upCard"] not in played:
            if any(g["upCard"] in hands[i] for i in range(4) if i != g["dealer"]):
                continue
        sampled = copy.deepcopy(g)
        sampled["hands"] = hands
        sampled["kitty"] = unknown[offset:] + list(dead)
        return sampled
    return None


def simulated_value(g, action, side, rng):
    before = g["scores"][side] - g["scores"][1 - side]
    hand_number = g["handNumber"]
    g = apply_action(g, action, rng)
    for _ in range(40):
        if g["handNumber"] != hand_number:
            return 0  # Eight passes: a fresh, unobserved deal.
        if g["phase"] in ("round_complete", "game_over"):
            return g["scores"][side] - g["scores"][1 - side] - before
        g = apply_action(g, medium_action(g), rng)
    return 0


def bot_action(g, rng=None, cooperate=None):
    """Hard levels compare moves across 32/128/384 hypothetical deals."""
    rng = rng or random.SystemRandom()
    actions = legal_actions(g)
    basic = medium_action(g)
    if g["difficulty"] == "easy":
        if g["phase"].startswith("bidding"):
            if basic["type"] == "call":
                return dict(basic, alone=False)
            calls = [a for a in actions if a["type"] == "call" and not a["alone"]]
            return rng.choice(calls) if rng.random() < 0.12 else dict(type="pass")
        return rng.choice(actions)
    if g["difficulty"] == "medium" or len(actions) == 1:
        return basic
    totals = [0] * len(actions)
    samples = 0
    for i in range(dict(hard=32, harder=128, hardest=384)[g["difficulty"]]):
        sampled = sample_game(g, rng)
        if sampled:
            for index, action in enumerate(actions):
                totals[index] += simulated_value(sampled, action, g["turn"] % 2, rng)
            samples += 1
        if cooperate and i % 4 == 0:
            cooperate()
    if not samples:
        return basic
    best = max(range(len(actions)), key=lambda i: totals[i])
    baseline = actions.index(basic)
    margin = dict(hard=0.4, harder=0.12, hardest=0.04)[g["difficulty"]]
    return (
        actions[best] if (totals[best] - totals[baseline]) / samples > margin else basic
    )
