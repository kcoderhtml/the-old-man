import { App as Bag } from "@hackclub/bag";

const identityId = process.argv[2];

const bagApp = await Bag.connect({
	appId: parseInt(process.env.BAG_APP_ID),
	key: process.env.BAG_APP_TOKEN,
});

const identity = await bagApp.getIdentity(
	JSON.stringify({
		identityId: identityId,
	})
);

console.log(JSON.stringify(identity.metadata, null, 2));
