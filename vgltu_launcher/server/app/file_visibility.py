from app.models import SideType


_SERVER_ONLY_PREFIXES = (
    "config/",
    "defaultconfigs/",
    "scripts/",
    "world/",
    "logs/",
)
_SERVER_ONLY_FILENAMES = {
    "server.properties",
    "eula.txt",
    "ops.json",
    "whitelist.json",
    "banned-ips.json",
    "banned-players.json",
    "usercache.json",
}


def default_file_side(path: str) -> SideType:
    normalized = path.replace("\\", "/").lstrip("./").lower()
    if normalized.startswith(_SERVER_ONLY_PREFIXES) or normalized in _SERVER_ONLY_FILENAMES:
        return SideType.SERVER
    if "tlskincape" in normalized or "optifine" in normalized:
        return SideType.CLIENT
    if normalized.startswith(("shaderpacks/", "resourcepacks/")):
        return SideType.CLIENT
    if normalized.startswith("mods/"):
        return SideType.BOTH
    return SideType.SERVER


def archive_file_side(path: str) -> tuple[SideType, str]:
    normalized = path.replace("\\", "/").lstrip("./")
    prefixes = (
        ("client-mods/", SideType.CLIENT, "mods/"),
        ("server-mods/", SideType.SERVER, "mods/"),
        ("shared-mods/", SideType.BOTH, "mods/"),
        ("client-config/", SideType.CLIENT, "config/"),
        ("shared-config/", SideType.BOTH, "config/"),
    )
    for prefix, side, target_prefix in prefixes:
        if normalized.lower().startswith(prefix):
            return side, f"{target_prefix}{normalized[len(prefix):]}"
    return default_file_side(normalized), normalized
