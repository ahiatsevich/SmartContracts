pragma solidity ^0.4.11;

import "../core/common/BaseManager.sol";
import "../timeholder/FeatureFeeAdapter.sol";
import "../core/common/OwnedInterface.sol";
import "../core/platform/ChronoBankAssetOwnershipManager.sol";
import "./PlatformsManagerEmitter.sol";
import "./AssetsManagerInterface.sol";
import "./PlatformsManagerInterface.sol";
import "../core/platform/ChronoBankPlatform.sol";

contract PlatformsFactory {
    function createPlatform(address owner, address eventsHistory, address eventsHistoryAdmin) returns (address);
}

contract OwnedContract {
    address public contractOwner;
}

/**
* @title Defines implementation for managing platforms creation and tracking system's platforms.
* Some methods could require to pay additional fee in TIMEs during their invocation.
*/
contract PlatformsManager is FeatureFeeAdapter, BaseManager, PlatformsManagerEmitter, PlatformsManagerInterface {

    /** Error codes */

    uint constant ERROR_PLATFORMS_ATTACHING_PLATFORM_ALREADY_EXISTS = 21001;
    uint constant ERROR_PLATFORMS_PLATFORM_DOES_NOT_EXIST = 21002;
    uint constant ERROR_PLATFORMS_INCONSISTENT_INTERNAL_STATE = 21003;
    uint constant ERROR_PLATFORMS_REPEAT_SYNC_IS_NOT_COMPLETED = 21005;
    uint constant ERROR_PLATFORMS_CANNOT_UPDATE_EVENTS_HISTORY_NOT_EVENTS_ADMIN = 21006;

    uint constant PLATFORM_ATTACH_SYNC_DONE = 2**255;
    uint constant PLATFORM_DETACH_SYNC_DONE = 2**255-1;

    /** Storage keys */

    /** @dev address of platforms factory contract */
    StorageInterface.Address platformsFactory;

    /** @dev mapping (address => set(address)) stands for (owner => set(platform)) */
    StorageInterface.AddressesSetMapping ownerToPlatforms;

    /** @dev set(address) stands for set(platform) */
    StorageInterface.OrderedAddressesSet platforms;

    /** @dev mapping (address => uint256) stands for (platform => index) */
    StorageInterface.AddressUIntMapping syncPlatformToSymbolIdx;

    /**
    * @dev Guards methods for only platform owners
    */
    modifier onlyPlatformOwner(address _platform) {
        if (_isPlatformOwner(_platform)) {
            _;
        }
    }

    /**
    * @dev Guards methods for contracts that was platorm's owners the last time they were accessed
    */
    modifier onlyPreviousPlatformOwner(address _platform, address _previousOwner) {
        if (store.includes(ownerToPlatforms, bytes32(_previousOwner), _platform)) {
            _;
        }
    }

    function PlatformsManager(Storage _store, bytes32 _crate) BaseManager(_store, _crate) {
        platformsFactory.init("platformsFactory");
        ownerToPlatforms.init("v1ownerToPlatforms");
        platforms.init("v1platforms");
        syncPlatformToSymbolIdx.init("v1syncPlatformToSymbolIdx");
    }

    function init(address _contractsManager, address _platformsFactory) onlyContractOwner public returns (uint) {
        BaseManager.init(_contractsManager, "PlatformsManager");

        store.set(platformsFactory, _platformsFactory);

        return OK;
    }

    /**
    * @dev Returns a platform owned by passed user by accessing it by index that is registered in the system.
    *
    * @param _user associated owner of platforms
    * @param _idx index of a platform
    *
    * @return _platform platform address
    */
    function getPlatformForUserAtIndex(address _user, uint _idx) public constant returns (address _platform) {
        _platform = store.get(ownerToPlatforms, bytes32(_user), _idx);
    }

    /**
    * @dev Gets number of platform that are owned by passed user.
    *
    * @param _user associated owner of platforms
    *
    * @return number of platforms owned by user
    */
    function getPlatformsForUserCount(address _user) public constant returns (uint) {
        return store.count(ownerToPlatforms, bytes32(_user));
    }

    /**
    * @dev Gets list of platforms owned by passed user
    *
    * @param _user associated owner of platforms
    *
    * @return _platforms list of platforms owned by user
    */
    function getPlatformsMetadataForUser(address _user) public constant returns (address[] _platforms) {
        _platforms = store.get(ownerToPlatforms, bytes32(_user));
    }

    /**
    * @dev Checks if passed platform is presented in the system
    *
    * @param _platform platform address
    *
    * @return `true` if it is registered, `false` otherwise
    */
    function isPlatformAttached(address _platform) public constant returns (bool) {
        return store.includes(platforms, _platform);
    }

    /**
    * @dev Responsible for registering an existed platform in the system. Could be performed only by owner of passed platform.
    * It also reset platform's event history to system's one, so an owner should install PlatformsManager as eventsAdmin in its
    * platform contract.
    *
    * Attaching a new platform also leads to synchronyzing all assets hosted in a platform and their owners so it is possible
    * in case when a platform has a lot of assets and managers that this process of registering a platform will end up with
    * ERROR_PLATFORMS_REPEAT_SYNC_IS_NOT_COMPLETED error. It means that all goes right just keep calling this method until
    * `OK` result code will be returned; synchronysation might take several attemtps before it will be finished.
    *
    * @param _platform platform address
    *
    * @return resultCode result code of an operation.
    *   ERROR_PLATFORMS_ATTACHING_PLATFORM_ALREADY_EXISTS,
    *   ERROR_PLATFORMS_CANNOT_UPDATE_EVENTS_HISTORY_NOT_EVENTS_ADMIN,
    *   ERROR_PLATFORMS_REPEAT_SYNC_IS_NOT_COMPLETED might be returned.
    */
    function attachPlatform(address _platform) onlyPlatformOwner(_platform) public returns (uint resultCode) {
        if (store.includes(platforms, _platform)) {
            return _emitError(ERROR_PLATFORMS_ATTACHING_PLATFORM_ALREADY_EXISTS);
        }

        resultCode = _syncAssetsInPlatformBeforeAttach(_platform);
        if (resultCode != OK) {
            return _emitError(resultCode);
        }

        _attachPlatformWithoutValidation(_platform, OwnedContract(_platform).contractOwner());
        if (OK != ChronoBankPlatform(_platform).setupEventsHistory(getEventsHistory())) {
            _emitError(ERROR_PLATFORMS_CANNOT_UPDATE_EVENTS_HISTORY_NOT_EVENTS_ADMIN);
        }

        _emitPlatformAttached(_platform, msg.sender);

        return OK;
    }

    /**
    * @dev Responsible for removing a platform from the system. Could be performed only by owner of passed platform.
    * It also reset platform's eventsHistory and set platform as a new eventsHistory; still PlatformsManager should
    * be eventsAdmin in a platform.
    *
    * Detaching process also includes removal of all assets and managers from system's registry, so as an opposite
    * to a synchronization during attaching this process clean up all records about assets and their owners. It could
    * take several attempts until all data will be removed. ERROR_PLATFORMS_REPEAT_SYNC_IS_NOT_COMPLETED will be returned
    * in case if clean up process is not going to finish during this iteration so keep calling until `OK` will be a result.
    *
    * @param _platform platform address
    *
    * @return resultCode result code of an operation.
    *   ERROR_PLATFORMS_PLATFORM_DOES_NOT_EXIST,
    *   ERROR_PLATFORMS_INCONSISTENT_INTERNAL_STATE,
    *   ERROR_PLATFORMS_CANNOT_UPDATE_EVENTS_HISTORY_NOT_EVENTS_ADMIN,
    *   ERROR_PLATFORMS_REPEAT_SYNC_IS_NOT_COMPLETED might be returned.
    */
    function detachPlatform(address _platform) onlyPlatformOwner(_platform) public returns (uint resultCode) {
        if (!store.includes(platforms, _platform)) {
            return _emitError(ERROR_PLATFORMS_PLATFORM_DOES_NOT_EXIST);
        }

        address _owner = OwnedContract(_platform).contractOwner();
        if (!store.includes(ownerToPlatforms, bytes32(_owner), _platform)) {
            return _emitError(ERROR_PLATFORMS_INCONSISTENT_INTERNAL_STATE);
        }

        resultCode = _syncAssetsInPlatformBeforeDetach(_platform);
        if (resultCode != OK) {
            return _emitError(resultCode);
        }

        if (OK != ChronoBankPlatform(_platform).setupEventsHistory(_platform)) {
            _emitError(ERROR_PLATFORMS_CANNOT_UPDATE_EVENTS_HISTORY_NOT_EVENTS_ADMIN);
        }

        store.remove(ownerToPlatforms, bytes32(_owner), _platform);
        store.remove(platforms, _platform);

        _emitPlatformDetached(_platform, msg.sender);
        return OK;
    }

    /**
    * @dev Designed to keep PlatformsManager in consistent state when platform's owner might be changed.
    * New owner of a platform should call this method to update a record about platform ownership.
    * Until this operation would not be performed, then user of a platform couldn't do anything with this
    * platform.
    *
    * @param _platform platform address
    * @param _from previous owner of a platform*
    *
    * @return resultCode result code of an operation.
    */
    function replaceAssociatedPlatformFromOwner(address _platform, address _from)
    onlyPlatformOwner(_platform)
    onlyPreviousPlatformOwner(_platform, _from)
    public returns (uint resultCode) {
        store.add(ownerToPlatforms, bytes32(msg.sender), _platform);
        store.remove(ownerToPlatforms, bytes32(_from), _platform);
        return OK;
    }

    /**
    * @dev Creates a brand new platform.
    * This method might take an additional fee in TIMEs.
    *
    * @return resultCode result code of an operation
    */
    function createPlatform() public returns (uint resultCode) {
        return _createPlatform([uint(0)]);
    }

    function _createPlatform(uint[1] memory _result)
    private
    featured(_result)
    returns (uint resultCode)
    {
        PlatformsFactory factory = PlatformsFactory(store.get(platformsFactory));
        address _platform = factory.createPlatform(msg.sender, getEventsHistory(), this);
        _attachPlatformWithoutValidation(_platform, msg.sender);

        AssetsManagerInterface assetsManager = AssetsManagerInterface(lookupManager("AssetsManager"));
        resultCode = assetsManager.requestTokenExtension(_platform);
        address _tokenExtension;
        if (resultCode == OK) {
            _tokenExtension = assetsManager.getTokenExtension(_platform);
            ChronoBankAssetOwnershipManager(_platform).addPartOwner(_tokenExtension);
        }

        OwnedInterface(_platform).transferContractOwnership(msg.sender);
        _emitPlatformRequested(_platform, _tokenExtension, msg.sender);
        return OK;
    }

    /**
    * @dev Sets up internal variables during a platform attach. PRIVATE
    */
    function _attachPlatformWithoutValidation(address _platform, address _owner) private {
        store.add(ownerToPlatforms, bytes32(_owner), _platform);
        store.add(platforms, _platform);
    }

    /**
    * @dev Checks if passed platform is owned by msg.sender. PRIVATE
    */
    function _isPlatformOwner(address _platform) private constant returns (bool) {
        return OwnedContract(_platform).contractOwner() == msg.sender;
    }

    /**
    * @dev Performs synchronization during attaching platforms. PRIVATE
    */
    function _syncAssetsInPlatformBeforeAttach(address _platform) private returns (uint resultCode) {
        uint _lastSyncIdx = store.get(syncPlatformToSymbolIdx, _platform);
        if (_lastSyncIdx == PLATFORM_DETACH_SYNC_DONE) {
            _lastSyncIdx = 0;
        }

        if (_lastSyncIdx != PLATFORM_ATTACH_SYNC_DONE) {
            resultCode = _runThroughPlatform(_lastSyncIdx, _platform);
            if (resultCode != OK) {
                return resultCode;
            }

            store.set(syncPlatformToSymbolIdx, _platform, PLATFORM_ATTACH_SYNC_DONE);
        }

        return OK;
    }

    /**
    * @dev Performs synchronization during detaching platforms. PRIVATE
    */
    function _syncAssetsInPlatformBeforeDetach(address _platform) private returns (uint resultCode) {
        uint _lastSyncIdx = store.get(syncPlatformToSymbolIdx, _platform);
        if (_lastSyncIdx == PLATFORM_ATTACH_SYNC_DONE) {
            _lastSyncIdx = 0;
        }

        if (_lastSyncIdx != PLATFORM_DETACH_SYNC_DONE) {
            resultCode = _runThroughPlatform(_lastSyncIdx, _platform);
            if (resultCode != OK) {
                return resultCode;
            }

            store.set(syncPlatformToSymbolIdx, _platform, PLATFORM_DETACH_SYNC_DONE);
        }

        return OK;
    }

    /**
    * @dev Main synchronization method during attach/detach. PRIVATE
    */
    function _runThroughPlatform(uint _lastSyncIdx, address _platform) private returns (uint) {
        ChronoBankAssetOwnershipManager _chronoBankPlatform = ChronoBankAssetOwnershipManager(_platform);
        ChronoBankManagersRegistry _chronoBankRegistry = ChronoBankManagersRegistry(_platform);

        uint _symbolsCount = _chronoBankPlatform.symbolsCount();
        uint _holdersCount = _chronoBankRegistry.holdersCount();

        bool _shouldInitHolders = true;
        address[] memory _holders = new address[](_holdersCount);

        for (; _lastSyncIdx < _symbolsCount; ++_lastSyncIdx) {
            if (msg.gas < 100000) {
                store.set(syncPlatformToSymbolIdx, _platform, _lastSyncIdx);
                return ERROR_PLATFORMS_REPEAT_SYNC_IS_NOT_COMPLETED;
            }

            bytes32 _symbol = _chronoBankPlatform.symbols(_lastSyncIdx);
            for (uint _holderIdx = 0; _holderIdx < _holdersCount; ++_holderIdx) {
                if (_shouldInitHolders) {
                    _holders[_holderIdx] = _chronoBankRegistry.holders(_holderIdx);
                }
            }

            _shouldInitHolders = false;
        }

        return OK;
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

    /**
    * @dev DEPRECATED. WILL BE REMOVED IN FUTURE RELEASES
    */
    function _emitPlatformReplaced(address _fromPlatform, address _toPlatform) private {
        PlatformsManagerEmitter(getEventsHistory()).emitPlatformReplaced(_fromPlatform, _toPlatform);
    }
}
