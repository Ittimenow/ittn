import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('autodeploy', Path(__file__).with_name('autodeploy.py'))
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)
SHA = 'a' * 40
IMAGE = 'ittn:sha-' + SHA


class DeploymentSafetyTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def archive(self, tags=None, user='node', revision=SHA, extra_index=False):
        source = self.root / 'image.tar.gz'
        config = {'os': 'linux', 'architecture': 'amd64', 'config': {
            'User': user, 'Labels': {'org.opencontainers.image.revision': revision}}}
        manifest = [{'Config': 'config.json', 'RepoTags': tags or [IMAGE], 'Layers': ['layer.tar']}]
        data = {'config.json': json.dumps(config).encode(), 'manifest.json': json.dumps(manifest).encode(), 'layer.tar': b'test layer'}
        if extra_index:
            data['index.json'] = b'{"manifests":[{"annotations":{"io.containerd.image.name":"other-project:latest"}}]}'
            data['repositories'] = b'{"other-project":{"latest":"something"}}'
        with tarfile.open(source, 'w:gz') as archive:
            for name, content in data.items():
                member = tarfile.TarInfo(name)
                member.size = len(content)
                archive.addfile(member, io.BytesIO(content))
        return source

    def test_restricted_key_rejects_shell_and_invalid_arguments(self):
        self.assertEqual(deploy.parse_command(f'deploy {SHA} {"b"*64} 5'), (SHA, 'b'*64, 5))
        for command in ['bash', 'status; id', 'deploy ../file x 1', f'deploy {SHA} {"b"*64} -1']:
            with self.subTest(command=command), self.assertRaises(ValueError):
                deploy.parse_command(command)

    def test_checksum_failure_never_reaches_docker(self):
        with self.assertRaisesRegex(ValueError, 'checksum'):
            deploy.receive(io.BytesIO(b'truncated transfer'), self.root / 'upload', '0' * 64)

    def test_extra_oci_tags_are_not_forwarded_to_docker(self):
        clean = self.root / 'clean.tar'
        deploy.sanitize_archive(self.archive(extra_index=True), clean, IMAGE, SHA)
        with tarfile.open(clean) as archive:
            self.assertEqual(set(archive.getnames()), {'manifest.json', 'config.json', 'layer.tar'})
            self.assertEqual(json.load(archive.extractfile('manifest.json'))[0]['RepoTags'], [IMAGE])

    def test_cannot_replace_another_projects_image(self):
        with self.assertRaisesRegex(ValueError, 'expected ITTN'):
            deploy.sanitize_archive(self.archive(tags=[IMAGE, 'joyos-app:latest']), self.root / 'clean', IMAGE, SHA)

    def test_rejects_root_images_and_wrong_revision(self):
        for options in [{'user': 'root'}, {'revision': 'b' * 40}]:
            with self.subTest(options=options), self.assertRaises(ValueError):
                deploy.sanitize_archive(self.archive(**options), self.root / 'clean', IMAGE, SHA)

    def test_failed_live_healthcheck_restores_previous_image(self):
        before = 'ITTN_IMAGE=ittn:previous\n'
        (self.root / '.env').write_text(before)
        images_seen = []
        def start():
            images_seen.append((self.root / '.env').read_text())
        with patch.object(deploy, 'ROOT', self.root), patch.object(deploy, 'compose_up', side_effect=start), \
                patch.object(deploy, 'check_http', side_effect=[RuntimeError('bad response'), None]):
            with self.assertRaisesRegex(RuntimeError, 'bad response'):
                deploy.switch_image(IMAGE)
        self.assertEqual(images_seen, [f'ITTN_IMAGE={IMAGE}\n', before])
        self.assertEqual((self.root / '.env').read_text(), before)
        self.assertEqual((self.root / 'previous.env').read_text(), before)

    def test_failed_compose_start_also_rolls_back(self):
        (self.root / '.env').write_text('ITTN_IMAGE=ittn:previous\n')
        with patch.object(deploy, 'ROOT', self.root), patch.object(deploy, 'compose_up', side_effect=[RuntimeError('start failed'), None]), \
                patch.object(deploy, 'check_http') as health:
            with self.assertRaisesRegex(RuntimeError, 'start failed'):
                deploy.switch_image(IMAGE)
        self.assertEqual((self.root / '.env').read_text(), 'ITTN_IMAGE=ittn:previous\n')
        health.assert_called_once_with(4321)

    def test_will_not_delete_a_container_without_ittn_label(self):
        import subprocess
        result = subprocess.CompletedProcess([], 0, stdout=json.dumps([{'Config': {'Labels': {'project': 'other'}}}]), stderr='')
        with patch.object(deploy.subprocess, 'run', return_value=result), patch.object(deploy, 'run') as command:
            with self.assertRaisesRegex(ValueError, 'unmanaged'):
                deploy.remove_candidate()
            command.assert_not_called()

    def test_missing_candidate_is_safe_for_both_docker_error_formats(self):
        import subprocess
        for message in ['Error: No such object', 'error: no such object']:
            with self.subTest(message=message):
                result = subprocess.CompletedProcess([], 1, stdout='[]\n',
                    stderr=f'{message}: {deploy.CANDIDATE}\n')
                with patch.object(deploy.subprocess, 'run', return_value=result), \
                        patch.object(deploy, 'run') as command:
                    deploy.remove_candidate()
                    command.assert_not_called()

    def test_candidate_inspection_errors_are_not_ignored(self):
        import subprocess
        for message in ['Cannot connect to the Docker daemon', 'error: no such object: other-container']:
            with self.subTest(message=message):
                result = subprocess.CompletedProcess([], 1, stdout='', stderr=message)
                with patch.object(deploy.subprocess, 'run', return_value=result), \
                        patch.object(deploy, 'run') as command:
                    with self.assertRaisesRegex(RuntimeError, 'Cannot inspect'):
                        deploy.remove_candidate()
                    command.assert_not_called()

    def test_removes_only_the_labelled_candidate(self):
        import subprocess
        result = subprocess.CompletedProcess([], 0, stdout=json.dumps([{'Config': {
            'Labels': {'com.ittn.autodeploy.candidate': 'true'}}}]), stderr='')
        with patch.object(deploy.subprocess, 'run', return_value=result), \
                patch.object(deploy, 'run') as command:
            deploy.remove_candidate()
            command.assert_called_once_with('docker', 'rm', '-f', deploy.CANDIDATE)


if __name__ == '__main__':
    unittest.main()
