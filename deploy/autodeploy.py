#!/usr/bin/env python3
"""Restricted SSH entry point for ITTN image delivery; no arbitrary shell commands."""
import contextlib
import datetime
import fcntl
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import shutil
import signal
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path('/home/deploy/ittn')
MAX_UPLOAD = 1024 ** 3
MAX_UNPACKED = 4 * 1024 ** 3
CANDIDATE = 'ittn-deploy-candidate'
IMAGE_PATTERN = re.compile(r'ittn:[a-zA-Z0-9_.-]+')


def parse_command(command):
    words = shlex.split(command)
    if words == ['status']:
        return None
    if (len(words) != 4 or words[0] != 'deploy'
            or not re.fullmatch(r'[0-9a-f]{40}', words[1])
            or not re.fullmatch(r'[0-9a-f]{64}', words[2])
            or not re.fullmatch(r'[1-9][0-9]{0,14}', words[3])):
        raise ValueError('Allowed commands: status | deploy COMMIT_SHA ARCHIVE_SHA256 RUN_NUMBER')
    return words[1], words[2], int(words[3])


def run(*args, timeout=180, capture=False):
    return subprocess.run(args, check=True, timeout=timeout, text=True,
                          stdout=subprocess.PIPE if capture else None).stdout


def atomic_write(path, data):
    with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, delete=False) as file:
        name = file.name
        file.write(data)
        file.flush()
        os.fsync(file.fileno())
    os.chmod(name, 0o600)
    os.replace(name, path)


def receive(stream, destination, expected_hash):
    digest = hashlib.sha256()
    size = 0
    with destination.open('wb') as output:
        while chunk := stream.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD:
                raise ValueError('Image upload exceeds 1 GiB')
            digest.update(chunk)
            output.write(chunk)
    if digest.hexdigest() != expected_hash:
        raise ValueError('Image archive checksum mismatch; live site is unchanged')


def sanitize_archive(source, destination, image, revision):
    """Only one approved tag is passed to Docker, even for dual Docker/OCI archives."""
    with tarfile.open(source, 'r:gz') as archive:
        members = []
        total = 0
        for member in archive:
            members.append(member)
            total += member.size
            if len(members) > 4096 or total > MAX_UNPACKED:
                raise ValueError('Image archive is too large')
        names = [m.name for m in members]
        if len(names) != len(set(names)):
            raise ValueError('Duplicate archive member')

        def read_json(name):
            member = archive.getmember(name)
            if not member.isfile() or member.size > 2 * 1024 ** 2:
                raise ValueError('Invalid image metadata')
            return json.load(archive.extractfile(member))

        manifest = read_json('manifest.json')
        if len(manifest) != 1 or manifest[0].get('RepoTags') != [image]:
            raise ValueError('Only the expected ITTN image tag may be loaded')
        entry = manifest[0]
        config = read_json(entry['Config'])
        if config.get('os') != 'linux' or config.get('architecture') != 'amd64':
            raise ValueError('Expected a linux/amd64 image')
        settings = config.get('config', {})
        if settings.get('User') not in ('node', '1000:1000'):
            raise ValueError('Image must use the unprivileged node user')
        if settings.get('Labels', {}).get('org.opencontainers.image.revision') != revision:
            raise ValueError('Image revision does not match the requested commit')
        selected = [entry['Config'], *entry['Layers']]
        if len(selected) != len(set(selected)):
            raise ValueError('Duplicate image layer/config')
        for name in selected:
            path = PurePosixPath(name)
            if path.is_absolute() or '..' in path.parts or not archive.getmember(name).isfile():
                raise ValueError('Invalid image member path/type')
        if shutil.disk_usage(destination.parent).free < sum(archive.getmember(n).size for n in selected) + 2 * 1024 ** 3:
            raise ValueError('Insufficient disk space; live site is unchanged')
        # Do not forward index.json/repositories or unrelated tags to docker load.
        with tarfile.open(destination, 'w') as clean:
            for name in selected:
                member = archive.getmember(name)
                clean.addfile(member, archive.extractfile(member))
            data = json.dumps(manifest).encode()
            member = tarfile.TarInfo('manifest.json')
            member.size = len(data)
            clean.addfile(member, io.BytesIO(data))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def check_http(port):
    opener = urllib.request.build_opener(NoRedirect())
    checks = {'/': 200, '/about/': 200, '/services/ai/': 200,
              '/robots.txt': 200, '/sitemap-index.xml': 200,
              '/services/web/': 301, '/missing-autodeploy-health-check/': 404}
    for path, expected in checks.items():
        try:
            response = opener.open(f'http://127.0.0.1:{port}{path}', timeout=10)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            body = response.read().decode()
            if response.status != expected:
                raise RuntimeError(f'{path}: expected {expected}, got {response.status}')
            if path == '/' and (response.headers.get('X-Robots-Tag') or 'https://ittimenow.com/' not in body):
                raise RuntimeError('Production metadata check failed')
            if path == '/robots.txt' and ('Disallow: /\n' in body or 'https://ittimenow.com/sitemap-index.xml' not in body):
                raise RuntimeError('Production robots check failed')
            if expected == 301 and response.headers.get('Location') != '/services/sites/':
                raise RuntimeError('Redirect check failed')
            if expected == 404 and 'noindex' not in response.headers.get('X-Robots-Tag', ''):
                raise RuntimeError('404 indexing check failed')


def wait_healthy(container, seconds=75):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        state = json.loads(run('docker', 'inspect', container, '--format', '{{json .State}}', capture=True))
        if state.get('Health', {}).get('Status') == 'healthy':
            return
        if state['Status'] in ('exited', 'dead') or state.get('Health', {}).get('Status') == 'unhealthy':
            raise RuntimeError(f'{container} failed its healthcheck')
        time.sleep(2)
    raise TimeoutError(f'{container} healthcheck timed out')


def compose_up():
    run('docker', 'compose', '--project-directory', str(ROOT), '-f', str(ROOT / 'compose.yml'),
        'up', '-d', '--no-deps', '--wait', '--wait-timeout', '90', 'web')


def remove_candidate():
    result = subprocess.run(['docker', 'inspect', CANDIDATE], capture_output=True, text=True, timeout=30)
    if result.returncode:
        if 'No such object' in result.stderr:
            return
        raise RuntimeError('Cannot inspect the temporary ITTN container')
    data = json.loads(result.stdout)[0]
    if data['Config'].get('Labels', {}).get('com.ittn.autodeploy.candidate') != 'true':
        raise ValueError('Candidate name is occupied by an unmanaged container')
    run('docker', 'rm', '-f', CANDIDATE)


def switch_image(image):
    env = ROOT / '.env'
    previous = env.read_text()
    if not re.fullmatch(r'ITTN_IMAGE=ittn:[a-zA-Z0-9_.-]+\n?', previous):
        raise ValueError('Unexpected existing ITTN environment file')
    atomic_write(ROOT / 'previous.env', previous)
    atomic_write(env, f'ITTN_IMAGE={image}\n')
    try:
        compose_up()
        check_http(4321)
    except BaseException:
        print('New release failed; restoring the previous ITTN image.', flush=True)
        atomic_write(env, previous)
        compose_up()
        check_http(4321)
        raise


def cleanup_releases(current, previous):
    """Retain three successful CI releases and both images needed for rollback."""
    releases = []
    for file in (ROOT / 'releases').glob('ci-*/manifest.json'):
        with contextlib.suppress(ValueError, KeyError):
            data = json.loads(file.read_text())
            releases.append((int(data['run_number']), file.parent, data['image']))
    releases.sort(reverse=True)
    for _, directory, image in releases[3:]:
        if image not in (current, previous) and re.fullmatch(r'ittn:sha-[0-9a-f]{40}', image):
            subprocess.run(['docker', 'image', 'rm', image], check=False, timeout=60)
            shutil.rmtree(directory)


def deploy(revision, checksum, run_number):
    image = 'ittn:sha-' + revision
    releases = ROOT / 'releases'
    releases.mkdir(exist_ok=True)
    if shutil.disk_usage(ROOT).free < MAX_UPLOAD + 2 * 1024 ** 3:
        raise ValueError('At least 3 GiB of free space is needed before receiving a release')
    with tempfile.TemporaryDirectory(prefix='.incoming-', dir=ROOT) as temporary:
        temporary = Path(temporary)
        compressed = temporary / 'image.tar.gz'
        receive(sys.stdin.buffer, compressed, checksum)
        state_file = ROOT / 'deployment.json'
        previous_state = json.loads(state_file.read_text()) if state_file.exists() else {}
        if run_number < previous_state.get('run_number', 0):
            print('Skipped an older workflow run; newer release is already deployed.')
            return
        current = (ROOT / '.env').read_text().strip().removeprefix('ITTN_IMAGE=')
        if not IMAGE_PATTERN.fullmatch(current):
            raise ValueError('Unexpected current image')
        if current == image:
            wait_healthy('ittn-web-1')
            check_http(4321)
            print('This commit is already deployed and healthy.')
            return
        safe_tar = temporary / 'image.tar'
        sanitize_archive(compressed, safe_tar, image, revision)
        run('docker', 'load', '-i', str(safe_tar), timeout=300)
        safe_tar.unlink()
        remove_candidate()
        candidate_started = False
        try:
            candidate_started = True
            run('docker', 'run', '-d', '--name', CANDIDATE, '--network', 'ittn_default',
                '--label', 'com.ittn.autodeploy.candidate=true',
                '--user', '1000:1000', '--read-only', '--cap-drop', 'ALL', '--security-opt',
                'no-new-privileges', '--memory', '256m', '--cpus', '0.5', '--pids-limit', '64',
                '--init', '--log-opt', 'max-size=10m', '--log-opt', 'max-file=2',
                '-p', '127.0.0.1:4322:4321', image)
            wait_healthy(CANDIDATE)
            check_http(4322)
            release = json.loads(run('docker', 'exec', CANDIDATE, 'node', '-e',
                                    "console.log(require('fs').readFileSync('dist/.release.json','utf8'))", capture=True))
            if release.get('production') is not True or release.get('site') != 'https://ittimenow.com':
                raise ValueError('Candidate is not an ITTN production build')
            remove_candidate()
            candidate_started = False
            switch_image(image)
        except BaseException:
            if candidate_started:
                remove_candidate()
            if image not in (ROOT / '.env').read_text():
                subprocess.run(['docker', 'image', 'rm', image], check=False, timeout=60)
            raise
        directory = releases / ('ci-' + revision)
        directory.mkdir(exist_ok=True)
        shutil.move(str(compressed), directory / 'image.tar.gz')
        manifest = {'revision': revision, 'run_number': run_number, 'image': image,
                    'previous_image': current, 'archive_sha256': checksum,
                    'deployed_at': datetime.datetime.now(datetime.timezone.utc).isoformat()}
        atomic_write(directory / 'manifest.json', json.dumps(manifest, indent=2) + '\n')
        atomic_write(state_file, json.dumps(manifest, indent=2) + '\n')
        try:
            cleanup_releases(image, current)
        except Exception as error:
            print('Release is healthy; old-release cleanup needs attention:', error, flush=True)
        print(json.dumps(manifest), flush=True)


def interrupted(signum, frame):
    raise RuntimeError('Deployment interrupted by signal ' + str(signum))


def main():
    command = parse_command(os.environ.get('SSH_ORIGINAL_COMMAND', ''))
    if command is None:
        print((ROOT / 'deployment.json').read_text() if (ROOT / 'deployment.json').exists() else (ROOT / '.env').read_text())
        return
    os.umask(0o077)
    for name in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
        signal.signal(name, interrupted)
    with (ROOT / '.deploy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        deploy(*command)


if __name__ == '__main__':
    main()
