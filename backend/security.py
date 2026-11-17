import base64
import hashlib
import hmac
import os

PBKDF2_ITERATIONS = 600_000
_HASH_PREFIX = "pbkdf2_sha256"


def hash_password(password: str) -> str:
    if not isinstance(password, str) or not password or len(password) > 128:
        raise ValueError("Password must be between 1 and 128 characters")
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    salt_text = base64.urlsafe_b64encode(salt).decode("ascii").rstrip("=")
    digest_text = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return "$".join((_HASH_PREFIX, str(PBKDF2_ITERATIONS), salt_text, digest_text))


def _decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def verify_password(stored: str, candidate: str) -> bool:
    if not isinstance(stored, str) or not isinstance(candidate, str) or not candidate or len(candidate) > 128:
        return False
    if stored.startswith(_HASH_PREFIX + "$"):
        try:
            prefix, iterations_text, salt_text, digest_text = stored.split("$", 3)
            iterations = int(iterations_text)
            salt = _decode(salt_text)
            expected = _decode(digest_text)
            if prefix != _HASH_PREFIX or not 100_000 <= iterations <= 1_000_000 or len(salt) < 8 or len(expected) != 32:
                return False
            actual = hashlib.pbkdf2_hmac("sha256", candidate.encode("utf-8"), salt, iterations)
            return hmac.compare_digest(actual, expected)
        except (ValueError, TypeError):
            return False
    # One-time compatibility path for records created before password hashing was added.
    return hmac.compare_digest(stored.encode("utf-8"), candidate.encode("utf-8"))


def password_needs_rehash(stored: str) -> bool:
    if not isinstance(stored, str) or not stored.startswith(_HASH_PREFIX + "$"):
        return True
    try:
        prefix, iterations_text, _, _ = stored.split("$", 3)
        return prefix != _HASH_PREFIX or int(iterations_text) != PBKDF2_ITERATIONS
    except (ValueError, TypeError):
        return True
