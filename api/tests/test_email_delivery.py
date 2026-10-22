import io
import json
from unittest.mock import patch

import pytest


@pytest.mark.parametrize(
    "payload, expected",
    [
        ({"succeeded": 1, "failed": 0, "failures": []}, True),
        ({"succeeded": 0, "failed": 1, "failures": ["Rejected"]}, False),
        ({"error": "Permission denied"}, False),
        ({}, False),
    ],
)
def test_provider_processing_errors_are_not_reported_as_sent(
    auth_client, payload, expected
):
    from hearts import app
    from hearts.email_utils import _send

    class Reply(io.BytesIO):
        status = 200

    with patch.dict(app.config, SMTP2GO_API_KEY="test-key-never-transmitted"):
        with patch(
            "hearts.email_utils.urllib.request.urlopen",
            return_value=Reply(json.dumps({"data": payload}).encode()),
        ):
            assert _send("player@example.test", "Test", "<p>Test</p>") is expected


@pytest.mark.parametrize(
    "configured, supplied, status",
    [
        ("", "", 403),
        ("secret", "", 403),
        ("secret", "wrong", 403),
        ("secret", "secret", 200),
    ],
)
def test_monthly_administration_requires_a_configured_secret(
    auth_client, monkeypatch, configured, supplied, status
):
    monkeypatch.setenv("ADMIN_KEY", configured)
    assert (
        auth_client.post(
            "/leaderboard/reset-month", headers={"X-Admin-Key": supplied}
        ).status_code
        == status
    )
