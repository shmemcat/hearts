"""In-process account boundary. No Flask objects, ORM rows, or account secrets."""

from dataclasses import dataclass
from typing import Iterable, Optional, Protocol

ACCOUNT_CONTRACT_VERSION = 1


class AccountsUnavailable(RuntimeError):
    """Validation could not complete; callers must not treat this as a guest."""


@dataclass(frozen=True)
class AccountIdentity:
    id: int
    username: str
    profile_icon: str
    email_verified: bool


@dataclass(frozen=True)
class AccountSession:
    csrf_token: str


@dataclass(frozen=True)
class DeletionResult:
    deleted: bool
    message: str
    status_code: int


class Accounts(Protocol):
    def session(self) -> Optional[AccountSession]: ...
    def cookie_user(self) -> Optional[AccountIdentity]: ...
    def legacy_user(self, token: str) -> Optional[AccountIdentity]: ...
    def public_profiles(
        self, user_ids: Iterable[int]
    ) -> dict[int, AccountIdentity]: ...
    def valid_origin(self) -> bool: ...
    def valid_csrf(self) -> bool: ...
    def refresh(self) -> None: ...
    def delete_account(self, user_id: int, password: str) -> DeletionResult: ...
