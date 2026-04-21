<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Discord Boost Nitro Rewards

Enable reward events for members who start/stop boosting your Discord server.

Environment variables:

- `ENABLE_BOOST_REWARDS=true` to enable boost reward flow.
- `DISCORD_BOOST_REWARD_ROLE_ID=` optional role to add/remove when boost starts/stops.
- `REDIS_BOOST_CHANNEL=minedream:sync:boost` Redis channel for boost events.

Redis channel configuration:

- `REDIS_SYNC_SUCCESS_CHANNEL=minedream:sync:success` publishes successful account sync events.
- `REDIS_UNSYNC_CHANNEL=minedream:sync:success` publishes unsync events. Keep this the same as the sync success channel if your plugin subscribes to one shared sync channel.
- `REDIS_BOOST_CHANNEL=minedream:sync:boost` publishes boost start/end events.
- `REDIS_RANK_SYNC_CHANNEL=minedream:sync:rank` publishes Minecraft rank sync events.
- `REDIS_CHANNEL` is still supported as a legacy alias for `REDIS_SYNC_SUCCESS_CHANNEL`.

Published payloads to `REDIS_BOOST_CHANNEL`:

```json
{
  "type": "boost_start",
  "minecraftUuid": "00000000-0000-0000-0009-01fd1be232f4",
  "minecraftName": "KhunLeon",
  "discordId": "123456789012345678",
  "boosted": true
}
```

`type` will be `boost_start` or `boost_end`.

## Rank Sync Between Minecraft And Discord

You can sync multiple Minecraft groups to Discord roles and keep only the highest-weight rank.

Environment variables:

- `ENABLE_ROLE_SYNC=true` enables or disables Discord rank role updates.
- `SYNC_ROLE_MAPPINGS_FILE=rolemaps.yml` path to YAML role mapping file. This is the preferred option.
- `SYNC_ROLE_MAPPINGS=` JSON array fallback for rank mapping.
- `REDIS_RANK_SYNC_CHANNEL=minedream:sync:rank` Redis channel for rank sync events.

Example `rolemaps.yml`:

```yml
roles:
  - key: vip
    series: default
    weight: 10
    minecraftGroup: vip
    discordRoleId: '123456789012345678'

  - key: diamond
    series: default
    weight: 20
    minecraftGroup: diamond
    discordRoleId: '223456789012345678'

  - key: platinum
    series: default
    weight: 30
    minecraftGroup: platinum
    discordRoleId: '323456789012345678'

  - key: dreamplus
    series: special
    weight: 100
    minecraftGroup: dreamplus
    discordRoleId: '423456789012345678'
```

`minecraftGroups` is optional. Add it only if multiple LuckPerms group names should map to the same rank.
`series` is optional too. If omitted, it defaults to `default`. Weight only competes within the same series.

You can also still use `SYNC_ROLE_MAPPINGS` in `.env` if you want a single-file setup:

```json
[
  {
    "key": "vip",
    "series": "default",
    "weight": 10,
    "minecraftGroup": "vip",
    "discordRoleId": "123456789012345678"
  },
  {
    "key": "diamond",
    "series": "default",
    "weight": 20,
    "minecraftGroup": "diamond",
    "discordRoleId": "223456789012345678"
  },
  {
    "key": "platinum",
    "series": "default",
    "weight": 30,
    "minecraftGroup": "platinum",
    "discordRoleId": "323456789012345678"
  },
  {
    "key": "dreamplus",
    "series": "special",
    "weight": 100,
    "minecraftGroup": "dreamplus",
    "discordRoleId": "423456789012345678"
  }
]
```

Example behavior:

- `vip`, `diamond`, `platinum` are all in `default`, so only the highest one stays.
- `dreamplus` is in `special`, so it can stay together with `diamond`.
- If `ENABLE_ROLE_SYNC=false`, the API still resolves ranks and publishes Redis payloads, but it will not add or remove Discord roles.

How it works:

- Minecraft plugin sends the player's current groups to `POST /api/sync/rank`.
- API selects the highest `weight` from `SYNC_ROLE_MAPPINGS`.
- Discord roles from lower ranks are removed automatically.
- The API responds with `minecraftGroupToAdd` and `minecraftGroupsToRemove` so the plugin can remove old ranks and keep only the highest one in Minecraft too.
- A Redis event is published to `REDIS_RANK_SYNC_CHANNEL`.

Example request:

```http
POST /api/sync/rank
x-secret-key: your_secret_key_here
content-type: application/json

{
  "minecraftUuid": "00000000-0000-0000-0009-01fd1be232f4",
  "minecraftName": "KhunLeon",
  "groups": ["vip", "diamond"]
}
```

Example response:

```json
{
  "isSynced": true,
  "discordApplied": true,
  "effectiveRank": {
    "key": "diamond",
    "weight": 20,
    "minecraftGroup": "diamond",
    "discordRoleId": "223456789012345678"
  },
  "minecraftGroupToAdd": "diamond",
  "minecraftGroupsToRemove": ["vip"]
}
```

Example Redis payload:

```json
{
  "type": "rank_sync",
  "minecraftUuid": "00000000-0000-0000-0009-01fd1be232f4",
  "minecraftName": "KhunLeon",
  "discordId": "123456789012345678",
  "selectedRank": {
    "key": "diamond",
    "weight": 20,
    "minecraftGroup": "diamond",
    "discordRoleId": "223456789012345678"
  },
  "minecraftGroupToAdd": "diamond",
  "minecraftGroupsToRemove": ["vip"],
  "sourceGroups": ["vip", "diamond"]
}
```

## Linux Server tmux Run Templates

Run Windows `.exe` on Linux with Wine + tmux:

```bash
pnpm run start:tmux:exe
```

Requirements:

- `tmux`
- Wine (`wine64` or `wine`)
- built file `build/mc-discord-sync.exe`

If your server has Wine installed but command name differs, set it explicitly:

```bash
WINE_BIN=/usr/bin/wine pnpm run start:tmux:exe
```

Recommended (native Linux binary):

```bash
pnpm run build:linux
pnpm run start:tmux:linux
```

Tmux helpers:

```bash
tmux attach -t mc-sync
tmux capture-pane -pt mc-sync | tail -n 100
tmux kill-session -t mc-sync
```

Troubleshooting:

- If Wine prints `wine32 is missing` or GUI window warnings (`nodrv_CreateWindow`) in headless server mode, the app can still run.
- If the process exits with Discord outbound errors (for example `connect ...:443`), set `DISCORD_ENABLED=false` in `.env` to run API-only mode.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
