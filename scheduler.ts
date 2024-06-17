import type { SlackAPIClient } from "slack-edge";
import { onboardingStep } from "./welcome";

export class Job {
    private timer: Timer | null = null;
    public date: Date | null = null;
    public userID: string | null = null;
    private readonly duration: number;
    public state: "running" | "stopped" | "waiting" | "paused" = "stopped";
    public runningPromise: Promise<void> | null = null;

    constructor(callback: () => void, duration: number, userID?: string) {
        this.duration = duration;
        this.userID = userID || null;
        this.date = new Date(Date.now() + duration);
        this.start(callback);
    }

    start(callback: () => void): void {
        if (this.timer === null) {
            this.state = "waiting";
            this.timer = setTimeout(async () => {
                this.runningPromise = new Promise(async (resolve) => {
                    this.state = "running";
                    await callback();
                    this.timer = null;
                    this.state = "stopped";
                    resolve();
                });
            }, this.duration);
        } else {
            throw new Error("Job is already running");
        }
    }

    async stop(): Promise<void> {
        if (this.timer !== null) {
            console.log("Stopping job");
            // if the job is waiting to run, clear the timeout
            if (this.state === "waiting") {
                console.log("Job is waiting");
                clearTimeout(this.timer);
                this.timer = null;
            } else if (this.state === "running") {
                // if the job is running, wait for it to finish
                console.log("Job is running");
                await this.runningPromise;
            }
        } else {
            throw new Error("Job is not running");
        }
    }

    async pause(): Promise<void> {
        if (this.timer !== null) {
            // if the job is waiting to run, clear the timeout
            if (this.state === "waiting") {
                clearTimeout(this.timer);
                this.timer = null;
                this.state = "paused";
            } else if (this.state === "running") {
                // if the job is running, wait for it to finish
                throw new Error("Job is running");
            }
        } else {
            throw new Error("Job is not running");
        }
    }
}

type JobData = {
    date: Date;
    userID: string;
};

export class Scheduler {
    private jobs: Job[] = [];
    private slackClient: SlackAPIClient | null = null;

    constructor(slackClient: SlackAPIClient) {
        this.slackClient = slackClient;
    }

    addJob(callback: () => void, duration: number, slackID?: string): void {
        const job = new Job(callback, duration, slackID);

        this.jobs.push(job);
    }

    listJobs(): Job[] {
        return this.jobs;
    }

    async stopAllJobs(): Promise<void> {
        console.log("Stopping all jobs");
        const stopPromises: Promise<void>[] = [];
        let alreadyStopped: number = 0;

        for (const job of this.jobs) {
            if (job.state !== "stopped") {
                const stopPromise = job.pause();
                stopPromises.push(stopPromise);
            } else {
                // remove the job from the list if it's already stopped
                this.jobs.splice(alreadyStopped, 1);
                alreadyStopped++;
            }
        }

        await Promise.all(stopPromises);
    }

    // save all jobs to a file
    async saveJobsToFile(filepath: string): Promise<void> {
        console.log("Saving jobs to file");

        // save jobs to a file as an array of objects
        const jobsData: JobData[] = this.jobs.filter((job) => job.date && job.userID && job.state !== "stopped").map((job) => {
            return {
                date: job.date!,
                userID: job.userID!,
            };
        });

        await Bun.write(filepath, JSON.stringify(jobsData, null, 4));
    }

    // load jobs from a file
    async loadJobsFromFile(filepath: string): Promise<void> {
        // load jobs from a file
        const data: JobData[] = await Bun.file(filepath).json();

        this.jobs = data.map((jobData) => {
            const job = new Job(() => {
                onboardingStep(jobData.userID, this.slackClient!, this);
            }, (new Date(jobData.date)).getTime() - Date.now(), jobData.userID);
            return job;
        });
    }
}