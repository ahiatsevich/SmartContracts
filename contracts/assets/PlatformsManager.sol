pragma solidity ^0.4.11;

import "../core/common/BaseManager.sol";
import "../timeholder/FeatureFeeAdapter.sol";
import "../core/common/OwnedInterface.sol";
import "../core/platform/ChronoBankAssetOwnershipManager.sol";
import "./PlatformsManagerEmitter.sol";
import "./AssetsManagerInterface.sol";
import "../core/platform/ChronoBankPlatform.sol";


contract PlatformsFactory {
    function createPlatform(address eventsHistory) public returns (address);
}


contract OwnedContract {
    address public contractOwner;
}


/// @title Defines implementation for managing platforms creation and tracking system's platforms.
/// Some methods could require to pay additional fee in TIMEs during their invocation.
contract PlatformsManager is FeatureFeeAdapter, BaseManager, PlatformsManagerEmitter {

    /** Error codes */
    uint constant ERROR_PLATFORMS_SCOPE = 21000;
    uint constant ERROR_PLATFORMS_ATTACHING_PLATFORM_ALREADY_EXISTS = ERROR_PLATFORMS_SCOPE + 1;
    uint constant ERROR_PLATFORMS_PLATFORM_DOES_NOT_EXIST = ERROR_PLATFORMS_SCOPE + 2;

    /** Storage keys */

    /// @dev address of platforms factory contract
    StorageInterface.Address platformsFactory;

    /// @dev DEPRECATED. WILL BE REMOVED IN THE NEXT RELEASE
    StorageInterface.OrderedAddressesSet platforms_old;

    /// @dev set(address) stands for set(platform)
    StorageInterface.AddressesSet platforms;

    /// @dev Guards methods for only platform owners
    modifier onlyPlatformOwner(address _platform) {
        if (_isPlatformOwner(_platform)) {
            _;
        }
    }

    function PlatformsManager(Storage _store, bytes32 _crate) BaseManager(_store, _crate) public {
        platformsFactory.init("platformsFactory");
        platforms_old.init("v1platforms"); /// NOTE: DEPRECATED. WILL BE REMOVED IN THE NEXT RELEASE
        platforms.init("v2platforms");
    }

    function init(address _contractsManager, address _platformsFactory) onlyContractOwner public returns (uint) {
        BaseManager.init(_contractsManager, "PlatformsManager");

        /// NOTE: migration loop. WILL BE REMOVED IN THE NEXT RELEASE
        if (store.count(platforms_old) > 0) {
            StorageInterface.Iterator memory _iterator = store.listIterator(platforms_old);
            while (store.canGetNextWithIterator(platforms_old, _iterator)) {
                address _platform = store.getNextWithIterator(platforms_old, _iterator);
                store.add(platforms, _platform);
                store.remove(platforms_old, _platform);
            }
        }

        store.set(platformsFactory, _platformsFactory);

        return OK;
    }

    /// @notice Checks if passed platform is presented in the system
    /// @param _platform platform address
    /// @return `true` if it is registered, `false` otherwise
    function isPlatformAttached(address _platform) public view returns (bool) {
        return store.includes(platforms, _platform);
    }

    /// @notice Returns number of registered platforms
    function getPlatformsCount() public view returns (uint) {
        return store.count(platforms);
    }

    /// @notice Gets a list of platforms registered in the manager. Paginated fetch.
    /// @param _start first index of a platform to start. Basically starts with `0`
    /// @param _size size of a page
    /// @return _platforms an array of platforms' addresses
    function getPlatforms(uint _start, uint _size) public view returns (address[] _platforms) {
        uint _totalPlatformsCount = getPlatformsCount();
        if (_start >= _totalPlatformsCount || _size == 0) {
            return _platforms;
        }
        _platforms = new address[](_size);

        uint _lastIdx = (_start + _size >= _totalPlatformsCount) ? _totalPlatformsCount : _start + _size;
        uint _platformIdx = 0;
        for (uint _idx = _start; _idx < _lastIdx; ++_idx) {
            _platforms[_platformIdx++] = store.get(platforms, _idx);
        }
    }

    /// @notice Responsible for registering an existed platform in the system. Could be performed only by owner of passed platform.
    /// @param _platform platform address
    /// @return resultCode result code of an operation.
    /// ERROR_PLATFORMS_ATTACHING_PLATFORM_ALREADY_EXISTS possible in case the platform is already attached
    function attachPlatform(address _platform) onlyPlatformOwner(_platform) public returns (uint resultCode) {
        if (store.includes(platforms, _platform)) {
            return _emitError(ERROR_PLATFORMS_ATTACHING_PLATFORM_ALREADY_EXISTS);
        }

        store.add(platforms, _platform);

        _emitPlatformAttached(_platform, msg.sender);

        return OK;
    }

    /// @notice Responsible for removing a platform from the system.
    /// @param _platform platform address
    /// @return resultCode result code of an operation.
    ///   ERROR_PLATFORMS_PLATFORM_DOES_NOT_EXIST possible when passed platform is not registered in platforms manager contract
    function detachPlatform(address _platform) onlyPlatformOwner(_platform) public returns (uint resultCode) {
        if (!store.includes(platforms, _platform)) {
            return _emitError(ERROR_PLATFORMS_PLATFORM_DOES_NOT_EXIST);
        }

        store.remove(platforms, _platform);

        _emitPlatformDetached(_platform, msg.sender);
        return OK;
    }

    /// @notice Creates a brand new platform.
    /// This method might take an additional fee in TIMEs.
    /// @return resultCode result code of an operation
    function createPlatform() public returns (uint resultCode) {
        return _createPlatform([uint(0)]);
    }

    function _createPlatform(uint[1] memory _result)
    private
    featured(_result)
    returns (uint resultCode)
    {
        PlatformsFactory factory = PlatformsFactory(store.get(platformsFactory));
        address _platform = factory.createPlatform(getEventsHistory());
        store.add(platforms, _platform);

        AssetsManagerInterface assetsManager = AssetsManagerInterface(lookupManager("AssetsManager"));
        resultCode = assetsManager.requestTokenExtension(_platform);
        address _tokenExtension;
        if (resultCode == OK) {
            _tokenExtension = assetsManager.getTokenExtension(_platform);
            ChronoBankAssetOwnershipManager(_platform).addPartOwner(_tokenExtension);
        }

        OwnedInterface(_platform).transferContractOwnership(msg.sender);
        _emitPlatformRequested(_platform, _tokenExtension, msg.sender);

        _result[0] = OK;
        return OK;
    }

    /// @dev Checks if passed platform is owned by msg.sender. PRIVATE
    function _isPlatformOwner(address _platform) private view returns (bool) {
        return OwnedContract(_platform).contractOwner() == msg.sender;
    }

    /**
    * Events emitting
    */

    function _emitError(uint _errorCode) private returns (uint) {
        PlatformsManagerEmitter(getEventsHistory()).emitError(_errorCode);
        return _errorCode;
    }

    function _emitPlatformAttached(address _platform, address _by) private {
        PlatformsManagerEmitter(getEventsHistory()).emitPlatformAttached(_platform, _by);
    }

    function _emitPlatformDetached(address _platform, address _by) private {
        PlatformsManagerEmitter(getEventsHistory()).emitPlatformDetached(_platform, _by);
    }

    function _emitPlatformRequested(address _platform, address _tokenExtension, address sender) private {
        PlatformsManagerEmitter(getEventsHistory()).emitPlatformRequested(_platform, _tokenExtension, sender);
    }
}
