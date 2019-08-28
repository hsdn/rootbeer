const BAMARAMA_BOX = 80086,
	ROOT_BEER = 80081,
	TRASH = {
		beer:		80078,
		wine:		80079,
		moongourd:	80082,
		afro:		80089,
		chefHat:	80090
	},
	HATS = [TRASH.afro, TRASH.chefHat],
	ITEMS = [ROOT_BEER, ...Object.values(TRASH)]

module.exports = function RootBeer(mod) {
	mod.settings.$init({
		version: 2,
		defaults: {
			autoTrash: true,
			autoTrashItems: {
				beer: true,
				wine: true,
				moongourd: true,
				afro: true,
				chefHat: true
			}
		}
	})

	const {command, game} = mod.require,
		{inventory} = game

	let hooks = [],
		enabled = false,
		timer = null,
		statTotal = 0,
		statRootBeers = 0

	command.add('rootbeer', () => { (!enabled ? start : stop)() })

	function start() {
		if(enabled) return

		if(!inventory.has(BAMARAMA_BOX)) {
			command.message('No bamarama boxes found.')
			return
		}

		enabled = true

		// Toggle hook in case we're still cleaning up from previous run
		inventory.off('update', inventoryUpdate).on('update', inventoryUpdate)

		hook('S_SYSTEM_MESSAGE_LOOT_ITEM', 1, event => {
			if(ITEMS.includes(event.item)) {
				mod.clearTimeout(timer)

				statTotal++
				if(event.item === ROOT_BEER) statRootBeers++

				openBox()
			}
		})

		hook('C_RETURN_TO_LOBBY', 'raw', () => false) // Prevents you from being automatically logged out while AFK

		openBox()
		command.message('Auto-Rootbeer started.')
	}

	function hook() { hooks.push(mod.hook(...arguments)) }

	function openBox() {
		inventory.use(BAMARAMA_BOX)
		timer = mod.setTimeout(openBox, 5000) // Fallback in case a box failed to open
	}

	function inventoryUpdate() {
		if(mod.settings.autoTrash) {
			const strictTrash = inventory.size - inventory.items.length < 2 || !enabled

			for(let [name, id] of Object.entries(TRASH))
				if(mod.settings.autoTrashItems[name])
					for(let item of inventory.findAll(id))
						// Trashing large stacks of items is more bandwidth efficient
						if(item.amount >= 99 || HATS.includes(id) || strictTrash)
							inventory.delete(item)
		}

		for(let hat of HATS.map(id => inventory.findAll(id)))
			while(hat.length >= 2) inventory.merge(hat.pop(), hat[0])

		if(!enabled) inventory.off('update', inventoryUpdate) // Unhook after we've cleaned up
		else if(!inventory.has(BAMARAMA_BOX)) stop()
	}

	function stop() {
		if(!enabled) return

		enabled = false
		mod.clearTimeout(timer)
		timer = null
		unload()

		command.message('Auto-Rootbeer stopped.'
			+ (!statTotal ? '' : ` Unboxed ${statRootBeers}/${statTotal} (${(Math.floor(statRootBeers / statTotal * 1000) / 10) || '0'}%).`))

		statTotal = statRootBeers = 0
	}

	function unload() {
		if(hooks.length) {
			for(let h of hooks) mod.unhook(h)

			hooks = []
		}
	}
}