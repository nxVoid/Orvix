#!/usr/bin/env python3
"""Restore only this session's Relay LiveKit LAN profile when its TCP tunnel ends."""
import argparse
import ipaddress
import json
import os
from pathlib import Path
import signal
import subprocess
import time

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / '.relay/runtime'
CONTAINER = 'orvix-dev-livekit-1'


def process_identity(pid):
    try:
        text = Path(f'/proc/{pid}/stat').read_text()
        fields = text[text.rfind(')') + 2:].split()
        return None if fields[0] == 'Z' else fields[19]
    except (FileNotFoundError, ProcessLookupError):
        return None


def profile_matches(info, endpoint):
    config = info.get('Config', {})
    command = config.get('Cmd', [])
    try:
        node_ip = command[command.index('--node-ip') + 1]
    except (ValueError, IndexError):
        return False
    return (node_ip == endpoint['nodeIp'] and
            f"LIVEKIT_RTC_TCP_PORT={endpoint['tcpPort']}" in config.get('Env', []))


def restore(endpoint, ssh_pid, bridge_pid, bridge_identity, lan_ip):
    lock = RUNTIME / 'pinggy-voice-rollback.lock'
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        print('Another scoped rollback is already running.', flush=True)
        return
    os.close(fd)
    try:
        if int((RUNTIME / 'pinggy-voice-tunnel.pid').read_text()) != ssh_pid:
            print('A newer tunnel session owns the profile; leaving it alone.', flush=True)
            return
        result = subprocess.run(['docker', 'inspect', CONTAINER], check=True,
                                capture_output=True, text=True)
        if not profile_matches(json.loads(result.stdout)[0], endpoint):
            print('LiveKit profile was changed separately; leaving it alone.', flush=True)
            return
        env = os.environ.copy()
        env['ORVIX_DEV_LIVEKIT_NODE_IP'] = lan_ip
        env['ORVIX_DEV_LIVEKIT_TCP_PORT'] = '7881'
        subprocess.run(['docker', 'compose', '-p', 'orvix-dev', '-f',
                        str(ROOT / '.devcontainer/docker-compose.yml'),
                        'up', '-d', '--no-deps', '--no-build', 'livekit'],
                       cwd=ROOT, env=env, check=True)
        if bridge_identity is not None and process_identity(bridge_pid) == bridge_identity:
            os.kill(bridge_pid, signal.SIGTERM)
        print(f'Relay LiveKit restored to LAN {lan_ip}:7881.', flush=True)
    finally:
        lock.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lan-ip', required=True)
    parser.add_argument('--stop', action='store_true', help='Stop this TCP tunnel and restore LAN now.')
    args = parser.parse_args()
    address = ipaddress.ip_address(args.lan_ip)
    if address.version != 4 or not address.is_private or address.is_loopback:
        parser.error('--lan-ip must be the verified workstation LAN IPv4 address')
    endpoint = json.loads((RUNTIME / 'pinggy-voice-endpoint.json').read_text())
    ssh_pid = int((RUNTIME / 'pinggy-voice-tunnel.pid').read_text())
    bridge_pid = int((RUNTIME / 'pinggy-voice-bridge.pid').read_text())
    ssh_identity = process_identity(ssh_pid)
    bridge_identity = process_identity(bridge_pid)
    if args.stop:
        command = Path(f'/proc/{ssh_pid}/cmdline')
        if ssh_identity is not None and b'tcp@free.pinggy.io' in command.read_bytes():
            os.kill(ssh_pid, signal.SIGTERM)
    else:
        print('Watching the temporary Pinggy TCP tunnel; automatic LAN fallback is armed.', flush=True)
        while ssh_identity is not None and process_identity(ssh_pid) == ssh_identity:
            time.sleep(3)
    restore(endpoint, ssh_pid, bridge_pid, bridge_identity, str(address))


if __name__ == '__main__':
    main()
