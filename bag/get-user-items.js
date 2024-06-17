import { App as Bag } from "@hackclub/bag";
import fs from "fs";

(async () => {
	let cachedItemData = [];
	try {
		const data = fs.readFileSync("data/item-data.json");
		cachedItemData = JSON.parse(data);
	} catch (error) {
		console.error("Error reading item data file:", error);
	}

	// get the first argument as the user's identity id
	if (process.argv.length < 3) {
		console.error("Please provide the user's identity id as an argument");
		process.exit(1);
	}

	const identityId = process.argv[2];

	const bagApp = await Bag.connect({
		appId: parseInt(process.env.BAG_APP_ID),
		key: process.env.BAG_APP_TOKEN,
	});

	// get the user's net worth
	const inventory = await bagApp.getInventory({
		identityId: identityId,
	});

	for (const item of inventory) {
		// set the name of the item
		// check if the item is cached
		const cachedItem = cachedItemData.find(
			(cachedItem) => cachedItem.id === item.id
		);
		if (cachedItem) {
			item.name = cachedItem.name;
		} else {
			const itemData = await bagApp.getItem({
				query: JSON.stringify({ name: item.itemId }),
			});

			item.name = itemData.name;
			cachedItemData.push({
				id: item.id,
				name: itemData.name,
			});
		}
	}

	fs.writeFileSync("data/item-data.json", JSON.stringify(cachedItemData));

	const inventoryList = inventory.map((item) => {
		return {
			id: item.id,
			name: item.name,
			quantity: item.quantity,
			metadata: item.metadata,
		};
	});

	console.log(JSON.stringify(inventoryList));
})();

process.on("SIGINT", () => {});
