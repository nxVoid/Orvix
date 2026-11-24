# Relay bot and webhook platform audit

## Existing infrastructure

- Bot users and profiles: `relay_api/src/api/oauth/`, `models/Application.ts`, `models/User.ts`. Bot secrets use password hashes; API authentication accepts `Bot <token>`. Developer application UI already creates/resets tokens and builds bot invites.
- OAuth2 authorization, scopes, public/private bots and guild permission checks already exist. Preserve these contracts.
- Gateway: Erlang `gateway_handler_identify`, `session_bot_guilds`, dispatch, heartbeat and resume. Relay supports `ignored_events` and session flags; a Discord intent bitmask is not implemented.
- Composer slash commands are local actions (`features/devtools/hooks/useCommands.ts`); `MessageInteractionController` handles pins/reactions, not application commands. No native application command registry or interaction callback API was found.
- Webhooks: create/list/update/move/delete/token authentication, message execution/edit/delete, embeds and attachments already exist. Authenticated management verifies guild and channel permissions, including destination channel permissions.
- Channel and guild Webhooks settings already support create/name/avatar/move/copy/delete.
- Rich embeds support image (banner), thumbnail, title, description and color. Bot user profiles support avatar/banner. Webhooks have avatars; message banners are embed images, not webhook profile fields.
- Request logging uses route patterns, masking URL credentials even on early responses and unmatched routes.
- Logical Cassandra-style tables run through the PostgreSQL KV adapter as configured. Webhook token is part of the existing primary key. No schema change is needed for the initial webhook additions.

## Stages and files

1. Webhook management: WebhookController, WebhookRequestService, WebhookService, WebhookRepository; WebhookRequestSchemas; WebhookRateLimitConfig; new WebhookManagement integration tests. Add authenticated rotate-token and test-message endpoints. Retain token execution origin protection. Rotate by atomically replacing the existing row, without changing IDs/indexes or retaining old credentials.
2. Webhook UI: WebhookCommands, WebhookListItem and a new WebhookMessageComposer component/CSS. Reuse the settings tab, form components and design tokens. Fix optional-avatar updates so renaming does not clear avatars.
3. Bot platform: inspect composer dispatch and persistence before adding command registration/invocation and minimal Relay SDK/demo. Document Relay protocol differences explicitly. No fake Discord compatibility or unsupported interactions.
4. Validate targeted API/Gateway integration and UI type checks. Record actual results and outstanding limitations here.

## Boundaries

No Nexora changes, database/volume deletion, history reset, commit or push. Preserve existing rebranding. Tests must use isolated test harnesses, not reset the running Relay database. Bot runtime secrets belong only in server environment variables.

## Current scope after user clarification

The requested deliverable is now the existing infrastructure's usage, a four-command example bot, and webhook panel validation. `examples/relay-assistant` uses MESSAGE_CREATE and existing REST message endpoints, not the prototype command registry/interactions. The earlier prototype source files are retained for review; their ControllerRegistry/composer wiring has been removed so they do not change the existing runtime or poll in the background. No new database schema or migrations are required. See `examples/relay-assistant/README.md` for creation, token, OAuth2 invite, startup and webhook panel instructions. Native application commands, Discord intent compatibility and additional moderation/welcome commands are outside the narrowed scope.


## Validation of the narrowed deliverable

- Example tests: six passing checks for the four existing REST command flows, filtering/deduplication, avatar URL handling, credential-safe errors, mentions disabled and mocked Relay Gateway HELLO/heartbeat/MESSAGE_CREATE/stop.
- `WebhookManagement.test.ts`: four passing API harness checks, including create/rename/avatar removal/delete, copied token URL execution, token rotation, forbidden management, embeds/banner/thumbnail and mentions disabled.
- `RelayAssistantApi.test.ts`: two passing API harness checks for the existing OAuth2 bot invitation, bot REST operations, gateway discovery and invalid-secret rejection.
- Example TypeScript check passed using the workspace's installed compiler and Node types; no runtime npm packages installed for the bot.
- These use isolated in-memory API harnesses and a mocked Gateway transport. They do not claim a live deployed server, browser clipboard, OAuth2 browser UI or production media rendering test. No real bot token was supplied.
- Final API package TypeScript check: passed (`relay_api`, `tsc --noEmit`).
- Final app package TypeScript check: passed (`relay_app`, `tsc --noEmit`).
- All checks were run sequentially; no watchers, live bot, Rust build, deployment or Docker operations were started during the narrowed work.
