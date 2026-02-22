from flask import Blueprint, request, jsonify, g

from hearts.extensions import db
from hearts.models import UserPreferences
from hearts.jwt_utils import require_jwt

prefs_bp = Blueprint("prefs", __name__, url_prefix="/preferences")

VALID_CARD_STYLES = {"standard", "flourish"}
VALID_HARD_LEVELS = {"hard", "harder", "hardest"}
VALID_MOBILE_LAYOUTS = {"single", "double"}

VALIDATORS = {
    "card_style": VALID_CARD_STYLES,
    "hard_level": VALID_HARD_LEVELS,
    "mobile_layout": VALID_MOBILE_LAYOUTS,
}


def _get_or_create_prefs(user_id: int) -> UserPreferences:
    prefs = UserPreferences.query.filter_by(user_id=user_id).first()
    if not prefs:
        prefs = UserPreferences(user_id=user_id)
        db.session.add(prefs)
        db.session.flush()
    return prefs


@prefs_bp.route("", methods=["GET"])
@require_jwt
def get_preferences():
    prefs = _get_or_create_prefs(g.current_user.id)
    db.session.commit()
    return jsonify({"preferences": prefs.to_dict()}), 200


@prefs_bp.route("", methods=["PATCH"])
@require_jwt
def update_preferences():
    data = request.get_json() or {}
    prefs = _get_or_create_prefs(g.current_user.id)

    errors = []
    for key, valid_values in VALIDATORS.items():
        if key in data:
            value = data[key]
            if value not in valid_values:
                errors.append(f"Invalid {key}: {value}")
            else:
                setattr(prefs, key, value)

    if errors:
        return jsonify({"error": ", ".join(errors)}), 400

    db.session.commit()
    return jsonify({"preferences": prefs.to_dict()}), 200
