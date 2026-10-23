"""Email content, URL escaping, and shared/legacy delivery compatibility."""

from html.parser import HTMLParser
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import pytest

from hearts.email_templates import password_reset_email_html, verification_email_html


class EmailLinks(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.links = []
        self.tags = set()
        self.current_link = None
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag)
        if tag == "a":
            self.current_link = {"attrs": dict(attrs), "text": ""}
            self.links.append(self.current_link)

    def handle_data(self, data):
        if self.current_link is not None:
            self.current_link["text"] += data

    def handle_endtag(self, tag):
        if tag == "a":
            self.current_link = None


@pytest.mark.parametrize(
    "template, action, expiry",
    [
        (verification_email_html, "Verify email", "24 hours"),
        (password_reset_email_html, "Reset password", "1 hour"),
    ],
)
def test_account_email_links_survive_escaping_without_injecting_markup(
    template, action, expiry
):
    url = "https://cards.shmem.dev/user/?view=verify&token=Hearts-HEARTS'\"><img src=x>"
    html = template(url)
    parsed = EmailLinks(html)

    assert len(parsed.links) == 2
    assert [link["attrs"]["href"] for link in parsed.links] == [url, url]
    assert parsed.links[0]["text"] == action
    assert parsed.links[1]["text"] == url
    assert all(
        set(link["attrs"]) == {"class", "href", "target", "style"}
        for link in parsed.links
    )
    assert not {"img", "script"} & parsed.tags
    assert f"This link expires in {expiry}." in html
    assert "Hearts account" not in html
    assert "One account for every game" not in html
    assert "Your shmem.dev Cards account.<" not in html


@pytest.mark.parametrize("shared_origin", ["", "https://cards.shmem.dev"])
@pytest.mark.parametrize(
    "function_name, kind, legacy_path, subject",
    [
        (
            "send_verification_email",
            "verify",
            "/verify-email",
            "Verify your Cards account",
        ),
        (
            "send_password_reset_email",
            "reset",
            "/reset-password",
            "Reset your Cards password",
        ),
    ],
)
def test_account_mail_uses_cards_branding_and_preserves_link_destinations(
    auth_client, shared_origin, function_name, kind, legacy_path, subject
):
    from hearts import app, email_utils

    token = "Hearts-HEARTS +/&signed-token"
    with (
        patch.dict(
            app.config,
            CARDS_PUBLIC_URL=shared_origin,
            FRONTEND_URL="https://hearts.shmem.dev",
        ),
        patch("hearts.email_utils._send", return_value=True) as sender,
    ):
        assert getattr(email_utils, function_name)("player@example.test", token)

    args = sender.call_args.args
    assert args[:2] == ("player@example.test", subject)
    assert sender.call_args.kwargs["sender_name"] == "Cards"
    parsed = EmailLinks(args[2])
    links = [urlsplit(link["attrs"]["href"]) for link in parsed.links]
    for link in links:
        assert link.scheme == "https"
        assert parse_qs(link.query)["token"] == [token]
        if shared_origin:
            assert link.netloc == "cards.shmem.dev" and link.path == "/user/"
            assert parse_qs(link.query)["view"] == [kind]
        else:
            assert link.netloc == "hearts.shmem.dev" and link.path == legacy_path
    assert "Hearts account" not in args[2]
