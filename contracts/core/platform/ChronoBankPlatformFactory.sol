/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.24;


import "./ChronoBankPlatform.sol";
import "../event/MultiEventsHistory.sol";
import "../contracts/ContractsManagerInterface.sol";


/// @title Implementation of platform factory to create exactly ChronoBankPlatform contract instances.
contract ChronoBankPlatformFactory is Owned {

    uint constant OK = 1;

    /// @notice Creates a brand new platform and transfers platform ownership to msg.sender
    /// @param _eventsHistory events history address
    function createPlatform(
        MultiEventsHistory _eventsHistory
    ) 
    public 
    returns (address) 
    {
        ChronoBankPlatform _platform = new ChronoBankPlatform();

        if (!_eventsHistory.authorize(_platform)) {
            revert("EventsHistory couldn't authorize Chronobank Platform");
        }

        if (OK != _platform.setupEventsHistory(_eventsHistory)) {
            revert("Cannot setup events history to the Chronobank Platform");
        }

        if (!_platform.transferContractOwnership(msg.sender)) {
            revert("Cannot transfer ownership of the Chronobank Platform to a sender");
        }
        
        return _platform;
    }
}