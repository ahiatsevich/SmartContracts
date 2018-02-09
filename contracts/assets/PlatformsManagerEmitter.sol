pragma solidity ^0.4.11;

import '../core/event/MultiEventsHistoryAdapter.sol';

/**
* @title Emitter with support of events history for PlatformsManager
*/
contract PlatformsManagerEmitter is MultiEventsHistoryAdapter {

    /**
    * @dev Event for attaching a platform to the system
    */
    event PlatformAttached(address indexed self, address platform, address indexed by);

    /**
    * @dev Event for detaching a platform from the system
    */
    event PlatformDetached(address indexed self, address platform, address indexed by);

    /**
    * @dev Event for creating a platform
    */
    event PlatformRequested(address indexed self, address platform, address tokenExtension, address indexed by);

    /**
    * @dev Event for errors
    */
    event Error(address indexed self, uint errorCode);


    /**
    * Emitting events
    */

    function emitPlatformAttached( address _platform, address _by) public {
        PlatformAttached(_self(), _platform, _by);
    }

    function emitPlatformDetached( address _platform, address _by) public {
        PlatformDetached(_self(), _platform, _by);
    }

    function emitPlatformRequested( address _platform, address _tokenExtension, address _by) public {
        PlatformRequested(_self(), _platform, _tokenExtension, _by);
    }

    function emitError(uint _errorCode) public {
        Error(_self(), _errorCode);
    }
}
