const ERC20Manager = artifacts.require("./ERC20Manager.sol");
const tokens = require("./etherscan-tokens-20102017.json");
const Q = require("q");
const bs58 = require("bs58");
const Buffer = require("buffer").Buffer;

module.exports = function(deployer,network) {
  if(network === 'main') {
    deployer
      .then(() => ERC20Manager.deployed())
      .then(_erc20Manager => saveTokens(_erc20Manager, tokens))
      .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] Setup etherscan tokens (20.10.2017): #done"))
  } else {
      console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] Setup etherscan tokens (20.10.2017): #skiped for ", network)
  }
}

let saveTokens = (erc20Manager, tokens) => {
  var _tokens = tokens.slice(0);

  var chain = Q.when();
  for(token of tokens) {
    chain = chain.then(function() {
      var _token = _tokens.shift();
      return erc20Manager.isTokenExists.call(_token.address)
      .then(_isExists => {
          if (_isExists) {
              return erc20Manager.setToken(_token.address, _token.address, _token.name.valueOf(), _token.symbol, _token.web, _token.decimals, ipfsHashToBytes32(_token.ipfsHash), 0x0)
          } else {
              return erc20Manager.addToken(_token.address, _token.name, _token.symbol, _token.web, _token.decimals, ipfsHashToBytes32(_token.ipfsHash), 0x0)
          }
      })
      .then(() => erc20Manager.getTokenBySymbol.call(_token.symbol))
      .then(tokenInfo => {
          if (isEqual(tokenInfo[0], _token.address)) {
              console.log("Token info: ", tokenInfo[0], "/", web3.toAscii(tokenInfo[1]), "/", web3.toAscii(tokenInfo[2]), "/", tokenInfo[4].toNumber(), "/", web3.toAscii(tokenInfo[3]));
          } else {
              console.log("Unable to update/register: ", _token.symbol);
          }
          return "";
      })
  })
  }

  return Q.all(chain);
}

let ipfsHashToBytes32 = (value) => {
  return `0x${Buffer.from(bs58.decode(value)).toString('hex').substr(4)}`
}

let isEqual = (address1, address2) => {
    return web3.toBigNumber(address1).cmp(web3.toBigNumber(address2)) == 0;
}
