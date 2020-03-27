const BAMARAMA_BOX = 80086,
	ROOT_BEER = 80081,
	TRASH = {
		"beer":			80078,
		"wine":			80079,
		"moongourd":	80082,
		"afro":			80089,
		"chefHat":		80090
	},
	HATS = [TRASH.afro, TRASH.chefHat],
	ITEMS = [ROOT_BEER, ...Object.values(TRASH)];

module.exports = function RootBeer(mod) {

	mod.game.initialize('inventory');

	let hooks = [],
		enabled = false,
		timer = null,
		myLoc = null,
		statTotal = 0,
		statRootBeers = 0;

	mod.command.add('rootbeer', () => { (!enabled ? start : stop)() });

	hook('S_SPAWN_ME', 3, event => { myLoc = event; });
	hook('C_PLAYER_LOCATION', 5, event => { myLoc = event; });

	function start() {
		if (enabled) return;

		if(mod.game.inventory.findAll(BAMARAMA_BOX).length === 0) {
			mod.command.message('You do not have any Bamarama Boxes. Stopping...');
			return;
		}

		enabled = true;

		// Toggle hook in case we're still cleaning up from previous run
		mod.game.inventory.off('update', inventoryUpdate).on('update', inventoryUpdate);

		hook('S_SYSTEM_MESSAGE_LOOT_ITEM', 1, event => {
			if(ITEMS.includes(event.item)) {
				mod.clearTimeout(timer);

				statTotal++;
				if(event.item === ROOT_BEER) statRootBeers++;

				openBox();
			}
		});

		hook('C_RETURN_TO_LOBBY', 'raw', () => false); // Prevents you from being automatically logged out while AFK

		openBox();
		mod.command.message('Auto-Rootbeer started.');
	}

	function hook() { hooks.push(mod.hook(...arguments)); }

	function openBox() {
		mod.send('C_USE_ITEM', 3, {
			gameId: mod.game.me.gameId,
			id: BAMARAMA_BOX,
			amount: 1,
			loc: myLoc.loc,
			w: myLoc.w,
			unk4: true
		});
		timer = mod.setTimeout(openBox, 5000);
	}

	function inventoryUpdate() {
		if (mod.settings.autoTrash) {
			const strictTrash = mod.game.inventory.size - mod.game.inventory.items.length < 2 || !enabled;

			for (let [name, id] of Object.entries(TRASH)) {
				if (mod.settings.autoTrashItems[name]) {
					for (let item of mod.game.inventory.findAll(id)) {
						// Trashing large stacks of items is more bandwidth efficient
						if (item.amount >= 99 || HATS.includes(id) || strictTrash) {
							deleteItem(item);
						}
					}
				}
			}
		}

		mergeHats();

		if (!enabled) {
			mod.game.inventory.off('update', inventoryUpdate); // Unhook after we've cleaned up
		} else if (mod.game.inventory.findAll(BAMARAMA_BOX).length === 0) {
			stop();
		}
	}

	function stop() {
		if(!enabled) return;

		enabled = false;
		mod.clearTimeout(timer);
		timer = null;
		unload();

		mod.command.message('Auto-Rootbeer stopped.'
			+ (!statTotal ? '' : `Unboxed ${statRootBeers}/${statTotal} (${(Math.floor(statRootBeers / statTotal * 1000) / 10) || '0'}%).`));

		statTotal = statRootBeers = 0;
	}

	function unload() {
		if (hooks.length) {
			for (let h of hooks) {
				mod.unhook(h);
			}
			hooks = [];
		}
	}

	function mergeHats() {
		for (let hat of HATS.map(id => mod.game.inventory.findAll(id))) {
			while (hat.length >= 2) {
				mergeItem(hat.pop(), hat[0]);
			}
		}
	}

	function mergeItem(itemFrom, itemTo) {
		mod.send('C_MERGE_ITEM', 2, {
			pocketFrom: itemFrom.pocket,
			slotFrom: itemFrom.slot,
			pocketTo: itemTo.pocket,
			slotTo: itemTo.slot
		});
	}

	function deleteItem(item) {
		mod.send('C_DEL_ITEM', 3, {
			gameId: mod.game.me.gameId,
			pocket: item.pocket,
			slot: item.slot,
			amount: item.amount
		});
	}
}