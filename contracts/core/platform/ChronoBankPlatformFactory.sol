/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.24;


import "./ChronoBankPlatform.sol";
import "../event/MultiEventsHistory.sol";
import "../contracts/ContractsManagerInterface.sol";
import "../storage/StorageManager.sol";
import "../storage/Storage.sol";


/// @title Implementation of platform factory to create exactly ChronoBankPlatform contract instances.
contract ChronoBankPlatformFactory is Owned {

    uint constant OK = 1;

    /// @notice Creates a brand new platform and transfers platform ownership to msg.sender
    /// @dev Owner (or authorized account) of StorageManager should authorized Factory contract in StorageManager
    /// @param _storageManager StorageManager contract that is shared across system to create users' contracts;
    ///   (recommended to be different from system's StorageManager contract do separate responsibility areas)
    /// @param _eventsHistory events history address
    function createPlatform(
        StorageManager _storageManager, 
        MultiEventsHistory _eventsHistory
    ) 
    public 
    returns (address) 
    {
        ChronoBankPlatform _platform = new ChronoBankPlatform();

        // ChronoBankPlatform inherits from StorageAdapter so should be given write access
        if (OK != _storageManager.giveAccess(_platform, "ChronoBankPlatform")) {
            revert("Cannot give access to Chronobank Platform storage");
        }

        if (!_eventsHistory.authorize(_platform)) {
            revert("EventsHistory couldn't authorize Chronobank Platform");
        }

        if (OK != _platform.setupEventsHistory(_eventsHistory)) {
            revert("Cannot setup events history to the Chronobank Platform");
        }

        // As for Storage contract to be able to check rights for write
        _platform.setManager(Manager(_storageManager));

        if (!_platform.transferContractOwnership(msg.sender)) {
            revert("Cannot transfer ownership of the Chronobank Platform to a sender");
        }
        
        return _platform;
    }
}