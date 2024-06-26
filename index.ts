import { SlackApp } from "slack-edge";
import { Elysia } from 'elysia';
import { welcome } from './welcome';

import { Scheduler } from "./scheduler";

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
console.log('🌲 Environment ' + env)

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

const bagCommandPassword = process.env.BAG_COMMAND_PASSWORD || "plz";

const app = new SlackApp({
    env: {
        SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN!,
        SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET!,
        SLACK_APP_TOKEN: process.env.SLACK_APP_TOKEN!,
        SLACK_LOGGING_LEVEL: "INFO",
    },
    startLazyListenerAfterAck: true
});

// setup scheduler
const scheduler = new Scheduler(app.client);
await scheduler.loadJobsFromFile("data/jobs.json");
console.log(`🕰️  Scheduler loaded ${scheduler.listJobs().length} jobs`);

// save jobs to file every 5 minutes
setInterval(async () => {
    await scheduler.saveJobsToFile("data/jobs.json");
}, 300000);

// listen for new members joining the market - town square channels
app.event('member_joined_channel', async ({ context, payload }) => {
    for (const [key, value] of Object.entries(channels.joinMonitor)) {
        if (payload.channel === value) {
            await context.client.chat.postMessage({
                channel: lchannel,
                text: `A new member <@${payload.user}> has joined the <#${value}> channel!`,
            });
        }
    }
});

// listen for /old-man-demo command
app.command(env === "tall" ? "/old-man-demo" : "/old-man-demo-dev", async ({ context, payload }) => {
    // parse <@U05QJ4CF5QT|regards-cookers0a> to U05QJ4CF5QT
    const matchResult = payload.text.match(/<@(\w+)\|/);
    const password = payload.text.split(' ')[1];

    const userID = matchResult ? matchResult[1] : null;
    if (!userID) {
        console.error('User ID is missing');
        await context.respond({
            response_type: "ephemeral",
            text: `User ID is missing`,
        });
        return;
    }

    // check if the user is allowed to use the command
    if (bagCommandPassword !== password) {
        await context.respond({
            response_type: "ephemeral",
            text: `You are not allowed to use this command`,
        });
        return;
    }

    // send a ephemeral message to the user who used the command
    await context.respond({
        response_type: "ephemeral",
        text: `The mysterious old man was triggered for <@${userID}>! :evergreen_tree: :axe:`,
    });

    await app.client.chat.postMessage({
        channel: lchannel,
        text: `Elysia has been summoned for <@${userID}> by <@${payload.user_id}>! :sparkles:; Summoning <@${process.env.SLACK_BOT_ID}> to welcome them... :wave:`,
    });

    scheduler.addJob(async () => {
        await welcome(userID, app.client, scheduler);
    }, 0);
});

export default {
    port: 3000,
    async fetch(request: Request) {
        return await app.run(request);
    },
};

(async () => {
    try {
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
                    await app.client.chat.postMessage({
                        channel: lchannel,
                        text: `Elysia has been summoned for <@${body.userID}>! :sparkles:; Summoning <@${process.env.SLACK_BOT_ID}> to welcome them... :wave:`,
                    });

                    scheduler.addJob(async () => {
                        await welcome(body.userID, app.client, scheduler);
                    }, 0);

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
            }).listen(3001);

        console.log('🦊 Elysia is running!');

        await app.client.chat.postMessage({
            channel: lchannel,
            text: `The Mysterious Old Man toddles off in the direction of the ${env} forest. :evergreen_tree: :axe:`,
        });
    } catch (error) {
        console.error(error);
    }
})();

process.on('SIGINT', async function () {
    console.log('Caught interrupt signal');

    await scheduler.stopAllJobs();
    await scheduler.saveJobsToFile("data/jobs.json");
    process.exit();
});

process.on('SIGTERM', async function () {
    console.log('Caught terminate signal');

    await scheduler.stopAllJobs();
    await scheduler.saveJobsToFile("data/jobs.json");
    process.exit();
});
