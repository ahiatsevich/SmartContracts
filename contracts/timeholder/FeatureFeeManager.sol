pragma solidity ^0.4.11;

import {ContractsManager as ContractsRegistry} from "../core/contracts/ContractsManager.sol";
import "../core/common/BaseManager.sol";
import "./TimeHolderInterface.sol";

contract FeatureFeeManager is BaseManager {
    StorageInterface.Bytes32UIntMapping requiredBalances;
    StorageInterface.Bytes32UIntMapping prices;

    modifier checkExecutor(address executor) {
        if (executor == tx.origin) {
            _;
        }
    }

    function FeatureFeeManager(Storage _store, bytes32 _crate) BaseManager(_store, _crate) {
        prices.init("prices");
        requiredBalances.init("requiredBalances");
    }

    function init(address _contractsManager) onlyContractOwner returns (uint) {
        BaseManager.init(_contractsManager, "FeatureFeeManager");
        return OK;
    }

    function setFeatureFee(address code, bytes4 sig, uint requiredBalance, uint price) onlyContractOwner {
        require(code != 0x0);
        require(sig != 0x0);
        require(requiredBalance >= price);

        store.set(requiredBalances, sha3(code, sig), requiredBalance);
        store.set(prices, sha3(code, sig), price);
    }

    function requiredBalanceFor(address code, bytes4 sig) constant returns (uint) {
        return store.get(requiredBalances, sha3(code, sig));
    }

    function priceOf(address code, bytes4 sig) constant returns (uint) {
        return store.get(prices, sha3(code, sig));
    }

    function isExecutionAllowed(address executor, address code, bytes4 featureSig) returns (bool) {
        require(executor != 0x0);
        require(code != 0x0);
        require(featureSig != 0x0);

        uint requiredBalance = requiredBalanceFor(code, featureSig);

        if (requiredBalance == 0) {
            return true;
        }

        TimeHolderInterface timeHolder = TimeHolderInterface(lookupManager("TimeHolder"));
        uint balance = timeHolder.depositBalance(executor);

        return balance >= requiredBalance;
    }

    function takeExecutionFee(address executor, address code, bytes4 featureSig) checkExecutor(executor) returns (uint) {
        require(executor != 0x0);
        require(code != 0x0);
        require(featureSig != 0x0);

        uint price = priceOf(code, featureSig);

        if (price == 0) {
            return OK;
        }

        TimeHolderInterface timeHolder = TimeHolderInterface(lookupManager("TimeHolder"));
        return timeHolder.takeFeatureFee(executor, price);
    }
}
