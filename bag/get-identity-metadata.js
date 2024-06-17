import { App as Bag } from "@hackclub/bag";

(async () => {
	const identityId = process.argv[2];

	const bagApp = await Bag.connect({
		appId: parseInt(process.env.BAG_APP_ID),
		key: process.env.BAG_APP_TOKEN,
	});

	const identity = await bagApp.updateIdentityMetadata({
		identityId: identityId,
		metadata: JSON.stringify({}),
	});

	console.log(JSON.stringify(identity.metadata));
})();

process.on("SIGINT", () => {});
