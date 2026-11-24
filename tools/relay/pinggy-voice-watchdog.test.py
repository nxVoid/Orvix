import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('watchdog', Path(__file__).with_name('pinggy-voice-watchdog.py'))
watchdog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watchdog)


class ProfileOwnershipTests(unittest.TestCase):
    def test_only_the_exact_tunnel_profile_can_be_restored(self):
        endpoint = {'nodeIp': '203.0.113.10', 'tcpPort': 39181}
        current = {'Config': {'Cmd': ['--node-ip', '203.0.113.10'],
                              'Env': ['LIVEKIT_RTC_TCP_PORT=39181']}}
        self.assertTrue(watchdog.profile_matches(current, endpoint))
        for changed in [
            {'Config': {'Cmd': ['--node-ip', '192.168.1.28'], 'Env': ['LIVEKIT_RTC_TCP_PORT=39181']}},
            {'Config': {'Cmd': ['--node-ip', '203.0.113.10'], 'Env': ['LIVEKIT_RTC_TCP_PORT=40000']}},
            {'Config': {'Cmd': [], 'Env': ['LIVEKIT_RTC_TCP_PORT=39181']}},
        ]:
            self.assertFalse(watchdog.profile_matches(changed, endpoint))

    def test_missing_process_is_not_treated_as_a_live_tunnel(self):
        self.assertIsNone(watchdog.process_identity(999999999))


if __name__ == '__main__':
    unittest.main()
