import base64
import hashlib
import hmac
import os

from cryptography.fernet import Fernet, InvalidToken


_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1
_SCRYPT_DKLEN = 64
_SFTP_ENCRYPTION_KEY_ENV = "SFTP_ENCRYPTION_KEY"


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
        dklen=_SCRYPT_DKLEN,
    )
    return "$".join(
        (
            "scrypt",
            str(_SCRYPT_N),
            str(_SCRYPT_R),
            str(_SCRYPT_P),
            base64.b64encode(salt).decode("ascii"),
            base64.b64encode(digest).decode("ascii"),
        )
    )


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, n, r, p, encoded_salt, encoded_digest = password_hash.split("$")
        if algorithm != "scrypt":
            return False
        expected = base64.b64decode(encoded_digest, validate=True)
        digest = hashlib.scrypt(
            password.encode("utf-8"),
            salt=base64.b64decode(encoded_salt, validate=True),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(expected),
        )
    except (AttributeError, ValueError):
        return False
    return hmac.compare_digest(digest, expected)


def _sftp_fernet() -> Fernet:
    key = os.getenv(_SFTP_ENCRYPTION_KEY_ENV)
    if not key:
        raise RuntimeError(f"{_SFTP_ENCRYPTION_KEY_ENV} is required for SFTP credentials")
    try:
        return Fernet(key.encode("ascii"))
    except (UnicodeEncodeError, ValueError) as error:
        raise RuntimeError(f"{_SFTP_ENCRYPTION_KEY_ENV} is invalid") from error


def encrypt_sftp_secret(value: str) -> str:
    return _sftp_fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_sftp_secret(value: str) -> str:
    try:
        return _sftp_fernet().decrypt(value.encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeDecodeError) as error:
        raise RuntimeError("Stored SFTP credential cannot be decrypted") from error
