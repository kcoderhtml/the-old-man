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
    if (process.env.NODE_ENV === undefined) {
        clear(userID, client);
        // clear the metadata
        await updateUserMetadata(userID, JSON.stringify({ onboarding: null, onboardingStep: null }));
    }
    // get the user's net worth
    const netWorth = await getUserNetWorth(userID);

    // pull the onboarding file
    const onboarding = await Bun.file("bag/onboarding-workflow.json").json();

    // get the user's metadata
    const metadata = await getUserMetadata(userID);

    // check if the user has started the onboarding process
    if (metadata.onboarding === "completed" || metadata.onboarding === "started") {
        // if they have, log an error noting that they've already completed the onboarding process
        console.log(`❌ User ${userID} has already completed / started the onboarding process 🎉`);
        return "User has already completed / started the onboarding process 🎉";
    } else {
        // if they haven't, send the first message
        await client.chat.postMessage({
            channel: userID,
            text: onboarding.introduction.text,
        });

        // update the user's metadata to reflect that they've started the onboarding process
        await updateUserMetadata(userID, JSON.stringify({ onboarding: "started", onboardingStep: "introduction" }));
        onboardingStep(userID, client);
    }
}

export async function onboardingStep(userID: string, client: WebClient, nextStep?: string) {
    const onboarding = await Bun.file("bag/onboarding-workflow.json").json();
    const metadata = await getUserMetadata(userID);
    let step: string
    if (nextStep) {
        step = nextStep
    } else {
        // get the user's metadata
        step = onboarding[metadata.onboardingStep].next;
    }

    if (step === "completed") {
        // if the user has completed the onboarding process, log an error
        console.log(`❌ User ${userID} has already completed the onboarding process`);
        client.chat.postMessage({
            channel: userID,
            text: "Ummm... Welcome back? You've already completed the onboarding process though soo... :shrug-magic_wand: ",
        });
        return
    }

    if (onboarding[metadata.onboardingStep].check !== undefined && onboarding[metadata.onboardingStep].check.length > 0) {
        const userNetWorth = await getUserNetWorth(userID);
        const items = await $`node bag/get-user-items.js ${userID}`.json();
        for (const checkItem of onboarding[metadata.onboardingStep].check) {
            if (checkItem.netWorth !== undefined) {
                if (checkItem.opperator === "less") {
                    if (userNetWorth < checkItem.netWorth) {
                        await updateUserMetadata(userID, JSON.stringify({ onboarding: "started", onboardingStep: checkItem.next }));
                        onboardingStep(userID, client, checkItem.next);
                        return
                    }
                }
                if (checkItem.opperator === "greater") {
                    if (userNetWorth > checkItem.netWorth) {
                        await updateUserMetadata(userID, JSON.stringify({ onboarding: "started", onboardingStep: checkItem.next }));
                        onboardingStep(userID, client, checkItem.next);
                        return
                    }
                }
            } else if (checkItem.resource !== undefined) {
                if (items.find((item: any) => item.name.toLowerCase() === checkItem.resource) !== undefined) {
                    // if the user has required amount of the resource, move to the next step
                    if (items.find((item: any) => item.name.toLowerCase() === checkItem.resource).quantity < checkItem.quantity) {
                        client.chat.postMessage({
                            channel: userID,
                            text: checkItem.failMessage,
                        });
                        return
                    }
                }
            }
        }
    }

    if (onboarding[step].give !== undefined && onboarding[step].give.length > 0) {
        for (const item of onboarding[step].give) {
            await $`node bag/give-item.js ${userID} ${item.name} ${item.quantity}`;
        }
    }

    // if they haven't, send the next message
    await client.chat.postMessage({
        channel: userID,
        text: onboarding[step].text,
    });

    // update the user's metadata to reflect the next step
    await updateUserMetadata(userID, JSON.stringify({ onboarding: "started", onboardingStep: step }));


    await new Promise((resolve) => setTimeout(resolve, 1000));
    onboardingStep(userID, client, onboarding[step].next);
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

export async function updateItemIdData() {
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

async function getUserMetadata(userID: string) {
    // get the user's metadata
    // run bagtest.js with node to see the output
    return (await $`node bag/get-identity-metadata.js ${userID}`).json();
}

async function updateUserMetadata(userID: string, metadata: string) {
    // update the user's metadata
    // run bagtest.js with node to see the output
    return (await $`node bag/update-identity-metadata.js ${userID} ${metadata}`).json();
}