const Roles2Library = artifacts.require("Roles2Library")
const TimeHolder = artifacts.require("TimeHolder")
const path = require("path")

module.exports = (deployer, network, accounts) => {
	const systemUser = accounts[0]
	const rootUser = systemUser
	const middlewareAddresses = [ systemUser, ] // TODO: add more middleware addresses
	const roles = {
		middlewareAuthority: 9,
	}

	deployer.then(async () => {
		const rolesLibrary = await Roles2Library.deployed()
		await rolesLibrary.setRootUser(rootUser, true, { from: systemUser, })
		
		for (var middlewareAddress of middlewareAddresses) {
			await rolesLibrary.addUserRole(middlewareAddress, roles.middlewareAuthority, { from: rootUser, })
		}
	
		// Setup role capabilities
	
		const timeHolder = await TimeHolder.deployed()
		{
			const signature = timeHolder.contract.registerUnlockShares.getData("", 0x0, 0, 0x0, "").slice(0, 10)
			await rolesLibrary.addRoleCapability(roles.middlewareAuthority, timeHolder.address, signature, { from: rootUser, })
		}
		{
			const signature = timeHolder.contract.unregisterUnlockShares.getData("").slice(0, 10)
			await rolesLibrary.addRoleCapability(roles.middlewareAuthority, timeHolder.address, signature, { from: rootUser, })
		}

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Role Capabilities setup: #done`)
	})
}