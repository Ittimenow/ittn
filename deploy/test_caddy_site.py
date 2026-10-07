import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("caddy_site", Path(__file__).with_name("caddy-site.py"))
site = importlib.util.module_from_spec(spec)
spec.loader.exec_module(site)


class RouteIsolationTest(unittest.TestCase):
    def setUp(self):
        self.original = {"apps": {"http": {"servers": {
            "srv0": {"listen": [":443"], "routes": [
                {"match": [{"host": ["other.example"]}], "handle": [{"handler": "reverse_proxy"}]}
            ]}, "srv1": {"listen": [":80"], "routes": []}
        }}, "tls": {"automation": {"policies": [{"issuers": [{"module": "acme"}]}]}}}}
        self.desired = [
            {"@id": "ittn-apex", "match": [{"host": ["ittimenow.com"]}]},
            {"@id": "ittn-www", "match": [{"host": ["www.ittimenow.com"]}]},
        ]

    def test_add_preserves_every_other_setting_and_is_idempotent(self):
        before = copy.deepcopy(self.original)
        added, key = site.prepare(self.original, self.desired)
        self.assertEqual(self.original, before)
        self.assertEqual(key, "srv0")
        again, _ = site.prepare(added, self.desired)
        self.assertEqual(added, again)
        removed, _ = site.prepare(added, self.desired, remove=True)
        self.assertEqual(removed, before)

    def test_refuses_unmanaged_domain_collision(self):
        self.original["apps"]["http"]["servers"]["srv0"]["routes"][0]["match"] = [
            {"host": ["ittimenow.com"]}
        ]
        with self.assertRaisesRegex(ValueError, "unmanaged"):
            site.prepare(self.original, self.desired)

    def test_refuses_to_replace_a_changed_owned_route(self):
        added, _ = site.prepare(self.original, self.desired)
        added["apps"]["http"]["servers"]["srv0"]["routes"][-1]["terminal"] = True
        with self.assertRaisesRegex(ValueError, "differs"):
            site.prepare(added, self.desired)


if __name__ == "__main__":
    unittest.main()
