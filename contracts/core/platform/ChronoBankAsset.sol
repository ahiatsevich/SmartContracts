/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.24;


import "./ChronoBankAssetInterface.sol";
import {ChronoBankAssetProxyInterface as ChronoBankAssetProxy} from "./ChronoBankAssetProxyInterface.sol";
import {ChronoBankPlatformInterface as ChronoBankPlatform} from "./ChronoBankPlatformInterface.sol";
import "../storage/StorageAdapter.sol";
import "../storage/Storage.sol";


/// @title ChronoBank Asset implementation contract.
///
/// Basic asset implementation contract, without any additional logic.
/// Every other asset implementation contracts should derive from this one.
/// Receives calls from the proxy, and calls back immediatly without arguments modification.
///
/// Note: all the non constant functions return false instead of throwing in case if state change
/// didn't happen yet.
contract ChronoBankAsset is ChronoBankAssetInterface, StorageAdapter {

    bytes32 constant CHRONOBANK_PLATFORM_CRATE = "ChronoBankPlatform";

    /// @dev Assigned asset proxy contract, immutable.
    StorageInterface.Address private proxyStorage;

    /// @dev banned addresses
    StorageInterface.AddressBoolMapping private blacklistStorage;

    /// @dev stops asset transfers
    StorageInterface.Bool private pausedStorage;

    /// @dev restriction/Unrestriction events
    event Restricted(bytes32 indexed symbol, address restricted);
    event Unrestricted(bytes32 indexed symbol, address unrestricted);

    /// @dev Paused/Unpaused events
    event Paused(bytes32 indexed symbol);
    event Unpaused(bytes32 indexed symbol);

    /// @dev Only assigned proxy is allowed to call.
    modifier onlyProxy {
        if (proxy() == msg.sender) {
            _;
        }
    }

    /// @dev Only not paused tokens could go further.
    modifier onlyNotPaused {
        if (!paused()) {
            _;
        }
    }

    /// @dev Only acceptable (not in blacklist) addresses are allowed to call.
    modifier onlyAcceptable(address _address) {
        if (!blacklist(_address)) {
            _;
        }
    }

    /// @dev Only assets's admins are allowed to execute
    modifier onlyAuthorized {
        if (_chronoBankPlatform().hasAssetRights(msg.sender, proxy().smbl())) {
            _;
        }
    }

    constructor(Storage _platform, bytes32 _crate) StorageAdapter(_platform, _crate) public {
        require(_crate != CHRONOBANK_PLATFORM_CRATE, "Asset crate should not have the same space as a platform");

        proxyStorage.init("proxy");
        blacklistStorage.init("blacklist");
        pausedStorage.init("paused");
    }

    /// @notice Sets asset proxy address.
    /// Can be set only once.
    /// @dev function is final, and must not be overridden.
    /// @param _proxy asset proxy contract address.
    /// @return success.
    function init(ChronoBankAssetProxy _proxy) 
    public 
    returns (bool) 
    {
        require(address(store.store) == _proxy.chronoBankPlatform(), "ChronoBank platform should be a storage of an asset");

        if (address(proxy()) != 0x0) {
            return false;
        }

        store.set(proxyStorage, _proxy);
        return true;
    }

    /// @notice Gets eventsHistory contract used for events' triggering
    function eventsHistory() 
    public 
    view 
    returns (address) 
    {
        ChronoBankPlatform platform = _chronoBankPlatform();
        return platform.eventsHistory() != address(platform) ? platform.eventsHistory() : this;
    }

    function proxy() 
    public 
    view 
    returns (ChronoBankAssetProxy) 
    {
        return ChronoBankAssetProxy(store.get(proxyStorage));
    }

    function 
    blacklist(address _account) 
    public 
    view 
    returns (bool) 
    {
        return store.get(blacklistStorage, _account);
    }

    function paused() 
    public 
    view 
    returns (bool) 
    {
        return store.get(pausedStorage);
    }

    /// @notice Lifts the ban on transfers for given addresses
    function restrict(address [] _restricted) 
    external 
    onlyAuthorized 
    returns (bool) 
    {
        for (uint i = 0; i < _restricted.length; i++) {
            address restricted = _restricted[i];
            store.set(blacklistStorage, restricted, true);
            _emitRestricted(restricted);
        }
        return true;
    }

    /// @notice Revokes the ban on transfers for given addresses
    function unrestrict(address [] _unrestricted) 
    external 
    onlyAuthorized 
    returns (bool) 
    {
        for (uint i = 0; i < _unrestricted.length; i++) {
            address unrestricted = _unrestricted[i];
            store.set(blacklistStorage, unrestricted, false);
            _emitUnrestricted(unrestricted);
        }
        return true;
    }

    /// @notice called by the owner to pause, triggers stopped state
    /// Only admin is allowed to execute this method.
    function pause() 
    external 
    onlyAuthorized 
    returns (bool) 
    {
        store.set(pausedStorage, true);
        _emitPaused();
        return true;
    }

    /// @notice called by the owner to unpause, returns to normal state
    /// Only admin is allowed to execute this method.
    function unpause() 
    external 
    onlyAuthorized 
    returns (bool) 
    {
        store.set(pausedStorage, false);
        _emitUnpaused();
        return true;
    }

    /// @notice Passes execution into virtual function.
    /// Can only be called by assigned asset proxy.
    /// @dev function is final, and must not be overridden.
    /// @return success.
    function __transferWithReference(
        address _to, 
        uint _value, 
        string _reference, 
        address _sender
    ) 
    public 
    onlyProxy 
    returns (bool) 
    {
        return _transferWithReference(_to, _value, _reference, _sender);
    }

    /// @notice Calls back without modifications if an asset is not stopped.
    /// Checks whether _from/_sender are not in blacklist.
    /// @dev function is virtual, and meant to be overridden.
    /// @return success.
    function _transferWithReference(
        address _to, 
        uint _value, 
        string _reference, 
        address _sender
    )
    internal
    onlyNotPaused
    onlyAcceptable(_to)
    onlyAcceptable(_sender)
    returns (bool)
    {
        return proxy().__transferWithReference(_to, _value, _reference, _sender);
    }

    /// @notice Passes execution into virtual function.
    /// Can only be called by assigned asset proxy.
    /// @dev function is final, and must not be overridden.
    /// @return success.
    function __transferFromWithReference(
        address _from, 
        address _to, 
        uint _value, 
        string _reference, 
        address _sender
    ) 
    public 
    onlyProxy 
    returns (bool) 
    {
        return _transferFromWithReference(_from, _to, _value, _reference, _sender);
    }

    /// @notice Calls back without modifications if an asset is not stopped.
    /// Checks whether _from/_sender are not in blacklist.
    /// @dev function is virtual, and meant to be overridden.
    /// @return success.
    function _transferFromWithReference(
        address _from, 
        address _to, 
        uint _value, 
        string _reference, 
        address _sender
    )
    internal
    onlyNotPaused
    onlyAcceptable(_from)
    onlyAcceptable(_to)
    onlyAcceptable(_sender)
    returns (bool)
    {
        return proxy().__transferFromWithReference(_from, _to, _value, _reference, _sender);
    }

    /// @notice Passes execution into virtual function.
    /// Can only be called by assigned asset proxy.
    /// @dev function is final, and must not be overridden.
    /// @return success.
    function __approve(address _spender, uint _value, address _sender) onlyProxy public returns (bool) {
        return _approve(_spender, _value, _sender);
    }

    /// @notice Calls back without modifications.
    /// @dev function is virtual, and meant to be overridden.
    /// @return success.
    function _approve(address _spender, uint _value, address _sender)
    internal
    onlyAcceptable(_spender)
    onlyAcceptable(_sender)
    returns (bool)
    {
        return proxy().__approve(_spender, _value, _sender);
    }

    function emitRestricted(bytes32 _symbol, address _restricted) public {
        emit Restricted(_symbol, _restricted);
    }

    function emitUnrestricted(bytes32 _symbol, address _unrestricted) public {
        emit Unrestricted(_symbol, _unrestricted);
    }

    function emitPaused(bytes32 _symbol) public {
        emit Paused(_symbol);
    }

    function emitUnpaused(bytes32 _symbol) public {
        emit Unpaused(_symbol);
    }

    function _emitRestricted(address _restricted) private {
        ChronoBankAsset(eventsHistory()).emitRestricted(proxy().smbl(), _restricted);
    }

    function _emitUnrestricted(address _unrestricted) private {
        ChronoBankAsset(eventsHistory()).emitUnrestricted(proxy().smbl(), _unrestricted);
    }

    function _emitPaused() private {
        ChronoBankAsset(eventsHistory()).emitPaused(proxy().smbl());
    }

    function _emitUnpaused() private {
        ChronoBankAsset(eventsHistory()).emitUnpaused(proxy().smbl());
    }

    function _chronoBankPlatform()
    private
    view
    returns (ChronoBankPlatform)
    {
        return ChronoBankPlatform(proxy().chronoBankPlatform());
    }
}
