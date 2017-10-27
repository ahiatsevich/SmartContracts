pragma solidity ^0.4.11;

import '../core/event/MultiEventsHistoryAdapter.sol';

/**
* Emitter with support of events history for PlatformsManager
*/
contract PlatformsManagerEmitter is MultiEventsHistoryAdapter {

    /**
    * @dev TODO
    */
    event PlatformAttached(address indexed self, address platform);

    /**
    * @dev TODO
    */
    event PlatformDetached(address indexed self, address platform);

    /**
    * @dev TODO
    */
    event PlatformRequested(address indexed self, address platform, address tokenExtension);

    /**
    * @dev TODO
    */
    event PlatformReplaced(address indexed self, address fromPlatform, address toPlatform);

    /**
    * @dev TODO
    */
    event Error(address indexed self, uint errorCode);

    /**
    * Emitting events
    */

    function emitPlatformAttached( address _platform) {
        PlatformAttached(_self(), _platform);
    }

    function emitPlatformDetached( address _platform) {
        PlatformDetached(_self(), _platform);
    }

    function emitPlatformRequested( address _platform, address _tokenExtension) {
        PlatformRequested(_self(), _platform, _tokenExtension);
    }

    function emitPlatformReplaced( address _fromPlatform, address _toPlatform) {
        PlatformReplaced(_self(), _fromPlatform, _toPlatform);
    }

    function emitError(uint _errorCode) {
        Error(_self(), _errorCode);
    }
}
