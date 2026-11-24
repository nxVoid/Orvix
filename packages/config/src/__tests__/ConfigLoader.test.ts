// SPDX-License-Identifier: AGPL-3.0-or-later

import {generateKeyPairSync} from 'node:crypto';
import {loadConfig, resetConfig} from '@relay/config/src/ConfigLoader';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

const MINIMAL_ENV: Record<string, string> = {
	ORVIX_ENV: 'test',
	ORVIX_BASE_DOMAIN: 'localhost',
	ORVIX_PUBLIC_SCHEME: 'http',
	ORVIX_PUBLIC_PORT: '8088',
	ORVIX_CASSANDRA_HOSTS: '127.0.0.1',
	ORVIX_CASSANDRA_PORT: '9042',
	ORVIX_CASSANDRA_KEYSPACE: 'orvix_test',
	ORVIX_CASSANDRA_LOCAL_DC: 'datacenter1',
	ORVIX_CASSANDRA_USERNAME: 'test-user',
	ORVIX_CASSANDRA_PASSWORD: 'test-password',
	ORVIX_S3_ENDPOINT: 'http://127.0.0.1:3900',
	ORVIX_S3_ACCESS_KEY_ID: 'test-key',
	ORVIX_S3_SECRET_ACCESS_KEY: 'test-secret',
	ORVIX_MEDIA_PROXY_SECRET_KEY: 'test-media-secret',
	ORVIX_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=',
	ORVIX_ADMIN_SECRET_KEY_BASE: 'test-admin-secret',
	ORVIX_ADMIN_OAUTH_CLIENT_SECRET: 'test-admin-oauth-secret',
	ORVIX_GATEWAY_RPC_AUTH_TOKEN: 'test-gateway-token',
	ORVIX_SUDO_MODE_SECRET: 'test-sudo-secret',
	ORVIX_CONNECTION_INITIATION_SECRET: 'test-connection-secret',
	ORVIX_PROFILE_PSEUDONYM_SECRET: 'test-profile-pseudonym-secret',
	ORVIX_VAPID_PUBLIC_KEY: 'BB76bTFIuoqmxJtTfZX0yGTn1f_qu9H03B_nkj8OyExJFkN7Y-HBZZzShnHZoEhXKc5ZRy3jFu7OkBbnaQG-4aw',
	ORVIX_VAPID_PRIVATE_KEY: 'Xgi-3P8J-I3Q6U1HlCcXMuc_tKLGAM9nIfznX3Hz68o',
};

function generateVapidPair(): {publicKey: string; privateKey: string} {
	const {privateKey} = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
	const jwk = privateKey.export({format: 'jwk'});
	const x = Buffer.from(jwk.x ?? '', 'base64url');
	const y = Buffer.from(jwk.y ?? '', 'base64url');
	const d = Buffer.from(jwk.d ?? '', 'base64url');
	return {
		publicKey: Buffer.concat([Buffer.from([0x04]), x, y]).toString('base64url'),
		privateKey: d.toString('base64url'),
	};
}

function stubMinimalEnv(overrides: Record<string, string> = {}): void {
	for (const [key, value] of Object.entries({...MINIMAL_ENV, ...overrides})) {
		vi.stubEnv(key, value);
	}
}

function clearRelayEnv(): void {
	for (const key of Object.keys(process.env)) {
		if (key.startsWith('ORVIX_')) {
			vi.stubEnv(key, undefined);
		}
	}
}

describe('ConfigLoader', () => {
	beforeEach(() => {
		resetConfig();
		clearRelayEnv();
	});

	afterEach(() => {
		resetConfig();
		vi.unstubAllEnvs();
	});

	test('a self-hosted instance without ORVIX_ENV runs in production', async () => {
		stubMinimalEnv({
			ORVIX_SELF_HOSTED: 'true',
			ORVIX_PROFILE_PSEUDONYM_SECRET: 'self-hosted-secret',
			ORVIX_POSTGRES_HOST: 'postgres',
			ORVIX_POSTGRES_DATABASE: 'orvix',
			ORVIX_POSTGRES_PASSWORD: 'self-hosted-password',
		});
		vi.stubEnv('ORVIX_ENV', undefined);
		expect((await loadConfig()).env).toBe('production');
	});

	test('reads the profile pseudonym secret and requires it in production', async () => {
		stubMinimalEnv();
		expect((await loadConfig()).auth.profile_pseudonym_secret).toBe('test-profile-pseudonym-secret');
		resetConfig();
		stubMinimalEnv({ORVIX_PROFILE_PSEUDONYM_SECRET: ''});
		expect((await loadConfig()).auth.profile_pseudonym_secret).toBe('relay-dev-profile-pseudonym-secret');
		resetConfig();
		stubMinimalEnv({
			ORVIX_ENV: 'production',
			ORVIX_POSTGRES_HOST: 'postgres.internal',
			ORVIX_POSTGRES_DATABASE: 'orvix_prod',
			ORVIX_POSTGRES_USERNAME: 'relay_app',
			ORVIX_POSTGRES_PASSWORD: 'prod-postgres-secret',
			ORVIX_POSTGRES_SSL: 'true',
			ORVIX_PROFILE_PSEUDONYM_SECRET: '',
		});
		await expect(loadConfig()).rejects.toThrow('ORVIX_PROFILE_PSEUDONYM_SECRET is required');
	});

	test('rejects unsafe production Postgres defaults', async () => {
		stubMinimalEnv({ORVIX_ENV: 'production'});
		await expect(loadConfig()).rejects.toThrow('ORVIX_POSTGRES_HOST');
	});

	test('allows self-hosted production Postgres without TLS', async () => {
		stubMinimalEnv({
			ORVIX_ENV: 'production',
			ORVIX_SELF_HOSTED: 'true',
			ORVIX_POSTGRES_HOST: 'postgres',
			ORVIX_POSTGRES_DATABASE: 'orvix',
			ORVIX_POSTGRES_USERNAME: 'orvix',
			ORVIX_POSTGRES_PASSWORD: 'self-hosted-postgres-secret',
			ORVIX_POSTGRES_SSL: 'false',
		});

		const config = await loadConfig();

		expect(config.instance.self_hosted).toBe(true);
		expect(config.database.postgres.ssl).toBe(false);
	});

	test('still requires TLS for non-self-hosted production Postgres', async () => {
		stubMinimalEnv({
			ORVIX_ENV: 'production',
			ORVIX_POSTGRES_HOST: 'postgres.internal',
			ORVIX_POSTGRES_DATABASE: 'orvix_prod',
			ORVIX_POSTGRES_USERNAME: 'relay_app',
			ORVIX_POSTGRES_PASSWORD: 'prod-postgres-secret',
			ORVIX_POSTGRES_SSL: 'false',
		});

		await expect(loadConfig()).rejects.toThrow('ORVIX_POSTGRES_SSL must be true');
	});

	test('rejects an App Store product mapped to an unknown slot', async () => {
		stubMinimalEnv({ORVIX_APP_STORE_PRODUCTS: '{"com.orvix.visionary":"visionary"}'});
		await expect(loadConfig()).rejects.toThrow(
			'Invalid ORVIX_APP_STORE_PRODUCTS slot for com.orvix.visionary: visionary',
		);
	});

	test('rejects a Google Play product mapped to an unknown slot', async () => {
		stubMinimalEnv({ORVIX_GOOGLE_PLAY_PRODUCTS: '{"plutonium:weekly":"weekly"}'});
		await expect(loadConfig()).rejects.toThrow('Invalid ORVIX_GOOGLE_PLAY_PRODUCTS slot for plutonium:weekly: weekly');
	});

	test('rejects a Google Play product key that does not fit its slot kind', async () => {
		stubMinimalEnv({ORVIX_GOOGLE_PLAY_PRODUCTS: '{"plutonium":"monthly"}'});
		await expect(loadConfig()).rejects.toThrow(
			'ORVIX_GOOGLE_PLAY_PRODUCTS key plutonium does not match its monthly slot',
		);
		resetConfig();
		stubMinimalEnv({ORVIX_GOOGLE_PLAY_PRODUCTS: '{"gift:one":"gift_1_month"}'});
		await expect(loadConfig()).rejects.toThrow(
			'ORVIX_GOOGLE_PLAY_PRODUCTS key gift:one does not match its gift_1_month slot',
		);
	});

	test('rejects a cache purge endpoint that contains credentials', async () => {
		stubMinimalEnv({
			ORVIX_CACHE_PURGE_ADAPTER: 'http',
			ORVIX_CACHE_PURGE_HTTP_ENDPOINT: 'https://purger:secret@purge.internal/purge',
		});
		await expect(loadConfig()).rejects.toThrow(
			'ORVIX_CACHE_PURGE_HTTP_ENDPOINT must be an absolute http or https URL without credentials',
		);
	});

	test('rejects a cache purge token with spaces or control characters without echoing it', async () => {
		for (const token of ['secret\nvalue', 'secret\rvalue', 'secret value', 'secret-value\n']) {
			stubMinimalEnv({
				ORVIX_CACHE_PURGE_ADAPTER: 'http',
				ORVIX_CACHE_PURGE_HTTP_ENDPOINT: 'https://purge.internal/purge',
				ORVIX_CACHE_PURGE_HTTP_TOKEN: token,
			});
			await expect(loadConfig()).rejects.toThrow(
				/^ORVIX_CACHE_PURGE_HTTP_TOKEN must contain only visible ASCII characters$/,
			);
		}
	});

	test('rejects a controller cache purge endpoint that is not https', async () => {
		stubMinimalEnv({
			ORVIX_CACHE_PURGE_ADAPTER: 'controller',
			ORVIX_CACHE_PURGE_CONTROLLER_ENDPOINT: 'http://controller.test/v1/orgs/a/sites/b/purge',
			ORVIX_CACHE_PURGE_CONTROLLER_TOKEN: 'pak_test',
		});
		await expect(loadConfig()).rejects.toThrow(
			'ORVIX_CACHE_PURGE_CONTROLLER_ENDPOINT must be an absolute https URL without credentials',
		);
	});

	test('rejects a missing upload relay secret', async () => {
		stubMinimalEnv();
		vi.stubEnv('ORVIX_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64', '');

		await expect(loadConfig()).rejects.toThrow('ORVIX_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64 is required');
	});

	test('rejects a non-base64 upload relay secret', async () => {
		stubMinimalEnv({ORVIX_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64: 'not base64!'});
		await expect(loadConfig()).rejects.toThrow('ORVIX_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64 must be base64');
	});

	test('rejects an upload relay secret shorter than 32 bytes', async () => {
		stubMinimalEnv({ORVIX_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64: Buffer.alloc(16, 7).toString('base64')});
		await expect(loadConfig()).rejects.toThrow(
			'ORVIX_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64 must decode to at least 32 bytes',
		);
	});

	test('rejects a VAPID public key that is not a 65-byte uncompressed point', async () => {
		const {privateKey} = generateVapidPair();
		stubMinimalEnv({
			ORVIX_VAPID_PUBLIC_KEY: Buffer.alloc(64, 4).toString('base64url'),
			ORVIX_VAPID_PRIVATE_KEY: privateKey,
		});
		await expect(loadConfig()).rejects.toThrow(
			/^ORVIX_VAPID_PUBLIC_KEY must be the base64url 65-byte uncompressed P-256 point\. Run rexctl doctor --fix/u,
		);
	});

	test('rejects a VAPID private key that is not a 32-byte scalar', async () => {
		const {publicKey} = generateVapidPair();
		stubMinimalEnv({
			ORVIX_VAPID_PUBLIC_KEY: publicKey,
			ORVIX_VAPID_PRIVATE_KEY: Buffer.alloc(31, 9).toString('base64url'),
		});
		await expect(loadConfig()).rejects.toThrow(
			/^ORVIX_VAPID_PRIVATE_KEY must be the base64url 32-byte P-256 scalar\. Run rexctl doctor --fix/u,
		);
	});

	test('rejects a well formed VAPID scalar that does not derive the public point', async () => {
		const {publicKey} = generateVapidPair();
		const other = generateVapidPair();
		stubMinimalEnv({
			ORVIX_VAPID_PUBLIC_KEY: publicKey,
			ORVIX_VAPID_PRIVATE_KEY: other.privateKey,
		});
		await expect(loadConfig()).rejects.toThrow('ORVIX_VAPID_PRIVATE_KEY does not match ORVIX_VAPID_PUBLIC_KEY');
	});

	test('accepts a generated VAPID pair', async () => {
		const pair = generateVapidPair();
		stubMinimalEnv({
			ORVIX_VAPID_PUBLIC_KEY: pair.publicKey,
			ORVIX_VAPID_PRIVATE_KEY: pair.privateKey,
		});

		const config = await loadConfig();

		expect(config.auth.vapid.public_key).toBe(pair.publicKey);
		expect(config.auth.vapid.private_key).toBe(pair.privateKey);
	});

	test('inserts the public port into every other public url the config contains', async () => {
		stubMinimalEnv({
			ORVIX_S3_PUBLIC_ENDPOINT: 'http://localhost/s3',
			ORVIX_EMAIL_APP_BASE_URL: 'http://localhost',
			ORVIX_AUTH_BLUESKY_CLIENT_URI: 'http://localhost',
			ORVIX_AUTH_BLUESKY_TOS_URI: 'http://localhost/terms',
			ORVIX_APP_ICON_URL: 'http://localhost/icon.png',
			ORVIX_LIVEKIT_INTERNAL_URL: 'http://livekit:7880',
		});

		const config = await loadConfig();

		expect(config.s3?.presigned_url_base).toBe('http://localhost:8088/s3');
		expect(config.integrations.email.app_base_url).toBe('http://localhost:8088');
		expect(config.auth.bluesky.client_uri).toBe('http://localhost:8088');
		expect(config.auth.bluesky.tos_uri).toBe('http://localhost:8088/terms');
		expect(config.instance.branding.icon_url).toBe('http://localhost:8088/icon.png');
		expect(config.integrations.voice.internal_url).toBe('http://livekit:7880');
	});
});

describe('ORVIX_PUBLIC_ORIGIN', () => {
	beforeEach(() => {
		resetConfig();
		clearRelayEnv();
	});

	afterEach(() => {
		resetConfig();
		vi.unstubAllEnvs();
	});

	test('a ported origin ports every derived endpoint and every compose override', async () => {
		stubMinimalEnv({
			ORVIX_BASE_DOMAIN: 'chat.example.com',
			ORVIX_PUBLIC_SCHEME: 'https',
			ORVIX_PUBLIC_PORT: '',
			ORVIX_PUBLIC_ORIGIN: 'https://chat.example.com:29080',
			ORVIX_MARKETING_ENDPOINT: 'https://chat.example.com:29080',
			ORVIX_MEDIA_ENDPOINT: 'https://chat.example.com:29080/media',
			ORVIX_MEDIA_PROXY_UPLOAD_RELAY_ENDPOINT: 'https://chat.example.com:29080/media',
			ORVIX_LIVEKIT_URL: 'https://chat.example.com:29080/livekit',
			ORVIX_PASSKEY_ADDITIONAL_ALLOWED_ORIGINS: 'https://chat.example.com:29080',
		});

		const config = await loadConfig();

		expect(config.domain.public_port).toBe(29080);
		expect(config.domain.public_origin).toBe('https://chat.example.com:29080');
		expect(config.endpoints.api_client).toBe('https://chat.example.com:29080/api');
		expect(config.endpoints.app).toBe('https://chat.example.com:29080');
		expect(config.endpoints.gateway).toBe('wss://chat.example.com:29080/gateway');
		expect(config.endpoints.admin).toBe('https://chat.example.com:29080/admin');
		expect(config.endpoints.marketing).toBe('https://chat.example.com:29080');
		expect(config.endpoints.media).toBe('https://chat.example.com:29080/media');
		expect(config.services.media_proxy.upload_relay.endpoint).toBe('https://chat.example.com:29080/media');
		expect(config.integrations.voice.url).toBe('https://chat.example.com:29080/livekit');
		expect(config.auth.passkeys.additional_allowed_origins).toEqual([
			'https://chat.example.com:29080',
			'android:apk-key-hash:keSY4bimyLqZQV7bKXgpa2xYuqXi0qZJzsYtp6gpx7w',
			'android:apk-key-hash:Ld4qnT0TfBeHMT3Yu2H0WTwqlxgFs-32uDmwqtLndsk',
		]);
	});

	test('the origin port wins over a ORVIX_PUBLIC_PORT that disagrees', async () => {
		stubMinimalEnv({
			ORVIX_BASE_DOMAIN: 'chat.example.com',
			ORVIX_PUBLIC_SCHEME: 'https',
			ORVIX_PUBLIC_PORT: '443',
			ORVIX_PUBLIC_ORIGIN: 'https://chat.example.com:29080',
		});

		const config = await loadConfig();

		expect(config.domain.public_port).toBe(29080);
		expect(config.endpoints.app).toBe('https://chat.example.com:29080');
		expect(config.endpoints.api_client).toBe('https://chat.example.com:29080/api');
		expect(config.endpoints.gateway).toBe('wss://chat.example.com:29080/gateway');
		expect(config.endpoints.admin).toBe('https://chat.example.com:29080/admin');
	});

	test('accepts an origin whose port matches ORVIX_PUBLIC_PORT', async () => {
		stubMinimalEnv({
			ORVIX_BASE_DOMAIN: 'chat.example.com',
			ORVIX_PUBLIC_SCHEME: 'https',
			ORVIX_PUBLIC_PORT: '29080',
			ORVIX_PUBLIC_ORIGIN: 'https://chat.example.com:29080',
		});

		expect((await loadConfig()).endpoints.gateway).toBe('wss://chat.example.com:29080/gateway');
	});

	test('normalizes an origin written with an explicit default port', async () => {
		stubMinimalEnv({
			ORVIX_BASE_DOMAIN: 'chat.example.com',
			ORVIX_PUBLIC_SCHEME: 'https',
			ORVIX_PUBLIC_PORT: '443',
			ORVIX_PUBLIC_ORIGIN: 'https://chat.example.com:443',
			ORVIX_ADMIN_ENDPOINT: 'https://chat.example.com/admin',
		});

		const config = await loadConfig();

		expect(config.domain.public_port).toBe(443);
		expect(config.domain.public_origin).toBe('https://chat.example.com');
		expect(config.endpoints.admin).toBe('https://chat.example.com/admin');
		expect(config.endpoints.app).toBe('https://chat.example.com');
		expect(config.endpoints.gateway).toBe('wss://chat.example.com/gateway');
	});

	test('takes the scheme and the domain from the origin when neither is set', async () => {
		stubMinimalEnv({
			ORVIX_BASE_DOMAIN: '',
			ORVIX_PUBLIC_SCHEME: '',
			ORVIX_PUBLIC_PORT: '',
			ORVIX_PUBLIC_ORIGIN: 'https://chat.example.com:29080',
		});

		const config = await loadConfig();

		expect(config.domain.base_domain).toBe('chat.example.com');
		expect(config.domain.public_scheme).toBe('https');
		expect(config.domain.public_port).toBe(29080);
	});

	test('the origin scheme wins over a ORVIX_PUBLIC_SCHEME that disagrees', async () => {
		stubMinimalEnv({
			ORVIX_BASE_DOMAIN: 'chat.example.com',
			ORVIX_PUBLIC_SCHEME: 'http',
			ORVIX_PUBLIC_PORT: '',
			ORVIX_PUBLIC_ORIGIN: 'https://chat.example.com',
		});

		const config = await loadConfig();

		expect(config.domain.public_scheme).toBe('https');
		expect(config.endpoints.app).toBe('https://chat.example.com');
		expect(config.endpoints.gateway).toBe('wss://chat.example.com/gateway');
	});

	test('the origin host wins over a ORVIX_BASE_DOMAIN that disagrees', async () => {
		stubMinimalEnv({
			ORVIX_BASE_DOMAIN: 'chat.example.com',
			ORVIX_PUBLIC_SCHEME: 'https',
			ORVIX_PUBLIC_PORT: '',
			ORVIX_PUBLIC_ORIGIN: 'https://other.example.com',
		});

		const config = await loadConfig();

		expect(config.domain.base_domain).toBe('other.example.com');
		expect(config.endpoints.app).toBe('https://other.example.com');
	});

	test('refuses to boot on an origin that is not a bare origin', async () => {
		stubMinimalEnv({ORVIX_PUBLIC_ORIGIN: 'https://chat.example.com/app'});
		await expect(loadConfig()).rejects.toThrow(
			'ORVIX_PUBLIC_ORIGIN must be a scheme, host and optional port such as https://chat.example.com:8443',
		);
	});

	test('leaves the derived origin canonical when nothing is set', async () => {
		stubMinimalEnv();
		expect((await loadConfig()).domain.public_origin).toBe('http://localhost:8088');
	});
});
