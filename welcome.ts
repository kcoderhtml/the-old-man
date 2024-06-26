import { $ } from "bun";
import type { SlackAPIClient } from "slack-edge";
import type { Scheduler } from "./scheduler";

export async function welcome(userID: string, client: SlackAPIClient, scheduler: Scheduler) {
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

        if (onboarding.introduction.pause !== undefined && onboarding.introduction.pause === true && process.env.NODE_ENV !== undefined) {
            // check whether waitTime is defined
            if (onboarding.introduction.waitTime !== undefined) {
                // parse the waitTime from the format "1m1h1d" to milliseconds
                const waitTime = onboarding.introduction.waitTime === "" ? "1d" : onboarding.introduction.waitTime;
                let milliseconds: number = 0;
                // split at the letters to get the number and the unit
                const time = waitTime.match(/\d+\w/g);
                // check if time is not null
                if (time !== null) {
                    // iterate over the time array
                    for (const t of time) {
                        // get the number and the unit
                        const number = parseInt(t.match(/\d+/)![0]);
                        const unit = t.match(/\w+/)![0][1];

                        // add the milliseconds to the total
                        switch (unit) {
                            case "s":
                                milliseconds += number * 1000;
                                break;
                            case "m":
                                milliseconds += number * 60000;
                                break;
                            case "h":
                                milliseconds += number * 3600000;
                                break;
                            case "d":
                                milliseconds += number * 86400000;
                                break;
                            default:
                                // handle the case when the unit is not recognized
                                console.log(`❌ Invalid time unit: ${unit}`);
                                milliseconds = 86400000
                                break;
                        }
                    }
                } else {
                    console.log(`❌ Invalid time string: ${waitTime}`);
                    milliseconds = 86400000
                }

                scheduler.addJob(async () => {
                    await onboardingStep(userID, client, scheduler, true);
                }, milliseconds, userID);
            }
            return
        }

        scheduler.addJob(async () => {
            await onboardingStep(userID, client, scheduler);
        }, 10000, userID);
    }
}

export async function onboardingStep(userID: string, client: SlackAPIClient, scheduler: Scheduler, slackEvent?: boolean, nextStep?: string,) {
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
        if (randomReplace.give !== undefined && randomReplace.give.length > 0) {
            for (const item of randomReplace.give) {
                for (let i = 0; i < item.quantity; i++) {
                    giveItems.push(item.name);
                }
            }

            await $`node bag/give-items.js ${userID} ${"'" + giveItems.join(",") + "'"} ${"'" + text + "'"}`;
        }
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

    if (onboarding[step].pause !== undefined && onboarding[step].pause === true && process.env.NODE_ENV !== undefined) {
        // check whether waitTime is defined
        if (onboarding[step].waitTime !== undefined) {
            // parse the waitTime from the format "1m1h1d" to milliseconds
            const waitTime = onboarding[step].waitTime === "" ? "1d" : onboarding[step].waitTime;
            let milliseconds: number = 0;
            // split at the letters to get the number and the unit
            const time = waitTime.match(/\d+\w/g);
            // check if time is not null
            if (time !== null) {
                // iterate over the time array
                for (const t of time) {
                    // get the number and the unit
                    const number = parseInt(t.match(/\d+/)![0]);
                    const unit = t.match(/\w+/)![0][1];

                    // add the milliseconds to the total
                    switch (unit) {
                        case "s":
                            milliseconds += number * 1000;
                            break;
                        case "m":
                            milliseconds += number * 60000;
                            break;
                        case "h":
                            milliseconds += number * 3600000;
                            break;
                        case "d":
                            milliseconds += number * 86400000;
                            break;
                        default:
                            // handle the case when the unit is not recognized
                            console.log(`❌ Invalid time unit: ${unit}`);
                            milliseconds = 86400000
                            break;
                    }
                }
            } else {
                console.log(`❌ Invalid time string: ${waitTime}`);
                milliseconds = 86400000
            }

            scheduler.addJob(async () => {
                await onboardingStep(userID, client, scheduler, true);
            }, milliseconds, userID);
        }
        return
    }

    scheduler.addJob(async () => {
        await onboardingStep(userID, client, scheduler, false, onboarding[step].next);
    }, 4000, userID);
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