import { WebClient } from "@slack/web-api";
import { $ } from "bun";
import { parse } from "yaml";

let bagData: {
    name: string;
    tag: string;
    artist: string;
    description: string;
    frequency: null | number;
    intended_value_atus: number;
    intended_value_gp: number;
    genstore_sell_to_player_price: number;
    genstore_buy_from_player_price: number;
    genstore_price_variance: number;
}[]

export async function welcome(userID: string, client: WebClient) {
    // get the user's net worth
    const netWorth = await getUserNetWorth(userID);

    // send a welcome message to the user
    await client.chat.postMessage({
        channel: userID,
        text: "Welcome to Bag! I'm the old man who toddles",
    });

    if (netWorth === 0) {
        await client.chat.postMessage({
            channel: userID,
            text: "You don't have anything in your bag yet. I'll help you learn more about bag!",
        });
    } else if (netWorth < 500) {
        await client.chat.postMessage({
            channel: userID,
            text: "You have a few things in your bag, but you're still pretty poor. I'll help you learn more about bag!",
        });
    } else {
        await client.chat.postMessage({
            channel: userID,
            text: "You have a lot of things in your bag! Your net worth is " + netWorth + " :-gp:",
        });

        await client.chat.postMessage({
            channel: userID,
            text: "You seem to really care about Bag so let me impart something my father and his father before him have handed down to me: 'The Bag Manifesto: A bag is a bag is a bag. But a bag is not a bag if it's not a bag. So bag a bag and bag it well.'",
        });
    }
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

async function getUserNetWorth(userID: string) {
    // get the user's net worth
    // run bagtest.js with node to see the output
    const result: {
        id: number;
        name: string;
        quantity: number;
        metadata: string | undefined;
    }[] = (await $`node bag/get-user-items.js ${userID}`).json();

    let netWorth = 0;
    for (const item of result) {
        netWorth += bagData.find((data) => data.name === item.name)?.intended_value_gp || 0;
    }

    return netWorth;
}

export async function updateNetWorth() {
    // check if the net worth file exists
    const file = Bun.file("data/items.yaml");

    console.log("💰 Checking for bag data file...", await file.exists() ? "exists" : "doesn't exist");

    // if it doesn't exist, create it
    if (!await file.exists()) {
        const response = await fetch("https://raw.githubusercontent.com/rivques/bag-manifest/production/items.yaml")

        if (response.ok) {
            const text = await response.text();
            Bun.write("data/items.yaml", text);
            console.log("💰 Bag data created successfully! 🎉");
        } else {
            console.error("💰 Failed to fetch bag data file", response.statusText);
        }
    } else {
        // if it exists check if it's up to date
        const response = await fetch("https://raw.githubusercontent.com/rivques/bag-manifest/production/items.yaml")
        const text = await response.text();
        const local = await Bun.file("data/items.yaml").text();

        if (!response.ok) {
            console.error("💰 Failed to fetch bag data file", response.statusText);
            return;
        }

        if (text !== local) {
            Bun.write("data/items.yaml", text);
            console.log("💰 Bag data updated successfully! 🎉");
        } else {
            console.log("💰 Bag data is up to date! 🎉");
        }
    }

    bagData = parse(await Bun.file("data/items.yaml").text());
}