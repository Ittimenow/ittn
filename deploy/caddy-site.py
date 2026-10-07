#!/usr/bin/env python3
"""Add/remove only ITTN routes, preserving the live configuration of other sites.

Run on fj-vps. Default is a validated dry run; --apply installs; --remove uninstalls.
Never reload the shared Caddyfile: it predates some currently active sites.
"""
import argparse
import copy
import datetime
import json
from pathlib import Path
import subprocess
import urllib.request

API = "http://127.0.0.1:2019/config/"
IDS = {"ittn-apex", "ittn-www"}
HOSTS = {"ittimenow.com", "www.ittimenow.com"}
FRAGMENT = Path(__file__).with_name("Caddyfile.ittn")


def site_routes():
    adapted = subprocess.run(
        ["docker", "exec", "-i", "fj-caddy-1", "caddy", "adapt",
         "--adapter", "caddyfile", "--config", "/dev/stdin"],
        input=FRAGMENT.read_bytes(), capture_output=True, check=True,
    )
    routes = json.loads(adapted.stdout)["apps"]["http"]["servers"]["srv0"]["routes"]
    for route in routes:
        host = route["match"][0]["host"]
        assert host in (["ittimenow.com"], ["www.ittimenow.com"]), host
        route["@id"] = "ittn-apex" if host == ["ittimenow.com"] else "ittn-www"
    assert {r["@id"] for r in routes} == IDS
    return routes


def prepare(config, desired, remove=False):
    candidate = copy.deepcopy(config)
    servers = candidate["apps"]["http"]["servers"]
    matches = [key for key, server in servers.items() if server.get("listen") == [":443"]]
    if len(matches) != 1:
        raise ValueError("Expected exactly one existing HTTPS server on :443")
    key = matches[0]
    routes = servers[key]["routes"]
    owned = [r for r in routes if r.get("@id") in IDS]
    expected = {r["@id"]: r for r in desired}
    if len({r["@id"] for r in owned}) != len(owned):
        raise ValueError("Duplicate ITTN route IDs")
    for route in owned:
        if route != expected[route["@id"]]:
            raise ValueError("An ITTN route differs from the approved template; refusing to overwrite")

    def check_hosts(value):
        if isinstance(value, dict):
            if value.get("@id") in IDS:
                return
            if HOSTS.intersection(value.get("host", [])):
                raise ValueError("An existing unmanaged route already uses an ITTN domain")
            for child in value.values():
                check_hosts(child)
        elif isinstance(value, list):
            for child in value:
                check_hosts(child)

    check_hosts(config)
    if remove:
        servers[key]["routes"] = [r for r in routes if r.get("@id") not in IDS]
    else:
        existing = {r["@id"] for r in owned}
        routes.extend(copy.deepcopy(r) for r in desired if r["@id"] not in existing)
    return candidate, key


def get_config():
    with urllib.request.urlopen(API, timeout=15) as response:
        return json.load(response), response.headers["Etag"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true")
    mode.add_argument("--remove", action="store_true")
    parser.add_argument("--root", type=Path, default=Path("/home/deploy/ittn"))
    parser.add_argument("--caddyfile", type=Path, default=Path("/opt/fj/deploy/caddy/Caddyfile"))
    args = parser.parse_args()
    current, etag = get_config()
    candidate, server = prepare(current, site_routes(), args.remove)
    block = "\n" + FRAGMENT.read_text()
    previous_file = args.caddyfile.read_text()
    if "# BEGIN ITTN MANAGED SITE" in previous_file and previous_file.count(block) != 1:
        raise ValueError("Shared Caddyfile contains an unexpected ITTN block")
    next_file = previous_file.replace(block, "") if args.remove else (
        previous_file if block in previous_file else previous_file + block
    )
    subprocess.run(
        ["docker", "exec", "-i", "fj-caddy-1", "caddy", "validate", "--config", "/dev/stdin"],
        input=json.dumps(candidate).encode(), check=True,
    )
    if not (args.apply or args.remove):
        print("Validated: only ITTN routes will change; shared Caddyfile will NOT be reloaded.")
        return
    if candidate == current and next_file == previous_file:
        print("Already in the requested state; nothing changed.")
        return
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup = args.root / "backups" / stamp
    backup.mkdir(parents=True, mode=0o700)
    for name, data in (("caddy-active.json", json.dumps(current, indent=2)),
                       ("caddy-candidate.json", json.dumps(candidate, indent=2)),
                       ("Caddyfile", previous_file)):
        target = backup / name
        target.touch(mode=0o600)
        target.write_text(data)
    latest, latest_etag = get_config()
    if latest != current or latest_etag != etag or args.caddyfile.read_text() != previous_file:
        raise RuntimeError("Concurrent configuration change detected; no changes applied")
    # Preserve the inode: this individual file is bind-mounted into Caddy.
    args.caddyfile.write_text(next_file)
    try:
        if candidate != current:
            payload = candidate["apps"]["http"]["servers"][server]["routes"]
            request = urllib.request.Request(
                API + "apps/http/servers/" + server + "/routes",
                data=json.dumps(payload).encode(), method="PATCH",
                headers={"Content-Type": "application/json", "If-Match": etag},
            )
            with urllib.request.urlopen(request, timeout=30) as response:
                assert response.status == 200
    except Exception:
        # Revert the file only if the API definitely did not accept this change.
        live, _ = get_config()
        if live == current and args.caddyfile.read_text() == next_file:
            args.caddyfile.write_text(previous_file)
        raise
    actual, _ = get_config()
    if actual != candidate or args.caddyfile.read_text() != next_file:
        raise RuntimeError("Post-apply mismatch; inspect backup before further changes: " + str(backup))
    print("Applied and verified. Other configuration is unchanged. Backup: " + str(backup))


if __name__ == "__main__":
    main()
