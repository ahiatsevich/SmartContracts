const FakeCoin = artifacts.require("./FakeCoin.sol")
const FakeCoin2 = artifacts.require("./FakeCoin2.sol")
const ChronoBankPlatformTestable = artifacts.require("./ChronoBankPlatformTestable.sol");
const ChronoBankAssetProxy = artifacts.require('./ChronoBankAssetProxy.sol')
const ChronoBankAssetWithFee = artifacts.require("./ChronoBankAssetWithFee.sol");
const ChronoBankAsset = artifacts.require("./ChronoBankAsset.sol");
const Stub = artifacts.require("./Stub.sol");
const Setup = require('../setup/setup')
const Reverter = require('./helpers/reverter')
const bytes32 = require('./helpers/bytes32')
const bytes32fromBase58 = require('./helpers/bytes32fromBase58')
const eventsHelper = require('./helpers/eventsHelper')
const utils = require('./helpers/utils')
const ErrorsEnum = require("../common/errors")

contract('ERC20 Manager', function(accounts) {
    const owner = accounts[0]
    const owner1 = accounts[1]
    const owner2 = accounts[2]
    const owner3 = accounts[3]
    const owner4 = accounts[4]
    const owner5 = accounts[5]
    const nonOwner = accounts[6]

    const TOKEN_SYMBOL = 'TOKEN'
    const TOKEN_DESCRIPTION = ''
    const TOKEN_URL = ''
    const TOKEN_DECIMALS = 2
    const TOKEN_IPFS_HASH = bytes32('0x0')
    const TOKEN_SWARM_HASH = bytes32('0x0')

    const TOKEN_2_SYMBOL = 'TOKEN2'
    const TOKEN_2_DESCRIPTION = ''
    const TOKEN_2_URL = ''
    const TOKEN_2_DECIMALS = 2
    const TOKEN_2_IPFS_HASH = bytes32('0x0')
    const TOKEN_2_SWARM_HASH = bytes32('0x0')

    const TOKEN_3_SYMBOL = 'TOKEN3'
    const TOKEN_3_DESCRIPTION = ''
    const TOKEN_3_URL = ''
    const TOKEN_3_DECIMALS = 2
    const TOKEN_3_IPFS_HASH = bytes32('0x0')
    const TOKEN_3_SWARM_HASH = bytes32('0x0')

    var reverter = new Reverter(web3);
    let coin
    let coin2
    let stub
    let chronoBankPlatform
    let chronoBankAsset
    let chronoBankAssetProxy
    let chronoBankAssetWithFee
    let chronoBankAssetWithFeeProxy

    let initialNumberOfTokens = 2

    before('setup', function(done) {
        Promise.resolve()
        .then(() => FakeCoin.deployed()).then(instance => coin = instance)
        .then(() => FakeCoin2.deployed()).then(instance => coin2 = instance)
        .then(() => Stub.new()).then(instance => stub = instance)
        .then(() => ChronoBankPlatformTestable.new()).then(instance => chronoBankPlatform = instance)
        .then(() => chronoBankPlatform.setupEventsHistory(stub.address))

        .then(() => ChronoBankAsset.new()).then(instance => chronoBankAsset = instance)
        .then(() => ChronoBankAssetProxy.new()).then(instance => chronoBankAssetProxy = instance)
        .then(() => chronoBankAssetProxy.init(chronoBankPlatform.address, TOKEN_SYMBOL, TOKEN_SYMBOL))
        .then(() => chronoBankAssetProxy.proposeUpgrade(chronoBankAsset.address))
        .then(() => chronoBankAsset.init(chronoBankAssetProxy.address))

        .then(() => ChronoBankAssetWithFee.new()).then(instance => chronoBankAssetWithFee = instance)
        .then(() => ChronoBankAssetProxy.new()).then(instance => chronoBankAssetWithFeeProxy = instance)
        .then(() => chronoBankAssetWithFeeProxy.init(chronoBankPlatform.address, TOKEN_2_SYMBOL, TOKEN_2_SYMBOL))
        .then(() => chronoBankAssetWithFeeProxy.proposeUpgrade(chronoBankAssetWithFee.address))
        .then(() => chronoBankAssetWithFee.init(chronoBankAssetWithFeeProxy.address))

        .then(() => {
            return new Promise(function(resolve, reject) {
                Setup.setup(error => {
                    if (error) {
                        reject(error)
                    } else {
                        resolve()
                    }
                })
            })
        })
        .then(() => reverter.snapshot(done)).catch(done);
    })

    context("initial tests", function() {

        // TODO: @ahiatsevich: investigate why this does not work in testnets (lovan/rinkeby)
        // it("doesn't allow to add non ERC20 compatible token", function() {
        //   return Setup.erc20Manager.addToken.call(Setup.chronoBankAsset.address,'TOKEN','TOKEN','',2,bytes32('0x0'),bytes32('0x0')).then(function(r) {
        //     console.log(r)
        //     assert.equal(r,ErrorsEnum.ERCMANAGER_INVALID_INVOCATION)
        //   })
        // })

        it("allows to add ERC20 compatible token", function() {
            return Setup.erc20Manager.addToken.call(chronoBankAssetProxy.address, TOKEN_SYMBOL, TOKEN_SYMBOL, TOKEN_URL, TOKEN_DECIMALS, TOKEN_IPFS_HASH, TOKEN_SWARM_HASH).then(_code => {
                return Setup.erc20Manager.addToken(chronoBankAssetProxy.address, TOKEN_SYMBOL, TOKEN_SYMBOL, TOKEN_URL, TOKEN_DECIMALS, TOKEN_IPFS_HASH, TOKEN_SWARM_HASH, {
                    from: owner,
                    gas: 3000000
                }).then(tx => {
                    return Setup.erc20Manager.getTokenAddressBySymbol.call(TOKEN_SYMBOL).then(_address => {
                        assert.equal(_code, ErrorsEnum.OK)
                        assert.equal(_address, chronoBankAssetProxy.address)
                    })
                })
            })
        })

        it("doesn't allow to add same ERC20 compatible token with another symbol", function() {
            return Setup.erc20Manager.addToken.call(chronoBankAssetProxy.address, TOKEN_2_SYMBOL, TOKEN_2_SYMBOL, TOKEN_2_URL, TOKEN_2_DECIMALS, TOKEN_2_IPFS_HASH, TOKEN_2_SWARM_HASH).then(_code => {
                return Setup.erc20Manager.addToken(chronoBankAssetProxy.address, TOKEN_2_SYMBOL, TOKEN_2_SYMBOL, TOKEN_2_URL, TOKEN_2_DECIMALS, TOKEN_2_IPFS_HASH, TOKEN_2_SWARM_HASH, {
                    from: owner,
                    gas: 3000000
                }).then(tx => {
                    return Setup.erc20Manager.getTokenAddressBySymbol.call(TOKEN_2_SYMBOL).then(_address => {
                        assert.equal(_code, ErrorsEnum.ERCMANAGER_TOKEN_ALREADY_EXISTS)
                        assert.notEqual(_address, chronoBankAssetProxy.address)
                    })
                })
            })
        })

        it("doesn't allow to add another ERC20 compatible token with same symbol", function() {
            return Setup.erc20Manager.addToken.call(chronoBankAssetWithFeeProxy.address, TOKEN_SYMBOL, TOKEN_SYMBOL, TOKEN_URL, TOKEN_DECIMALS, TOKEN_IPFS_HASH, TOKEN_SWARM_HASH).then(_code => {
                return Setup.erc20Manager.addToken(chronoBankAssetWithFeeProxy.address, TOKEN_SYMBOL, TOKEN_SYMBOL, TOKEN_URL, TOKEN_DECIMALS, TOKEN_IPFS_HASH, TOKEN_SWARM_HASH, {
                    from: owner,
                    gas: 3000000
                }).then(tx => {
                    return Setup.erc20Manager.getTokenAddressBySymbol.call(TOKEN_2_SYMBOL).then(_address => {
                        assert.equal(_code, ErrorsEnum.ERCMANAGER_TOKEN_SYMBOL_ALREADY_EXISTS)
                        assert.notEqual(_address, chronoBankAssetWithFeeProxy.address)
                    });
                });
            });
        });

        // it("doesn't  allow to add another ERC20 compatible token with new symbol by untrusted account", async () => {
        //     let result = await Setup.erc20Manager.addToken.call(chronoBankAssetWithFeeProxy.address, TOKEN_2_SYMBOL, TOKEN_2_SYMBOL, TOKEN_2_URL, TOKEN_2_DECIMALS, TOKEN_2_IPFS_HASH, TOKEN_2_SWARM_HASH, {from: owner5});
        //     assert.equal(result, ErrorsEnum.UNAUTHORIZED);
        //
        //     let tx = await Setup.erc20Manager.addToken(chronoBankAssetWithFeeProxy.address, TOKEN_2_SYMBOL, TOKEN_2_SYMBOL, TOKEN_2_URL, TOKEN_2_DECIMALS, TOKEN_2_IPFS_HASH, TOKEN_2_SWARM_HASH, {from: owner5});
        //
        //     let address = await Setup.erc20Manager.getTokenAddressBySymbol(TOKEN_2_SYMBOL);
        //     assert.equal(address, utils.zeroAddress);
        // });

        it("allow to add another ERC20 compatible token with new symbol", function() {
            return Setup.erc20Manager.addToken.call(chronoBankAssetWithFeeProxy.address, TOKEN_2_SYMBOL, TOKEN_2_SYMBOL, TOKEN_2_URL, TOKEN_2_DECIMALS, TOKEN_2_IPFS_HASH, TOKEN_2_SWARM_HASH).then(_code => {
                return Setup.erc20Manager.addToken(chronoBankAssetWithFeeProxy.address, TOKEN_2_SYMBOL, TOKEN_2_SYMBOL, TOKEN_2_URL, TOKEN_2_DECIMALS, TOKEN_2_IPFS_HASH, TOKEN_2_SWARM_HASH, {
                    from: owner,
                    gas: 3000000
                }).then(tx => {
                    return Setup.erc20Manager.getTokenAddressBySymbol.call(TOKEN_2_SYMBOL).then(_address => {
                        assert.equal(_code, ErrorsEnum.OK)
                        assert.equal(_address, chronoBankAssetWithFeeProxy.address)
                    });
                });
            });
        });

        it("can show all ERC20 contracts", function() {
            return Setup.erc20Manager.getTokenAddresses.call().then(_tokenAddresses => {
                assert.lengthOf(_tokenAddresses, initialNumberOfTokens + 2);
            });
        });

        it("doesn't allow to change registered ERC20 compatible token address to another address with same symbol by non owner", function() {
            let otherOwner = owner5
            return Setup.erc20Manager.setToken.call(chronoBankAssetWithFeeProxy.address, coin.address, TOKEN_2_SYMBOL, TOKEN_2_SYMBOL, TOKEN_2_URL, TOKEN_2_DECIMALS, TOKEN_2_IPFS_HASH, TOKEN_2_SWARM_HASH, { from: otherOwner }).then(_code => {
                return Setup.erc20Manager.setToken(chronoBankAssetWithFeeProxy.address, coin.address, TOKEN_2_SYMBOL, TOKEN_2_SYMBOL, TOKEN_2_URL, TOKEN_2_DECIMALS, TOKEN_2_IPFS_HASH, TOKEN_2_SWARM_HASH, {
                    from: otherOwner,
                    gas: 3000000
                }).then(tx => {
                    return Setup.erc20Manager.getTokenAddressBySymbol.call(TOKEN_2_SYMBOL).then(_address => {
                        assert.equal(_code, ErrorsEnum.UNAUTHORIZED);
                        assert.notEqual(_address, coin.address);
                    });
                });
            });
        });

        it("allow to change registered ERC20 compatible token address to another address with same symbol by owner", function() {
            let realOwner = owner
            return Setup.erc20Manager.setToken.call(chronoBankAssetWithFeeProxy.address, coin.address, TOKEN_2_SYMBOL, TOKEN_2_SYMBOL, TOKEN_2_URL, TOKEN_2_DECIMALS, TOKEN_2_IPFS_HASH, TOKEN_2_SWARM_HASH, { from: realOwner }).then(_code => {
                return Setup.erc20Manager.setToken(chronoBankAssetWithFeeProxy.address, coin.address, TOKEN_2_SYMBOL, TOKEN_2_SYMBOL, TOKEN_2_URL, TOKEN_2_DECIMALS, TOKEN_2_IPFS_HASH, TOKEN_2_SWARM_HASH, {
                    from: realOwner,
                    gas: 3000000
                }).then(tx => {
                    return Setup.erc20Manager.getTokenAddressBySymbol.call(TOKEN_2_SYMBOL).then(_address => {
                        assert.equal(_code, ErrorsEnum.OK);
                        assert.equal(_address, coin.address);
                    });
                });
            });
        });

        it("doesn't allow to change registered ERC20 compatible token symbol to another symbol by non owner", function() {
            let notRealOwner = owner1
            return Setup.erc20Manager.setToken.call(coin.address, coin.address, TOKEN_3_SYMBOL, TOKEN_3_SYMBOL, TOKEN_3_URL, TOKEN_3_DECIMALS, TOKEN_3_IPFS_HASH, TOKEN_3_SWARM_HASH, { from: notRealOwner }).then(_code => {
                return Setup.erc20Manager.setToken(coin.address, coin.address, TOKEN_3_SYMBOL, TOKEN_3_SYMBOL, TOKEN_3_URL, TOKEN_3_DECIMALS, TOKEN_3_IPFS_HASH, TOKEN_3_SWARM_HASH, {
                    from: notRealOwner,
                    gas: 3000000
                }).then(tx => {
                    return Setup.erc20Manager.getTokenAddressBySymbol.call(TOKEN_3_SYMBOL).then(_address => {
                        assert.equal(_code, ErrorsEnum.UNAUTHORIZED);
                        assert.notEqual(_address, coin.address);
                    });
                });
            });
        });

        it("allow to change registered ERC20 compatible token symbol to another symbol by owner", function() {
            let realOwner = owner
            return Setup.erc20Manager.setToken.call(coin.address, coin.address, TOKEN_3_SYMBOL, TOKEN_3_SYMBOL, TOKEN_3_URL, TOKEN_3_DECIMALS, TOKEN_3_IPFS_HASH, TOKEN_3_SWARM_HASH, { from: realOwner }).then(_code => {
                return Setup.erc20Manager.setToken(coin.address, coin.address, TOKEN_3_SYMBOL, TOKEN_3_SYMBOL, TOKEN_3_URL, TOKEN_3_DECIMALS, TOKEN_3_IPFS_HASH, TOKEN_3_SWARM_HASH, {
                    from: realOwner,
                    gas: 3000000
                }).then(tx => {
                    return Setup.erc20Manager.getTokenAddressBySymbol.call(TOKEN_3_SYMBOL).then(_address => {
                        assert.equal(_code, ErrorsEnum.OK);
                        assert.equal(_address, coin.address);
                    });
                });
            });
        });

        it("doesn't allow to change registered ERC20 compatible token andress & symbol to another address & symbol by non owner", function() {
            let notRealOwner = owner1
            return Setup.erc20Manager.setToken.call(coin.address, chronoBankAssetWithFeeProxy.address, TOKEN_SYMBOL, TOKEN_SYMBOL, TOKEN_URL, TOKEN_DECIMALS, TOKEN_IPFS_HASH, TOKEN_SWARM_HASH, { from: notRealOwner }).then(_code => {
                return Setup.erc20Manager.setToken(coin.address, chronoBankAssetWithFeeProxy.address, TOKEN_SYMBOL, TOKEN_SYMBOL, TOKEN_URL, TOKEN_DECIMALS, TOKEN_IPFS_HASH, TOKEN_SWARM_HASH, {
                    from: notRealOwner,
                    gas: 3000000
                }).then(tx => {
                    return Setup.erc20Manager.getTokenAddressBySymbol.call(TOKEN_SYMBOL).then(_address => {
                        assert.equal(_code, ErrorsEnum.UNAUTHORIZED);
                        assert.notEqual(_address, chronoBankAssetWithFeeProxy.address);
                    });
                });
            });
        });

        it("doesn't allow to change registered ERC20 compatible token andress & symbol to another address & registered symbol by owner", function() {
            let realOwner = owner
            return Setup.erc20Manager.setToken.call(coin.address, chronoBankAssetWithFeeProxy.address, TOKEN_SYMBOL, TOKEN_SYMBOL, TOKEN_URL, TOKEN_DECIMALS, TOKEN_IPFS_HASH, TOKEN_SWARM_HASH,{ from: realOwner }).then(_code => {
                return Setup.erc20Manager.setToken(coin.address, chronoBankAssetWithFeeProxy.address, TOKEN_SYMBOL, TOKEN_SYMBOL, TOKEN_URL, TOKEN_DECIMALS, TOKEN_IPFS_HASH, TOKEN_SWARM_HASH, {
                    from: realOwner,
                    gas: 3000000
                }).then(tx => {
                    return Setup.erc20Manager.getTokenAddressBySymbol.call(TOKEN_SYMBOL).then(_address => {
                        assert.equal(_code, ErrorsEnum.ERCMANAGER_TOKEN_UNCHANGED);
                        assert.notEqual(_address, chronoBankAssetWithFeeProxy.address);
                    });
                });
            });
        });

        it("allow to change registered ERC20 compatible token andress & symbol to another address & symbol by owner", function() {
            let realOwner = owner
            return Setup.erc20Manager.setToken.call(coin.address, chronoBankAssetWithFeeProxy.address, TOKEN_2_SYMBOL, TOKEN_2_SYMBOL, TOKEN_2_URL, TOKEN_2_DECIMALS, TOKEN_2_IPFS_HASH, TOKEN_2_SWARM_HASH, { from: realOwner}).then(_code => {
                return Setup.erc20Manager.setToken(coin.address, chronoBankAssetWithFeeProxy.address, TOKEN_2_SYMBOL, TOKEN_2_SYMBOL, TOKEN_2_URL, TOKEN_2_DECIMALS, TOKEN_2_IPFS_HASH, TOKEN_2_SWARM_HASH, {
                    from: realOwner,
                    gas: 3000000
                }).then(tx => {
                    return Setup.erc20Manager.getTokenAddressBySymbol.call(TOKEN_2_SYMBOL).then(_address => {
                        assert.equal(_code, ErrorsEnum.OK);
                        assert.equal(_address, chronoBankAssetWithFeeProxy.address);
                    });
                });
            });
        });

        it("doesn't allow to remove registered ERC20 compatible token by addrees by non owner", function() {
            let notRealOwner = owner1
            return Setup.erc20Manager.removeTokenByAddress.call(chronoBankAssetWithFeeProxy.address,{ from: notRealOwner }).then(_code => {
                return Setup.erc20Manager.removeTokenByAddress(chronoBankAssetWithFeeProxy.address, {
                    from: notRealOwner,
                    gas: 3000000
                }).then(tx => {
                    return Setup.erc20Manager.getTokenAddressBySymbol.call(TOKEN_2_SYMBOL).then(_address => {
                        assert.equal(_code, ErrorsEnum.UNAUTHORIZED);
                        assert.equal(_address, chronoBankAssetWithFeeProxy.address);
                    });
                });
            });
        });

        it("allow to remove registered ERC20 compatible token by addrees by owner", function() {
            let realOwner = owner
            return Setup.erc20Manager.removeTokenByAddress.call(chronoBankAssetWithFeeProxy.address,{ from: realOwner }).then(_code => {
                return Setup.erc20Manager.removeTokenByAddress(chronoBankAssetWithFeeProxy.address, {
                    from: realOwner,
                    gas: 3000000
                }).then(tx => {
                    return Setup.erc20Manager.getTokenAddressBySymbol.call(TOKEN_2_SYMBOL).then(_address => {
                        assert.equal(_code, ErrorsEnum.OK);
                        assert.notEqual(_address, chronoBankAssetWithFeeProxy.address);
                    });
                });
            });
        });

        it("doesn't allow to remove registered ERC20 compatible token by symbol by non owner", function() {
            let notRealOwner = owner1
            return Setup.erc20Manager.removeTokenBySymbol.call(TOKEN_SYMBOL, { from: notRealOwner }).then(_code => {
                return Setup.erc20Manager.removeTokenBySymbol(TOKEN_SYMBOL, {
                    from: notRealOwner,
                    gas: 3000000
                }).then(tx => {
                    return Setup.erc20Manager.getTokenAddressBySymbol.call(TOKEN_SYMBOL).then(_address => {
                        assert.equal(_code, ErrorsEnum.UNAUTHORIZED);
                        assert.equal(_address, chronoBankAssetProxy.address);
                    });
                });
            });
        });

        it("allow to remove registered ERC20 compatible token by symbol by owner", function() {
            let realOwner = owner
            return Setup.erc20Manager.removeTokenBySymbol.call(TOKEN_SYMBOL,{ from: realOwner }).then(_code => {
                return Setup.erc20Manager.removeTokenBySymbol(TOKEN_SYMBOL, {
                    from: realOwner,
                    gas: 3000000
                }).then(tx => {
                    return Setup.erc20Manager.getTokenAddressBySymbol.call(TOKEN_SYMBOL).then(_address => {
                        assert.equal(_code, ErrorsEnum.OK);
                        assert.notEqual(_address, chronoBankAssetProxy.address);
                    });
                });
            });
        });

        it("shows empty ERC20 contracts list", function() {
            return Setup.erc20Manager.getTokenAddresses.call().then(_addresses => {
                assert.lengthOf(_addresses, initialNumberOfTokens);
            });
        });

        it("able to check token existence via public method `isTokenExists`", function() {
            return Setup.erc20Manager.isTokenExists.call(Setup.erc20Manager.address).then(_isExist => {
                assert.isNotOk(_isExist);
            });
        });
    });
});
