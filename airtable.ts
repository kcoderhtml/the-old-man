import type { SlackAPIClient } from "slack-edge";
import type { Scheduler } from "./scheduler";
import Airtable from "airtable";
import type { AirtableBase } from "airtable/lib/airtable_base";
import { welcome } from "./welcome";


export async function getAirtableBase(): Promise<AirtableBase> {
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        throw new Error("Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID env vars");
    }
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
    return base;
}

export async function checkAirtableAndWelcomeIfNeeded(client: SlackAPIClient, scheduler: Scheduler, base: AirtableBase) {
    const records = await getNewUsersFromAirtable(base);
    for (const record of records) {
        scheduler.addJob(async () => {
            const slackID = record.fields["Slack ID"];
            //await welcome(slackID, client, scheduler)
            console.log(`Welcoming ${slackID}`)
            // set the Bag Onboarding Triggered field to true
            //await base('Users').update(record.id, {
            //    "Bag Onboarding Triggered": true
            //});
        }, 100);
    }
}

async function getNewUsersFromAirtable(base: AirtableBase): Promise<any> {
    return new Promise((resolve, reject) => {
        base('Users').select({
            filterByFormula: '{finalDm AND NOT({Bag Onboarding Triggered})',
            view: "Grid view"
        }).all((err: any, records: any) => {
            if (err) {
                console.error(err);
                reject(err);
            }
            resolve(records);
        });
    });
}