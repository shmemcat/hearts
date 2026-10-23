"""Compatibility only: public account routes relay to the single account owner."""

import urllib.error
import urllib.request

from flask import Blueprint, current_app, request
from hearts.account_contracts import AccountsUnavailable
from hearts.account_remote import NoRedirect


def register_account_relay(app, url):
    blueprint = Blueprint("account_relay", __name__)

    def relay():
        raw = request.stream.read(16385)
        if len(raw) > 16384:
            return {"error": "Account request is too large."}, 413
        headers = {
            name: request.headers[name]
            for name in (
                "Cookie",
                "Origin",
                "Authorization",
                "X-CSRF-Token",
                "Content-Type",
                "Accept",
            )
            if name in request.headers
        }
        # Never forward a user-supplied private service credential or host header.
        headers["X-Forwarded-For"] = request.remote_addr or ""
        destination = url.rstrip("/") + request.path
        if request.query_string:
            destination += "?" + request.query_string.decode("ascii")
        outbound = urllib.request.Request(
            destination,
            data=raw if request.method not in {"GET", "HEAD"} else None,
            method=request.method,
            headers=headers,
        )
        try:
            try:
                upstream = urllib.request.build_opener(
                    urllib.request.ProxyHandler({}), NoRedirect
                ).open(outbound, timeout=6)
            except urllib.error.HTTPError as error:
                upstream = error
            with upstream:
                body = upstream.read(262145)
                if len(body) > 262144:
                    raise ValueError("Oversized account response")
                response = current_app.response_class(body, status=upstream.status)
                response.headers.pop("Content-Type", None)
                for name in (
                    "Content-Type",
                    "Set-Cookie",
                    "Cache-Control",
                    "Vary",
                    "Retry-After",
                ):
                    for value in upstream.headers.get_all(name, []):
                        response.headers.add(name, value)
                response.headers["Cache-Control"] = "no-store"
                return response
        except (OSError, ValueError, urllib.error.URLError) as error:
            raise AccountsUnavailable("Account service unavailable") from error

    routes = {
        "/account/" + path: ["GET"] if path == "session" else ["POST"]
        for path in (
            "session",
            "login",
            "logout",
            "register",
            "verify-email",
            "resend-verification",
            "forgot-password",
            "reset-password",
            "profile",
            "delete",
        )
    }
    routes.update(
        {
            "/" + path: ["POST"]
            for path in (
                "login",
                "register",
                "verify-email",
                "resend-verification",
                "forgot-password",
                "reset-password",
            )
        }
    )
    routes.update({"/me": ["GET"], "/profile": ["PATCH"], "/account": ["DELETE"]})
    for index, (path, methods) in enumerate(routes.items()):
        blueprint.add_url_rule(path, f"account_{index}", relay, methods=methods)
    app.register_blueprint(blueprint)
