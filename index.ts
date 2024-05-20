import { App, LogLevel } from '@slack/bolt';

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    appToken: process.env.SLACK_APP_TOKEN,
    logLevel: LogLevel.INFO,
    port: Number(process.env.PORT) || 3000,
});

// Listens to incoming messages that contain "hello"
app.message('hello', async ({ message, say }) => {
    // say() sends a message to the channel where the event was triggered
    await say(`Hey there!`);
});

// listen for new members joining the market - town square channels
app.event('member_joined_channel', async ({ event, client }) => {
    for (const [key, value] of Object.entries(channels.joinMonitor)) {
        if (event.channel === value) {
            await client.chat.postMessage({
                channel: channels.superDevLog!,
                text: `A new member <@${event.user}> has joined the ${key} channel!`,
            });
        }
    }
});

const channels = {
    superDevLog: process.env.SUPER_DEV_LOG_CHANNEL || "",
    dev: "C074B4QVBS8",
    logging: "C074B4VHJ76",
    joinMonitor: {
        market: "C06GA0PSXC5",
        craftery: "C06P09REBK4",
        smallberryFarms: "C06K8TDSFS5",
        spookTreeForest: "C06JF3MERUP",
        theRiverSploosh: "C06KJCY58GY",
        hillRockMine: "C06KJDF425N",
        townSquare: "C06R09H8GQ6",
    },
};

let env = process.env.NODE_ENV

let lchannel;
if (env === "production") {
    env = "beautiful";
    lchannel = channels.logging!;
} else if (env === "development") {
    env = "lush";
    lchannel = channels.dev!;
} else {
    env = "mysterious";
    lchannel = channels.superDevLog!;
}

(async () => {
    try {
        // Start your app
        await app.start(Number(process.env.PORT) || 3000);

        console.log('⚡️ Bolt app is running!');

        await app.client.chat.postMessage({
            channel: lchannel,
            text: `The old man todles off in the direction of the ${env} forest. :evergreen_tree: :axe:`,
        });
    } catch (error) {
        console.error(error);
    }
})();