import { App as Bag } from "@hackclub/bag";

const identityId = process.argv[2];
const metadata = process.argv[3];

if (!identityId) {
	console.error("Please provide the user's identity id as an argument");
	process.exit(1);
}

if (!metadata) {
	console.error("Please provide the metadata as an argument");
	process.exit(1);
}

const bagApp = await Bag.connect({
	appId: parseInt(process.env.BAG_APP_ID),
	key: process.env.BAG_APP_TOKEN,
});

// get the original metadata
const identity = await bagApp.getIdentity(
	JSON.stringify({
		identityId: identityId,
	})
);

// update the metadata
const newMetadata = {
	...identity.metadata,
	...JSON.parse(metadata),
};

const result = await bagApp.updateIdentityMetadata({
	identityId: identityId,
	metadata: JSON.stringify(newMetadata),
});

console.log(JSON.stringify(result.metadata));
