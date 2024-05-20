import { App, LogLevel } from '@slack/bolt';
import { Elysia } from 'elysia';

import { welcome } from './welcome';

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    appToken: process.env.SLACK_APP_TOKEN,
    logLevel: LogLevel.INFO,
    port: Number(process.env.PORT) || 3000,
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
    env = "tall";
    lchannel = channels.logging!;
} else if (env === "development") {
    env = "young";
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

        // setup endpoint for Elysia
        const elysia = new Elysia()
            .post('/', async ({ request }) => {
                const body: { userID: string } = await request.json();
                const bearer = request.headers.get('Authorization');
                if (!bearer || bearer !== process.env.API_BEARER) {
                    console.error('Bearer token is missing or incorrect', bearer);
                    return new Response(JSON.stringify({ ok: false, error: "Bearer token is missing or incorrect" }), {
                        status: 403,
                        statusText: 'Forbidden',
                        headers: {
                            'Content-Type': 'text/plain',
                        },
                    });
                }

                try {
                    await welcome(body.userID, app.client);
                    return JSON.stringify({ ok: true, userID: body.userID });
                } catch (error) {
                    console.error('Error parsing JSON:', error);
                    return new Response(null, {
                        status: 400,
                        statusText: 'Bad Request',
                        headers: {
                            'Content-Type': 'text/plain',
                        },
                    });
                }
            }).listen(process.env.ELYSIA_PORT || 3001);

        console.log('🦊 Elysia is running!');

        await app.client.chat.postMessage({
            channel: lchannel,
            text: `The old man toddles off in the direction of the ${env} forest. :evergreen_tree: :axe:`,
        });
    } catch (error) {
        console.error(error);
    }
})();