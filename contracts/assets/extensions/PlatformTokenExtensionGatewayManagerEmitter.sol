pragma solidity ^0.4.11;

import '../../core/event/MultiEventsHistoryAdapter.sol';

/**
* Emitter with support of events history for PlatformTokenExtensionGatewayManager
*/
contract PlatformTokenExtensionGatewayManagerEmitter is MultiEventsHistoryAdapter {

    /** TODO */
    event Error(address indexed self, uint errorCode);

    /** TODO */
    event AssetCreated(address indexed self, address platform, bytes32 symbol, address token, address indexed by);

    /** TODO */
    event CrowdsaleCampaignCreated(address indexed self, address platform, bytes32 symbol, address campaign, address indexed by);

    /** TODO */
    event CrowdsaleCampaignRemoved(address indexed self, address platform, bytes32 symbol, address campaign, address indexed by);


    function emitError(uint _errorCode) {
        Error(_self(), _errorCode);
    }

    function emitAssetCreated(address _platform, bytes32 _symbol, address _token, address _by) {
        AssetCreated(_self(), _platform, _symbol, _token, _by);
    }

    function emitCrowdsaleCampaignCreated(address _platform, bytes32 _symbol, address _campaign, address _by) {
        CrowdsaleCampaignCreated(_self(), _platform, _symbol, _campaign, _by);
    }

    function emitCrowdsaleCampaignRemoved(address _platform, bytes32 _symbol, address _campaign, address _by) {
        CrowdsaleCampaignRemoved(_self(), _platform, _symbol, _campaign, _by);
    }
}
