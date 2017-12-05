pragma solidity ^0.4.11;

import "./ChronoBankPlatform.sol";
import "../event/MultiEventsHistory.sol";
import "../common/Owned.sol";
import "../contracts/ContractsManagerInterface.sol";

/**
* @dev TODO
*/
contract ChronoBankPlatformFactory is Owned {

    address ownershipResolver;

    function ChronoBankPlatformFactory(address _ownershipResolver) public {
        require(_ownershipResolver != 0x0);

        ownershipResolver = _ownershipResolver;
    }

    function setOwnershipResolver(address _ownershipResolver) onlyContractOwner public {
        require(_ownershipResolver != 0x0);
        ownershipResolver = _ownershipResolver;
    }

    function createPlatform(address, MultiEventsHistory eventsHistory, address eventsHistoryAdmin) public returns(address) {
        ChronoBankPlatform platform = new ChronoBankPlatform();
        eventsHistory.authorize(platform);
        platform.setupEventsAdmin(eventsHistoryAdmin);
        platform.setupEventsHistory(eventsHistory);
        platform.setupAssetOwningListener(ownershipResolver);
        platform.transferContractOwnership(msg.sender);
        return platform;
    }
}
