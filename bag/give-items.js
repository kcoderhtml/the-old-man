import { App as Bag } from "@hackclub/bag";

const identityId = process.argv[2];
const itemIds = process.argv[3].replaceAll("'", "").split(",");
const message = process.argv[4].replaceAll("'", "");

// delete all empty strings
for (let i = 0; i < itemIds.length; i++) {
	if (itemIds[i] === "") {
		itemIds.splice(i, 1);
	}
}

const bagApp = await Bag.connect({
	appId: parseInt(process.env.BAG_APP_ID),
	key: process.env.BAG_APP_TOKEN,
});

const instances = [];
itemIds.forEach((itemId) => {
	const existingInstance = instances.find(
		(instance) => instance.itemId === itemId
	);
	if (existingInstance) {
		existingInstance.quantity += 1;
	} else {
		instances.push({
			itemId: itemId,
			quantity: 1,
		});
	}
});

console.log("instances: ", instances);

await bagApp.createInstances({
	identityId: identityId,
	instances: instances,
	show: true,
	note: message,
});
