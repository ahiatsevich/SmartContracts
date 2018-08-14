/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;

import "./ChronoBankAssetAbstract.sol";

contract ChronoBankAssetPausable is ChronoBankAssetAbstract {

    /// @dev Paused/Unpaused events
    event Paused(bytes32 indexed symbol);
    event Unpaused(bytes32 indexed symbol);

    /// @dev stops asset transfers
    StorageInterface.Bool private pausedStorage;
    
    /// @dev Only not paused tokens could go further.
    modifier onlyNotPaused {
        if (!paused()) {
            _;
        }
    }

    constructor(Storage _platform, bytes32 _crate) ChronoBankAssetAbstract(_platform, _crate) public {
        pausedStorage.init("paused");
    }

    function assetType()
    public
    pure
    returns (bytes32)
    {
        return "ChronoBankAssetPausable";
    }

    function paused() 
    public 
    view 
    returns (bool) 
    {
        return store.get(pausedStorage);
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

    function emitPaused(bytes32 _symbol) public {
        emit Paused(_symbol);
    }

    function emitUnpaused(bytes32 _symbol) public {
        emit Unpaused(_symbol);
    }

    function _emitPaused() private {
        ChronoBankAssetPausable(eventsHistory()).emitPaused(proxy().smbl());
    }

    function _emitUnpaused() private {
        ChronoBankAssetPausable(eventsHistory()).emitUnpaused(proxy().smbl());
    }

    function _beforeTransferWithReference(
        address, 
        uint, 
        string, 
        address
    )
    internal
    onlyNotPaused
    returns (bool)
    {
        return true;
    }

    function _beforeTransferFromWithReference(
        address, 
        address, 
        uint, 
        string, 
        address
    )
    internal
    onlyNotPaused
    returns (bool)
    {
        return true;
    }

    function _beforeApprove(address, uint, address)
    internal
    returns (bool)
    {
        return true;
    }
}