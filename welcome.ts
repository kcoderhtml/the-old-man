import { $ } from "bun";
import type { SlackAPIClient } from "slack-edge";
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

export async function welcome(userID: string, client: SlackAPIClient) {
    if (process.env.NODE_ENV === undefined) {
        // await clear(userID, client);
        // clear the metadata
        await updateUserMetadata(userID, JSON.stringify({ onboarding: null, onboardingStep: null }));
    }

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
        // give items if randomGive
        if (onboarding.introduction.randomGive !== undefined && onboarding.introduction.randomGive.length > 0) {
            // pick 3 random items from the list that aren't the same
            const items: string[] = onboarding.introduction.randomGive;
            const randomItems = items.sort(() => 0.5 - Math.random()).slice(0, 3);

            await $`node bag/give-items.js ${userID} ${"'" + randomItems.join(",") + "'"} ${"'" + onboarding.introduction.text + "'"}`;
        }

        // update the user's metadata to reflect that they've started the onboarding process
        await updateUserMetadata(userID, JSON.stringify({ onboarding: "started", onboardingStep: "introduction" }));
        onboardingStep(userID, client);
    }
}

export async function onboardingStep(userID: string, client: SlackAPIClient, slackEvent?: boolean, nextStep?: string) {
    const onboarding = await Bun.file("bag/onboarding-workflow.json").json();
    const metadata = await getUserMetadata(userID);
    let step: string
    if (nextStep) {
        step = nextStep
    } else {
        // get the user's metadata
        step = onboarding[metadata.onboardingStep].next;
    }

    console.log("🚀 Step:", step);

    if (step === "completed") {
        // if the user has completed the onboarding process, log an error
        console.log(`❌ User ${userID} has already completed the onboarding process`);
        return
    }

    if (slackEvent && onboarding[metadata.onboardingStep].check === undefined) {
        // check if there is a pause
        if (onboarding[metadata.onboardingStep].pause === undefined) {
            return
        }
    }

    if (onboarding[step].give !== undefined && onboarding[step].give.length > 0) {
        let giveItems: string[] = [];
        for (const item of onboarding[step].give) {
            for (let i = 0; i < item.quantity; i++) {
                giveItems.push(item.name);
            }
        }

        await $`node bag/give-items.js ${userID} ${"'" + giveItems.join(",") + "'"} ${"'" + onboarding[step].text + "'"}`;
    }

    let text: string = onboarding[step].text;

    // check if randomReplace is defined
    if (onboarding[step].randomReplace !== undefined && onboarding[step].randomReplace.length > 0) {
        // pick a random item from the list
        const randomReplace = onboarding[step].randomReplace[Math.floor(Math.random() * onboarding[step].randomReplace.length)];
        // for item in randomReplace.text replace {{replace}} in text with its value
        for (const item of randomReplace.text) {
            text = text.replace("{{replace}}", item);
        }

        let giveItems: string[] = [];

        // give items in randomReplace.give
        for (const item of randomReplace.give) {
            for (let i = 0; i < item.quantity; i++) {
                giveItems.push(item.name);
            }
        }

        await $`node bag/give-items.js ${userID} ${"'" + giveItems.join(",") + "'"} ${"'" + text + "'"}`;
    }

    // update the user's metadata to reflect the next step
    if (onboarding[step].next === "completed") {
        // if the user has completed the onboarding process, log an error
        console.log(`✅ User ${userID} has completed the onboarding process`);
        await updateUserMetadata(userID, JSON.stringify({ onboarding: "completed", onboardingStep: "completed" }));
        return
    } else {
        await updateUserMetadata(userID, JSON.stringify({ onboarding: "started", onboardingStep: step }));
    }

    if (onboarding[step].pause !== undefined && onboarding[step].pause === true) {
        return
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    onboardingStep(userID, client, false, onboarding[step].next);
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
    const metadata = (await $`node bag/get-identity-metadata.js ${userID}`).json()
    return Object.keys(metadata).length !== 0 ? metadata : { onboarding: "null", onboardingStep: "null" }
}

async function updateUserMetadata(userID: string, metadata: string) {
    // update the user's metadata
    // run bagtest.js with node to see the output
    return (await $`node bag/update-identity-metadata.js ${userID} ${metadata}`).json();
}