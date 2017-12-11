pragma solidity ^0.4.11;

import "./ChronoBankPlatform.sol";
import "../event/MultiEventsHistory.sol";
import "../common/Owned.sol";
import "../contracts/ContractsManagerInterface.sol";

/**
* @title Implementation of platform factory to create exactly ChronoBankPlatform contract instances.
*/
contract ChronoBankPlatformFactory is Owned {

    /** @dev DEPRECATED. WILL BE REMOVED IN NEXT RELEASES */
    address ownershipResolver;

    function ChronoBankPlatformFactory(address _ownershipResolver) public {
        require(_ownershipResolver != 0x0);

        ownershipResolver = _ownershipResolver;
    }

    function setOwnershipResolver(address _ownershipResolver) onlyContractOwner public {
        require(_ownershipResolver != 0x0);
        ownershipResolver = _ownershipResolver;
    }

    /**
    * @dev Creates a brand new platform and transfers platform ownership to msg.sender
    */
    function createPlatform(address, MultiEventsHistory eventsHistory, address eventsHistoryAdmin) public returns(address) {
        ChronoBankPlatform platform = new ChronoBankPlatform();
        eventsHistory.authorize(platform);
        platform.setupEventsAdmin(eventsHistoryAdmin);
        platform.setupEventsHistory(eventsHistory);
        platform.transferContractOwnership(msg.sender);
        return platform;
    }
}