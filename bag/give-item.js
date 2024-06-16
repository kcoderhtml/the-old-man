import { App as Bag } from "@hackclub/bag";

const identityId = process.argv[2];
const itemId = process.argv[3].replaceAll("'", "");
const itemQuantity = Number(process.argv[4]);

const bagApp = await Bag.connect({
	appId: parseInt(process.env.BAG_APP_ID),
	key: process.env.BAG_APP_TOKEN,
});

const result = await bagApp.createInstance({
	identityId: identityId,
	itemId: itemId,
	quantity: itemQuantity,
});
