"""Private account client. Games never receive JWT/password/mail secrets."""

import json
import secrets
import urllib.error
import urllib.request
from urllib.parse import urlsplit

from flask import current_app, has_request_context, request
from hearts.account_contracts import (
    AccountIdentity,
    AccountSession,
    AccountsUnavailable,
)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def validate_origin(url):
    parsed = urlsplit(url)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or parsed.path not in {"", "/"}
    ):
        raise ValueError("Account service URL must be an HTTP(S) origin")
    return url.rstrip("/")


def decode_identity(value):
    if value is None:
        return None
    if (
        not isinstance(value, dict)
        or type(value.get("id")) is not int
        or not 0 < value["id"] < 2**63
        or not isinstance(value.get("username"), str)
        or len(value["username"]) > 64
        or not isinstance(value.get("profile_icon"), str)
        or len(value["profile_icon"]) > 64
        or type(value.get("email_verified")) is not bool
    ):
        raise ValueError("Malformed identity")
    return AccountIdentity(
        value["id"], value["username"], value["profile_icon"], value["email_verified"]
    )


class RemoteAccounts:
    remote = True

    def __init__(self, url, service, token):
        self.url = validate_origin(url)
        if not service or not isinstance(token, str) or len(token) < 32:
            raise ValueError(
                "Remote accounts require a service ID and a strong private token"
            )
        self.service, self.token = service, token

    def _call(self, path, data, browser=False):
        headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + self.token,
            "X-Cards-Service": self.service,
        }
        if browser and has_request_context():
            for name in ("Cookie", "Origin", "X-CSRF-Token"):
                value = request.headers.get(name)
                if value:
                    if len(value) > 16384:
                        raise AccountsUnavailable("Oversized browser metadata")
                    headers[name] = value
        outbound = urllib.request.Request(
            self.url + "/_internal/accounts/v1/" + path,
            data=json.dumps(data).encode(),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.build_opener(
                urllib.request.ProxyHandler({}), NoRedirect
            ).open(outbound, timeout=2) as response:
                raw = response.read(262145)
                if len(raw) > 262144:
                    raise ValueError("Oversized account response")
                result = json.loads(raw)
                if (
                    not isinstance(result, dict)
                    or type(result.get("version")) is not int
                    or result["version"] != 1
                ):
                    raise ValueError("Unsupported account contract")
                return result
        except (OSError, ValueError, urllib.error.URLError) as error:
            raise AccountsUnavailable(
                "Account validation could not complete"
            ) from error

    def _state(self):
        cache = request.environ.setdefault("cards.remote_accounts", {})
        if "session" not in cache:
            # Anonymous guests must remain playable during an accounts outage.
            name = (
                "__Host-cards_session"
                if current_app.config["CARDS_COOKIE_SECURE"]
                else "cards_session"
            )
            if not request.cookies.get(name):
                cache["session"] = dict(
                    version=1,
                    user=None,
                    session=None,
                    valid_origin=False,
                    valid_csrf=False,
                )
            else:
                try:
                    state = self._call("session", {}, browser=True)
                    if "user" not in state or "session" not in state:
                        raise ValueError("Incomplete session response")
                    state["identity"] = decode_identity(state.get("user"))
                    row = state.get("session")
                    if row is not None and (
                        not isinstance(row, dict)
                        or not isinstance(row.get("csrf_token"), str)
                        or len(row["csrf_token"]) > 128
                    ):
                        raise ValueError("Malformed session")
                    if (
                        type(state.get("valid_origin")) is not bool
                        or type(state.get("valid_csrf")) is not bool
                    ):
                        raise ValueError("Malformed account guards")
                    cache["session"] = state
                except ValueError as error:
                    raise AccountsUnavailable("Invalid account response") from error
        return cache["session"]

    def cookie_user(self):
        return self._state().get("identity")

    def session(self):
        value = self._state().get("session")
        return AccountSession(value["csrf_token"]) if value else None

    def legacy_user(self, token):
        cache = request.environ.setdefault("cards.remote_accounts", {}).setdefault(
            "legacy", {}
        )
        if token not in cache:
            try:
                result = self._call("legacy", {"token": token})
                if "user" not in result:
                    raise ValueError("Incomplete credential response")
                cache[token] = decode_identity(result["user"])
            except ValueError as error:
                raise AccountsUnavailable("Invalid account response") from error
        return cache[token]

    def public_profiles(self, user_ids):
        ids = list(set(user_ids))
        if not ids:
            return {}
        if len(ids) > 500:
            # Preserve a bounded private request size for large leaderboards.
            return {
                uid: profile
                for offset in range(0, len(ids), 500)
                for uid, profile in self.public_profiles(
                    ids[offset : offset + 500]
                ).items()
            }
        try:
            values = self._call("profiles", {"user_ids": ids}).get("profiles")
            if not isinstance(values, list) or len(values) > len(ids):
                raise ValueError("Malformed profiles")
            profiles = [decode_identity(value) for value in values]
            if any(value is None or value.id not in ids for value in profiles):
                raise ValueError("Unexpected profile")
            if len({value.id for value in profiles}) != len(profiles):
                raise ValueError("Duplicate profile")
            return {value.id: value for value in profiles}
        except ValueError as error:
            raise AccountsUnavailable("Invalid account response") from error

    def valid_origin(self):
        # Guests can send Origin without a session. This check is configuration,
        # not authentication, and never requires an account network request.
        from urllib.parse import urlsplit

        public = urlsplit(current_app.config["CARDS_PUBLIC_URL"])
        allowed = {f"{public.scheme}://{public.netloc}"}
        if public.hostname in {"localhost", "127.0.0.1"}:
            allowed.update(
                f"http://{host}:{port}"
                for host in ("localhost", "127.0.0.1")
                for port in (3000, 3001, 3002)
            )
        return request.headers.get("Origin") in allowed

    def valid_csrf(self):
        return self._state()["valid_csrf"]

    def refresh(self):
        if not request.environ.get("cards.account_event_primed"):
            request.environ.pop("cards.remote_accounts", None)

    def delete_account(self, user_id, password):
        raise RuntimeError("Account mutations belong to the account service public API")
