import type { SlackAPIClient } from "slack-edge";
import { onboardingStep } from "./welcome";

export class Job {
    private timer: Timer | null = null;
    public date: Date | null = null;
    public userID: string | null = null;
    private readonly duration: number;
    public state: "running" | "stopped" | "waiting" = "stopped";

    constructor(duration: number, userID: string, slackClient: SlackAPIClient) {
        this.duration = duration;
        this.userID = userID;
        this.date = new Date(Date.now() + duration);
        this.start(slackClient);
    }

    start(slackClient: SlackAPIClient): void {
        if (this.timer === null) {
            this.state = "waiting";
            this.timer = setTimeout(async () => {
                this.state = "running";
                await onboardingStep(this.userID!, slackClient);
                this.timer = null;
                this.state = "stopped";
            }, this.duration);
        } else {
            throw new Error("Job is already running");
        }
    }

    stop(): void {
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
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

    addJob(duration: number): void {
        const job = new Job(duration, "1", this.slackClient!);

        this.jobs.push(job);
    }

    listJobs(): Job[] {
        return this.jobs;
    }

    async stopAllJobs(): Promise<void> {
        for (const job of this.jobs) {
            job.stop();
        }

        this.jobs = [];
    }

    stopJob(index: number): void {
        if (index >= 0 && index < this.jobs.length) {
            this.jobs[index].stop();
            this.jobs.splice(index, 1);
        } else {
            throw new Error("Invalid job index");
        }
    }

    // save all jobs to a file
    async saveJobsToFile(filepath: string): Promise<void> {
        // save jobs to a file as an array of objects
        const jobsData: JobData[] = this.jobs.filter((job) => job.date !== null).map((job) => {
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
            const job = new Job((new Date(jobData.date)).getTime() - Date.now(), jobData.userID, this.slackClient!);
            return job;
        });
    }
}