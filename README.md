# the-old-man

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

The slack bot needs to be created with the following permissions:
```yaml
display_information:
  name: The Old Man
features:
  app_home:
    home_tab_enabled: false
    messages_tab_enabled: true
    messages_tab_read_only_enabled: false
  bot_user:
    display_name: The Old Man
    always_online: false
oauth_config:
  scopes:
    bot:
      - app_mentions:read
      - channels:history
      - channels:read
      - chat:write
      - groups:history
      - groups:read
      - im:history
      - im:write
      - mpim:read
      - users.profile:read
      - im:read
settings:
  event_subscriptions:
    request_url: https://your-url.com/slack/events
    bot_events:
      - member_joined_channel
      - message.im
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

You also need to create a `.env` file with the following content:
```bash
SLACK_BOT_TOKEN=xoxb-xxxx-xxxxxxxxx-xxxxxxxxxxxxxxx
SLACK_SIGNING_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SLACK_APP_TOKEN=xapp-x-xxxxxxxxx-xxxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SLACK_BOT_ID=xxxxxxxxx

SUPER_DEV_LOG_CHANNEL=xxxxxxxxx
API_BEARER=smthingsupersecret

BAG_APP_TOKEN=xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxx # should have ADMIN permissions
BAG_APP_ID=xx

BAG_COMMAND_USERS=xxxxxx,xxxxxx,xxxxxx # comma separated list of user ids
```

This project was created using `bun init` in bun v1.1.7. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
