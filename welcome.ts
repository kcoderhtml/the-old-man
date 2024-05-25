import { WebClient } from "@slack/web-api";

export async function welcome(userID: string, client: WebClient) {
    // send a welcome message to the user
    await client.chat.postMessage({
        channel: userID,
        text: "Welcome to Bag! I'm the old man who toddles",
    });
}

export async function clear(userID: string, client: WebClient) {
    // delete all messages sent to the user
    // list conversations and pick the one with the user
    const conversations = await client.conversations.list({
        types: "im",
    });
    console.log(conversations);
    const conversation = conversations.channels?.find((channel) => channel.user === userID);
    await client.conversations.history({
        channel: conversation?.id as string,
    }).then(async (res) => {
        for (const message of res.messages as any[]) {
            console.log(message);
            await client.chat.delete({
                channel: userID,
                ts: message.ts as string,
            });
        }
    });
}