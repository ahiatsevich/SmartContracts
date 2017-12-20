pragma solidity ^0.4.11;

import "./ChronoBankPlatform.sol";
import "../event/MultiEventsHistory.sol";
import "../common/Owned.sol";
import "../contracts/ContractsManagerInterface.sol";

/// @title Implementation of platform factory to create exactly ChronoBankPlatform contract instances.
contract ChronoBankPlatformFactory is Owned {
    uint constant OK = 1;

    function ChronoBankPlatformFactory() public {
    }

    /// @dev Creates a brand new platform and transfers platform ownership to msg.sender
    function createPlatform(MultiEventsHistory eventsHistory) public returns(address) {
        ChronoBankPlatform platform = new ChronoBankPlatform();
        if (!eventsHistory.authorize(platform)) {
            revert();
        }

        if (OK != platform.setupEventsHistory(eventsHistory)) {
            revert();
        }

        if (!platform.transferContractOwnership(msg.sender)) {
            revert();
        }
        
        return platform;
    }
}
