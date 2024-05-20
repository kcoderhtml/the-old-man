import { WebClient } from "@slack/web-api";

export async function welcome(userID: string, client: WebClient) {
    // send a welcome message to the user
    await client.chat.postMessage({
        channel: userID,
        text: "Welcome to Bag! I'm the old man who toddles",
    });
}