pragma solidity ^0.4.11;

import '../core/event/MultiEventsHistoryAdapter.sol';

/**
* @title Emitter with support of events history for AssetsManager
*/
contract AssetsManagerEmitter is MultiEventsHistoryAdapter {

    /** error event */
    event Error(address indexed self, uint errorCode);

    /** event for requesting token extension */
    event TokenExtensionRequested(address indexed self, address platform, address tokenExtension);

    /** event for registering token extension */
    event TokenExtensionRegistered(address indexed self, address platform, address tokenExtension);

    /** event for unregistering token extension */
    event TokenExtensionUnregistered(address indexed self, address tokenExtension);

    /** Emitting events */

    function emitError(uint errorCode) public {
        Error(_self(), errorCode);
    }

    function emitTokenExtensionRequested(address _platform, address _tokenExtension) public {
        TokenExtensionRequested(_self(), _platform, _tokenExtension);
    }

    function emitTokenExtensionRegistered(address _platform, address _tokenExtension) public {
        TokenExtensionRegistered(_self(), _platform, _tokenExtension);
    }

    function emitTokenExtensionUnregistered(address _tokenExtension) public {
        TokenExtensionUnregistered(_self(), _tokenExtension);
    }
}
