pragma solidity ^0.4.11;

import "./TokenExtensionRouter.sol";
import "./PlatformTokenExtensionGatewayManagerEmitter.sol";
import "./../TokenManagementInterface.sol";
import "../../core/contracts/ContractsManagerInterface.sol";
import "../../core/platform/ChronoBankPlatformInterface.sol";
import "../../core/platform/ChronoBankAssetOwnershipManager.sol";
import "../../core/platform/ChronoBankAssetProxyInterface.sol";
import "../../core/common/OwnedInterface.sol";
import "../../core/contracts/ContractsManagerInterface.sol";
import "../../core/erc20/ERC20ManagerInterface.sol";
import "../../core/erc20/ERC20Interface.sol";
import "../../core/event/MultiEventsHistory.sol";
import "./../AssetsManagerInterface.sol";
import "./../FeeInterface.sol";
import "../../timeholder/FeatureFeeAdapter.sol";
import "../../core/lib/StringsLib.sol";

contract ChronoBankAsset {
    function init(ChronoBankAssetProxyInterface _proxy) returns (bool);
}


contract TokenFactory {
    function createAsset() returns (address);
    function createAssetWithFee(address owner) returns (address);
    function createProxy() returns (address);
}


contract PlatformFactory {
    function createPlatform(address _eventsHistory, address _owner) returns (address);
}


contract FactoryProvider {
    function getTokenFactory() returns (TokenFactory);
}


contract CrowdsaleManager {
    function createCrowdsale(address _creator, bytes32 _symbol, bytes32 _factoryName) returns (address, uint);
    function deleteCrowdsale(address crowdsale) returns (uint);
}


contract BaseCrowdsale {
    function getSymbol() constant returns (bytes32);
}


contract OwnedContract {
    address public contractOwner;
}

/**
* @title Used as a library by TokenExtensionRouter which provides context and variables (platform, contractsManager)
* when invoke methods of this contract.
* Since this contract is designed to be used by delegatecall it doesn't inherit from any contract (except FeatureFeeAdapter)
* and you should be careful when a need will arise to add more functionality by inheritance, because the contract uses
* storage scheme from TokenExtensionRouter and it should be preserved.

* It's responsibilities are to:
* - create assets (with and without fee),
* - create token crowdsale and remove them.

* Some methods might take a fee by TIME tokens.
*/
contract PlatformTokenExtensionGatewayManager is FeatureFeeAdapter {
    uint constant UNAUTHORIZED = 0;
    uint constant OK = 1;
    uint constant REINITIALIZED = 6;
    uint constant ERROR_TOKEN_EXTENSION_ASSET_TOKEN_EXISTS = 23001;
    uint constant ERROR_TOKEN_EXTENSION_ASSET_COULD_NOT_BE_REISSUED = 23002;
    uint constant ERROR_TOKEN_EXTENSION_ASSET_COULD_NOT_BE_REVOKED = 23003;
    uint constant ERROR_TOKEN_EXTENSION_ASSET_OWNER_ONLY = 23004;

    /** @dev platform address. It is initialized only by delegatecall context */
    address internal contractsManager;

    /** @dev platform address. It is initialized only by delegatecall context and 0x0 in other cases */
    address internal platform;

    /**
     * Contract owner address
     */
    address public contractOwner;

    /**
     * Contract owner address
     */
    address public pendingContractOwner;

    function PlatformTokenExtensionGatewayManager() {
        contractOwner = msg.sender;
    }

    /**
    * @dev Owner check modifier
    */
    modifier onlyContractOwner {
        if (contractOwner == msg.sender) {
            _;
        }
    }

    /**
    * @dev Guards methods to be called only by platform owner.
    */
    modifier onlyPlatformOwner {
        if (OwnedContract(platform).contractOwner() == msg.sender ||
            msg.sender == address(this)) {
            _;
        }
    }

    /**
    * @dev Guards methods to be called only by platform itself.
    *
    * DEPRECATED. WILL BE REMOVED IN NEXT RELEASES
    */
    modifier onlyPlatform {
        if (msg.sender == platform ||
            msg.sender == address(this)) {
            _;
        }
    }

    /**
    *  @dev Designed to be used by ancestors, inits internal fields.
    *  Will rollback transaction if something goes wrong during initialization.
    *  Registers contract as a service in ContractManager with given `_type`.
    *
    *  @param _contractsManager is contract manager, must be not 0x0
    *  @return OK if newly initialized and everything is OK,
    *  or REINITIALIZED if storage already contains some data. Will crash in any other cases.
    */
    function init(address _contractsManager) onlyContractOwner public returns (uint resultCode) {
        require(_contractsManager != 0x0);

        bool reinitialized = (contractsManager != 0x0);
        if (contractsManager == 0x0 || contractsManager != _contractsManager) {
            contractsManager = _contractsManager;
        }

        assert(OK == ContractsManagerInterface(contractsManager).addContract(this, "TokenExtensionGateway"));

        return !reinitialized ? OK : REINITIALIZED;
    }

    function getEventsHistory() public constant returns (address) {
        return lookupManager("MultiEventsHistory");
    }

    /**
     * @dev Destroy contract and scrub a data
     * @notice Only owner can call it
     */
    function destroy() onlyContractOwner public {
        ContractsManagerInterface(contractsManager).removeContract(this);
        selfdestruct(msg.sender);
    }

    /**
     * Prepares ownership pass.
     *
     * Can only be called by current owner.
     *
     * @param _to address of the next owner. 0x0 is not allowed.
     *
     * @return success.
     */
    function changeContractOwnership(address _to) onlyContractOwner public returns (bool) {
        if (_to == 0x0) {
            return false;
        }

        pendingContractOwner = _to;
        return true;
    }

    /**
     * Finalize ownership pass.
     *
     * Can only be called by pending owner.
     *
     * @return success.
     */
    function claimContractOwnership() public returns (bool) {
        if (pendingContractOwner != msg.sender) {
            return false;
        }

        contractOwner = pendingContractOwner;
        delete pendingContractOwner;

        return true;
    }

    /**
    * @dev Direct ownership pass without change/claim pattern. Can be invoked only by current contract owner
    *
    * @param _to the next contract owner
    *
    * @return `true` if success, `false` otherwise
    */
    function transferContractOwnership(address _to) onlyContractOwner public returns (bool) {
        if (_to == 0x0) {
            return false;
        }

        if (pendingContractOwner != 0x0) {
            pendingContractOwner = 0x0;
        }

        contractOwner = _to;
        return true;
    }

    /**
    * @dev Creates asset without fee. Performs asset registration in ERC20Manager.
    * Allowed to be performed only from delegatecall and only by platform owner.
    * Might take an additional fee in TIME tokens
    *
    * @param _symbol new asset's symbol
    * @param _name asset's name
    * @param _description description of an asset
    * @param _value initial balance to issue
    * @param _decimals decimals
    * @param _isMint is reissuable
    * @param _tokenImageIpfsHash asset image IPFS hash
    *
    * @return resultCode result code of an operation
    */
    function createAssetWithoutFee(
        bytes32 _symbol,
        string _name,
        string _description,
        uint _value,
        uint8 _decimals,
        bool _isMint,
        bytes32 _tokenImageIpfsHash)
    onlyPlatformOwner
    public
    returns (uint resultCode)
    {
        return _createAssetWithoutFee(_symbol, _name, _description, _value, _decimals, _isMint, _tokenImageIpfsHash, [uint(0)]);
    }

    function _createAssetWithoutFee(
        bytes32 _symbol,
        string _name,
        string _description,
        uint _value,
        uint8 _decimals,
        bool _isMint,
        bytes32 _tokenImageIpfsHash,
        uint[1] memory _result)
    featured(_result)
    private
    returns (uint resultCode)
    {
        resultCode = _prepareAndIssueAssetOnPlatform(_symbol, _name, _description, _value, _decimals, _isMint);
        if (resultCode != OK) {
            return _emitError(resultCode);
        }

        address _asset = _createAsset(getTokenFactory());

        require(MultiEventsHistory(ChronoBankPlatformInterface(platform).eventsHistory()).authorize(_asset));

        address _token = _bindAssetWithToken(getTokenFactory(), _asset, _symbol, _name, _decimals, _tokenImageIpfsHash);

        _emitAssetCreated(platform, _symbol, _token, msg.sender);

        _result[0] = OK;
        return OK;
    }


    /**
    * @dev Creates asset with fee. Performs asset registration in ERC20Manager.
    * Allowed to be performed only from delegatecall and only by platform owner.
    * Might take an additional fee in TIME tokens
    *
    * @param _symbol new asset's symbol
    * @param _name asset's name
    * @param _description description of an asset
    * @param _value initial balance to issue
    * @param _decimals decimals
    * @param _isMint is reissuable
    * @param _feeAddress fee wallet address
    * @param _feePercent fee percent value
    * @param _tokenImageIpfsHash asset image IPFS hash
    *
    * @return resultCode result code of an operation
    */
    function createAssetWithFee(
        bytes32 _symbol,
        string _name,
        string _description,
        uint _value,
        uint8 _decimals,
        bool _isMint,
        address _feeAddress,
        uint32 _feePercent,
        bytes32 _tokenImageIpfsHash)
    onlyPlatformOwner
    public
    returns (uint resultCode) {
        return _createAssetWithFee(_symbol, _name, _description, _value, _decimals, _isMint, _feeAddress, _feePercent, _tokenImageIpfsHash, [uint(0)]);
    }

    function _createAssetWithFee(
        bytes32 _symbol,
        string _name,
        string _description,
        uint _value,
        uint8 _decimals,
        bool _isMint,
        address _feeAddress,
        uint32 _feePercent,
        bytes32 _tokenImageIpfsHash,
        uint[1] memory _result)
    featured(_result)
    private
    returns (uint resultCode)
    {
        require(_feeAddress != 0x0);

        resultCode = _prepareAndIssueAssetOnPlatform(_symbol, _name, _description, _value, _decimals, _isMint);
        if (resultCode != OK) {
            return _emitError(resultCode);
        }

        address _token = _bindAssetWithToken(getTokenFactory(), _deployAssetWithFee(getTokenFactory(), _feeAddress, _feePercent), _symbol, _name, _decimals, _tokenImageIpfsHash);

        require(MultiEventsHistory(ChronoBankPlatformInterface(platform).eventsHistory()).authorize(_token));

        _emitAssetCreated(platform, _symbol, _token, msg.sender);

        _result[0] = OK;
        return OK;
    }


    /**
    * @dev Gets token and proxy factory
    *
    * @return factory address
    */
    function getTokenFactory() constant returns (TokenFactory) {
        return FactoryProvider(lookupManager("AssetsManager")).getTokenFactory();
    }

    /**
    * @dev Creates crowdsale campaign of a token with provided symbol
    * Might take an additional fee in TIME tokens
    *
    * @param _symbol a token symbol
    *
    * @return result code of an operation
    */
    function createCrowdsaleCampaign(bytes32 _symbol, bytes32 _crowdsaleFactoryName)
    onlyPlatformOwner
    public
    returns (uint)
    {
        return _createCrowdsaleCampaign(_symbol, _crowdsaleFactoryName, [uint(0)]);
    }

    function _createCrowdsaleCampaign(
        bytes32 _symbol,
        bytes32 _crowdsaleFactoryName,
        uint[1] memory _result)
    featured(_result)
    private
    returns (uint)
    {
        require(_symbol != 0x0);
        require(_crowdsaleFactoryName != 0x0);

        ChronoBankAssetOwnershipManager _assetOwnershipManager = ChronoBankAssetOwnershipManager(getAssetOwnershipManager());
        CrowdsaleManager crowdsaleManager = CrowdsaleManager(lookupManager("CrowdsaleManager"));

        var (_crowdsale, result) = crowdsaleManager.createCrowdsale(msg.sender, _symbol, _crowdsaleFactoryName);
        if (result != OK) {
            return _emitError(result);
        }

        if( OK != _assetOwnershipManager.addAssetPartOwner(_symbol, _crowdsale)) revert();

        _emitCrowdsaleCampaignCreated(platform, _symbol, _crowdsale, msg.sender);

        _result[0] = OK;
        return OK;
    }

    /**
    * @dev Stops token's crowdsale
    *
    * @param _crowdsale a crowdsale address
    *
    * @return result result code of an operation
    */
    function deleteCrowdsaleCampaign(address _crowdsale) onlyPlatformOwner public returns (uint result) {
        bytes32 _symbol = BaseCrowdsale(_crowdsale).getSymbol();
        ChronoBankAssetOwnershipManager _assetOwnershipManager = ChronoBankAssetOwnershipManager(getAssetOwnershipManager());

        CrowdsaleManager crowdsaleManager = CrowdsaleManager(lookupManager("CrowdsaleManager"));

        result = crowdsaleManager.deleteCrowdsale(_crowdsale);
        if (result != OK) {
            return _emitError(result);
        }

        if(OK != _assetOwnershipManager.removeAssetPartOwner(_symbol, _crowdsale)) revert();

        _emitCrowdsaleCampaignRemoved(platform, _symbol, _crowdsale, msg.sender);
        return OK;
    }

    /**
    * @dev Gets an interface for managing assets' ownership
    *
    * @return interface of assets ownership manager
    */
    function getAssetOwnershipManager() public constant returns (address) {
        return platform;
    }

    /**
    * @dev Gets a proxy where possible to reissue assets
    *
    * @return interface for reissuing assets
    */
    function getReissueAssetProxy() public constant returns (ReissuableAssetProxyInterface) {
        return ReissuableAssetProxyInterface(platform);
    }

    /**
    * @dev Gets a proxy where possible to revoke assets
    *
    * @return interface for revoking assets
    */
    function getRevokeAssetProxy() public constant returns (RevokableAssetProxyInterface) {
        return RevokableAssetProxyInterface(platform);
    }

    /**
    * @dev Checks symbol for existance in the system and issue new asset. PRIVATE
    */
    function _prepareAndIssueAssetOnPlatform(bytes32 _symbol, string _name, string _description, uint _value, uint8 _decimals, bool _isMint) private returns (uint) {
        ERC20ManagerInterface _erc20Manager = ERC20ManagerInterface(lookupManager("ERC20Manager"));
        if (_erc20Manager.getTokenAddressBySymbol(_symbol) != 0x0) {
            return ERROR_TOKEN_EXTENSION_ASSET_TOKEN_EXISTS;
        }

        return ChronoBankPlatformInterface(platform).issueAsset(_symbol, _value, _name, _description, _decimals, _isMint, msg.sender);
    }

    /**
    * @dev Binds asset with proxy and register it in ERC20Manager. PRIVATE
    */
    function _bindAssetWithToken(TokenFactory _factory, address _asset, bytes32 _symbol, string _name, uint8 _decimals, bytes32 _ipfsHash) private returns (address token) {
        token = _factory.createProxy();

        if (OK != ChronoBankPlatformInterface(platform).setProxy(token, _symbol)) revert();

        ChronoBankAssetOwnershipManager _assetOwnershipManager = ChronoBankAssetOwnershipManager(getAssetOwnershipManager());
        ChronoBankAssetProxyInterface(token).init(platform, StringsLib.bytes32ToString(_symbol), _name);
        ChronoBankAssetProxyInterface(token).proposeUpgrade(_asset);
        ChronoBankAsset(_asset).init(ChronoBankAssetProxyInterface(token));
        if (OK != _assetOwnershipManager.addAssetPartOwner(_symbol, this)) revert();
        _assetOwnershipManager.changeOwnership(_symbol, msg.sender);

        if(OK != _addToken(token, _symbol, _decimals, _ipfsHash)) revert();
    }

    /**
    * @dev Creates asset with fee and setup according values. PRIVATE
    *
    * @param _factory token factory
    * @param _feeAddress fee destination address
    * @param _fee fee percent value
    */
    function _deployAssetWithFee(TokenFactory _factory, address _feeAddress, uint32 _fee) private returns (address _asset) {
        _asset = _factory.createAssetWithFee(this);
        FeeInterface(_asset).setupFee(_feeAddress, _fee);
        OwnedInterface(_asset).transferContractOwnership(msg.sender);
    }

    /**
    * @dev Creates asset without fee. PRIVATE
    *
    * @param _factory token factory
    *
    * @return _asset created asset address
    */
    function _createAsset(TokenFactory _factory) private returns (address _asset) {
        _asset = _factory.createAsset();
    }

    /**
    * Adds token to ERC20Manager contract
    * @dev Make as a separate function because of stack size limits
    *
    * @param token token's address
    * @param symbol asset's symbol
    * @param decimals number of digits after floating point
    *
    * @return errorCode result code of an operation
    */
    function _addToken(address token, bytes32 symbol, uint8 decimals, bytes32 _ipfsHash) private returns (uint errorCode) {
        ERC20ManagerInterface erc20Manager = ERC20ManagerInterface(lookupManager("ERC20Manager"));
        errorCode = erc20Manager.addToken(token, bytes32(0), symbol, bytes32(0), decimals, _ipfsHash, bytes32(0));
    }

    /**
    * @dev Makes search in contractsManager for registered contract by some identifier
    *
    * @param _identifier string identifier of a manager
    *
    * @return manager address of a manager, 0x0 if nothing was found
    */
    function lookupManager(bytes32 _identifier) constant returns (address manager) {
        manager = ContractsManagerInterface(contractsManager).getContractAddressByType(_identifier);
        assert(manager != 0x0);
    }


    /**
    * Events emitting
    */

    function _emitError(uint _errorCode) internal returns (uint) {
        PlatformTokenExtensionGatewayManagerEmitter(getEventsHistory()).emitError(_errorCode);
        return _errorCode;
    }

    function _emitAssetCreated(address _platform, bytes32 _symbol, address _token, address _by) private {
        PlatformTokenExtensionGatewayManagerEmitter(getEventsHistory()).emitAssetCreated(_platform, _symbol, _token, _by);
    }

    function _emitCrowdsaleCampaignCreated(address _platform, bytes32 _symbol, address _campaign, address _by) private {
        PlatformTokenExtensionGatewayManagerEmitter(getEventsHistory()).emitCrowdsaleCampaignCreated(_platform, _symbol, _campaign, _by);
    }

    function _emitCrowdsaleCampaignRemoved(address _platform, bytes32 _symbol, address _campaign, address _by) private {
        PlatformTokenExtensionGatewayManagerEmitter(getEventsHistory()).emitCrowdsaleCampaignRemoved(_platform, _symbol, _campaign, _by);
    }

    function () public {
        revert();
    }
}
