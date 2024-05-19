/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable import/no-internal-modules */
import { App, LogLevel, subtype, type BotMessageEvent, type BlockAction } from '@slack/bolt';

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true,
    logLevel: LogLevel.DEBUG,
});


(async () => {
    // Start your app
    await app.start(Number(process.env.PORT) || 3000);

    console.log('⚡️ Bolt app is running!');
})();

// subscribe to 'app_mention' event in your App config
// need app_mentions:read and chat:write scopes
app.event('app_mention', async ({ event, context, client, say }) => {
    console.log("triggered app_mention event");
    try {
        console.log("triggered app_mention event");
        await say({
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `Thanks for the mention <@${event.user}>! Here's a button`
                    },
                    "accessory": {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Button",
                            "emoji": true
                        },
                        "value": "click_me_123",
                        "action_id": "first_button"
                    }
                }
            ]
        });
    }
    catch (error) {
        console.error(error);
    }
});

// This will match any message that contains 👋
app.message(':wave:', async ({ message, say }) => {
    console.log("triggered wave event");
    // Handle only newly posted messages here
    if (message.subtype === undefined
        || message.subtype === 'bot_message'
        || message.subtype === 'file_share'
        || message.subtype === 'thread_broadcast') {
        await say(`Hello, <@${message.user}>`);
    }
});