pragma solidity ^0.4.11;

import "../common/BaseManager.sol";
import "../event/MultiEventsHistory.sol";
import {ERC20Interface as Asset} from "./ERC20Interface.sol";
import "./ERC20ManagerEmitter.sol";


contract ERC20TokenVerifier {
    function verify(address token) public view returns (bool);
}

/// @title ERC20Manager
///
/// @notice ERC20Manager contract which keeps track of all ERC20-based tokens
/// registered in a system.
contract ERC20Manager is ERC20ManagerEmitter, BaseManager {

    uint constant ERROR_ERCMANAGER_INVALID_INVOCATION = 13000;
    uint constant ERROR_ERCMANAGER_TOKEN_SYMBOL_NOT_EXISTS = 13002;
    uint constant ERROR_ERCMANAGER_TOKEN_NOT_EXISTS = 13003;
    uint constant ERROR_ERCMANAGER_TOKEN_SYMBOL_ALREADY_EXISTS = 13004;
    uint constant ERROR_ERCMANAGER_TOKEN_ALREADY_EXISTS = 13005;
    uint constant ERROR_ERCMANAGER_TOKEN_UNCHANGED = 13006;

    StorageInterface.AddressesSet tokenAddresses;
    StorageInterface.Bytes32AddressMapping tokenBySymbol;
    StorageInterface.AddressBytes32Mapping name;
    StorageInterface.AddressBytes32Mapping symbol;
    StorageInterface.AddressBytes32Mapping url;
    StorageInterface.AddressBytes32Mapping ipfsHash;
    StorageInterface.AddressBytes32Mapping swarmHash;
    StorageInterface.AddressUIntMapping decimals;
    StorageInterface.Address tokenVerifier;

    /// @notice Constructor
    function ERC20Manager(Storage _store, bytes32 _crate) BaseManager(_store, _crate) public {
        tokenAddresses.init('tokenAddresses');
        tokenBySymbol.init('tokeBySymbol');
        name.init('name');
        symbol.init('symbol');
        url.init('url');
        ipfsHash.init('ipfsHash');
        swarmHash.init('swarmHash');
        decimals.init('decimals');
        tokenVerifier.init('tokenVerifier');
    }

    /// @notice Init the contract
    function init(address _contractsManager) public onlyContractOwner returns (uint) {
        BaseManager.init(_contractsManager, "ERC20Manager");

        return OK;
    }

    /// @notice Set ERC20 token verifier
    function setTokenVerifier(address _tokenVerifier) public onlyContractOwner {
        store.set(tokenVerifier, _tokenVerifier);
    }

    /// @notice Allows trusted account/constract to add a new token to the registry.
    /// @param _token Address of new token.
    /// @param _name Name of new token.
    /// @param _symbol Symbol for new token.
    /// @param _url Token's project URL.
    /// @param _decimals Number of decimals, divisibility of new token.
    /// @param _ipfsHash IPFS hash of token icon.
    /// @param _swarmHash Swarm hash of token icon.
    function addToken(
        address _token,
        bytes32 _name,
        bytes32 _symbol,
        bytes32 _url,
        uint8 _decimals,
        bytes32 _ipfsHash,
        bytes32 _swarmHash)
    public
    returns (uint)
    {
        if (isTokenExists(_token)) {
            return _emitError(ERROR_ERCMANAGER_TOKEN_ALREADY_EXISTS);
        }

        if (isTokenSymbolExists(_symbol)) {
            return _emitError(ERROR_ERCMANAGER_TOKEN_SYMBOL_ALREADY_EXISTS);
        }

        if (!isTokenValid(_token)) {
            return _emitError(ERROR_ERCMANAGER_INVALID_INVOCATION);
        }

        store.add(tokenAddresses, _token);
        store.set(tokenBySymbol, _symbol, _token);
        store.set(name, _token, _name);
        store.set(symbol, _token, _symbol);
        store.set(url, _token, _url);
        store.set(decimals, _token, _decimals);
        store.set(ipfsHash, _token, _ipfsHash);
        store.set(swarmHash, _token, _swarmHash);

        _emitLogAddToken(_token, _name, _symbol, _url, _decimals, _ipfsHash, _swarmHash);
        return OK;
    }

    /// @notice Allows owner to alter a token
    /// @param _token Address of old token.
    /// @param _newToken Address of new token.
    /// @param _name Name of new token.
    /// @param _symbol Symbol for new token.
    /// @param _url Token's project URL.
    /// @param _decimals Number of decimals, divisibility of new token.
    /// @param _ipfsHash IPFS hash of token icon.
    /// @param _swarmHash Swarm hash of token icon.
    function setToken(
        address _token,
        address _newToken,
        bytes32 _name,
        bytes32 _symbol,
        bytes32 _url,
        uint8 _decimals,
        bytes32 _ipfsHash,
        bytes32 _swarmHash)
    public
    onlyAuthorized
    returns (uint)
    {
        if (!isTokenExists(_token)) {
            return _emitError(ERROR_ERCMANAGER_TOKEN_NOT_EXISTS);
        }

        if (!isTokenValid(_newToken)) {
            return _emitError(ERROR_ERCMANAGER_INVALID_INVOCATION);
        }

        bool changed;
        if(_symbol != store.get(symbol,_token)) {
            if (store.get(tokenBySymbol,_symbol) == address(0)) {
                store.set(tokenBySymbol,store.get(symbol,_token),address(0));
                if(_token != _newToken) {
                    store.set(tokenBySymbol,_symbol,_newToken);
                    store.set(symbol,_newToken,_symbol);
                } else {
                    store.set(tokenBySymbol,_symbol,_token);
                    store.set(symbol,_token,_symbol);
                }
                changed = true;
            } else {
                return _emitError(ERROR_ERCMANAGER_TOKEN_UNCHANGED);
            }
        }
        if(_token != _newToken) {
            Asset(_newToken).totalSupply();
            store.set(tokenAddresses,_token,_newToken);
            if(!changed) {
                store.set(tokenBySymbol,_symbol,_newToken);
                store.set(symbol,_newToken,_symbol);
            }
            store.set(name,_newToken,_name);
            store.set(url,_newToken,_url);
            store.set(decimals,_newToken,_decimals);
            store.set(ipfsHash,_newToken,_ipfsHash);
            store.set(swarmHash,_newToken,_swarmHash);
            _token = _newToken;
            changed = true;
        }

        if(store.get(name,_token) != _name) {
            store.set(name,_token,_name);
            changed = true;
        }

        if(store.get(decimals,_token) != _decimals) {
            store.set(decimals,_token,_decimals);
            changed = true;
        }
        if(store.get(url,_token) != _url) {
            store.set(url,_token,_url);
            changed = true;
        }
        if(store.get(ipfsHash,_token) != _ipfsHash) {
            store.set(ipfsHash,_token,_ipfsHash);
            changed = true;
        }
        if(store.get(swarmHash,_token) != _swarmHash) {
            store.set(swarmHash,_token,_swarmHash);
            changed = true;
        }

        if(changed) {
            _emitLogTokenChange(_token, _newToken, _name, _symbol, _url, _decimals, _ipfsHash, _swarmHash);
            return OK;
        }

        return _emitError(ERROR_ERCMANAGER_TOKEN_UNCHANGED);
    }

    /// @notice Allows CBE to remove an existing token from the registry.
    /// @param _token Address of existing token.
    function removeTokenByAddress(address _token)
    public
    onlyAuthorized
    returns (uint)
    {
        if (!isTokenExists(_token)) {
            return _emitError(ERROR_ERCMANAGER_TOKEN_NOT_EXISTS);
        }

        return removeToken(_token);
    }

    /// @notice Allows CBE to remove an existing token from the registry.
    /// @param _symbol Symbol of existing token.
    function removeTokenBySymbol(bytes32 _symbol)
    public
    onlyAuthorized
    returns (uint)
    {
        if (!isTokenSymbolExists(_symbol)) {
            return _emitError(ERROR_ERCMANAGER_TOKEN_SYMBOL_NOT_EXISTS);
        }

        return removeToken(store.get(tokenBySymbol,_symbol));
    }

    /// @notice Returns token's address by given id
    function getAddressById(uint _id)
    public
    view
    returns (address)
    {
        return store.get(tokenAddresses, _id);
    }

    /// @notice Provides a registered token's address when given the token symbol.
    /// @param _symbol Symbol of registered token.
    /// @return Token's address.
    function getTokenAddressBySymbol(bytes32 _symbol)
    public
    view
    returns (address tokenAddress)
    {
        return store.get(tokenBySymbol, _symbol);
    }

    /// @notice Provides a registered token's metadata, looked up by address.
    /// @param _token Address of registered token.
    /// @return Token metadata.
    function getTokenMetaData(address _token)
    public
    view
    returns (
      address _tokenAddress,
      bytes32 _name,
      bytes32 _symbol,
      bytes32 _url,
      uint8 _decimals,
      bytes32 _ipfsHash,
      bytes32 _swarmHash
    )
    {
        if (!isTokenExists(_token)) {
            return;
        }

        _name = store.get(name, _token);
        _symbol = store.get(symbol, _token);
        _url = store.get(url, _token);
        _decimals = uint8(store.get(decimals, _token));
        _ipfsHash = store.get(ipfsHash, _token);
        _swarmHash = store.get(swarmHash, _token);

        return (_token, _name, _symbol, _url, _decimals, _ipfsHash, _swarmHash);
    }

    /// @notice Returns count of registred ERC20 tokens
    /// @return token count
    function tokensCount()
    public
    view
    returns (uint)
    {
        return store.count(tokenAddresses);
    }

    /// @dev Returns an array containing all token addresses.
    /// @return Array of token addresses.
    function getTokenAddresses()
    public
    view
    returns (address[]) {
        return store.get(tokenAddresses);
    }

    /// @notice Provides details of a given tokens
    function getTokens(address[] _addresses)
    public
    view
    returns (
      address[] _tokensAddresses,
      bytes32[] _names,
      bytes32[] _symbols,
      bytes32[] _urls,
      uint8[] _decimalsArr,
      bytes32[] _ipfsHashes,
      bytes32[] _swarmHashes
    )
    {
        if (_addresses.length == 0) {
            _addresses = getTokenAddresses();
        }
        _tokensAddresses = _addresses;
        _names = new bytes32[](_addresses.length);
        _symbols = new bytes32[](_addresses.length);
        _urls = new bytes32[](_addresses.length);
        _decimalsArr = new uint8[](_addresses.length);
        _ipfsHashes = new bytes32[](_addresses.length);
        _swarmHashes = new bytes32[](_addresses.length);

        for (uint i = 0; i < _addresses.length; i++) {
            _names[i] = store.get(name, _addresses[i]);
            _symbols[i] = store.get(symbol, _addresses[i]);
            _urls[i] = store.get(url, _addresses[i]);
            _decimalsArr[i] = uint8(store.get(decimals, _addresses[i]));
            _ipfsHashes[i] = store.get(ipfsHash, _addresses[i]);
            _swarmHashes[i] = store.get(swarmHash, _addresses[i]);
        }

        return (_tokensAddresses, _names, _symbols, _urls, _decimalsArr, _ipfsHashes, _swarmHashes);
    }

    /// @notice Provides a registered token's metadata, looked up by symbol.
    /// @param _symbol Symbol of registered token.
    /// @return Token metadata.
    function getTokenBySymbol(bytes32 __symbol)
    public
    view
    returns (
      address _tokenAddress,
      bytes32 _name,
      bytes32 _symbol,
      bytes32 _url,
      uint8 _decimals,
      bytes32 _ipfsHash,
      bytes32 _swarmHash
    )
    {
        if (!isTokenSymbolExists(__symbol)) {
            return;
        }

        address _token = store.get(tokenBySymbol, __symbol);
        return getTokenMetaData(_token);
    }

    /// @notice Tells whether a given token exists or not
    function isTokenExists(address _token) public view returns (bool) {
        return store.includes(tokenAddresses, _token);
    }

    /// @notice Tells whether a given token exists or not
    function isTokenSymbolExists(bytes32 _symbol) public view returns (bool) {
        return (store.get(tokenBySymbol, _symbol) != address(0));
    }

    /// @notice Tells whether a given token valid or not
    function isTokenValid(address _token) public view returns (bool) {
      if (store.get(tokenVerifier) != 0x0) {
          ERC20TokenVerifier verifier = ERC20TokenVerifier(store.get(tokenVerifier));
          return verifier.verify(_token);
      }

      return true;
    }

    /// @notice Allows owner to remove an existing token from the registry.
    /// @param _token Address of existing token.
    function removeToken(address _token)
    internal
    returns (uint)
    {
        _emitLogRemoveToken(
            _token,
            store.get(name,_token),
            store.get(symbol,_token),
            store.get(url,_token),
            uint8(store.get(decimals,_token)),
            store.get(ipfsHash,_token),
            store.get(swarmHash,_token)
        );

        store.set(tokenBySymbol, store.get(symbol,_token), address(0));

        store.remove(tokenAddresses, _token);
        // TODO: ahiatsevich clean up url, decimals, ipfsHash, swarmHash

        return OK;
    }

    function _emitLogAddToken (
        address _token,
        bytes32 _name,
        bytes32 _symbol,
        bytes32 _url,
        uint8 _decimals,
        bytes32 _ipfsHash,
        bytes32 _swarmHash)
    private
    {
        ERC20ManagerEmitter emiter = ERC20ManagerEmitter(getEventsHistory());
        emiter.emitLogAddToken(_token, _name, _symbol, _url, _decimals, _ipfsHash, _swarmHash);
    }

    function _emitLogTokenChange (
        address _oldToken,
        address _token,
        bytes32 _name,
        bytes32 _symbol,
        bytes32 _url,
        uint8 _decimals,
        bytes32 _ipfsHash,
        bytes32 _swarmHash)
    private
    {
        ERC20ManagerEmitter emiter = ERC20ManagerEmitter(getEventsHistory());
        emiter.emitLogTokenChange(_oldToken, _token, _name, _symbol, _url, _decimals, _ipfsHash, _swarmHash);
    }

    function _emitLogRemoveToken (
        address _token,
        bytes32 _name,
        bytes32 _symbol,
        bytes32 _url,
        uint8 _decimals,
        bytes32 _ipfsHash,
        bytes32 _swarmHash)
    private
    {
        ERC20ManagerEmitter emiter = ERC20ManagerEmitter(getEventsHistory());
        emiter.emitLogRemoveToken(_token, _name, _symbol, _url, _decimals, _ipfsHash, _swarmHash);
    }

    /// Emits error log via events history contract
    function _emitError(uint e) private returns (uint)   {
        ERC20Manager(getEventsHistory()).emitError(e);
        return e;
    }
}
