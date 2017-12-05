pragma solidity ^0.4.11;

import "./FeatureFeeManager.sol";

contract FeatureFeeAdapter {
    uint constant OK = 1;
    uint constant FEATURE_IS_UNAVAILABE = 22000;

    modifier featured(uint[1] memory _result) {
        if (!lookupFeatureFeeManager().isExecutionAllowed(msg.sender, address(this), msg.sig)) {
            assembly {
                mstore(0, 22000) //FEATURE_IS_UNAVAILABE
                return(0, 32)
            }
        }

        _;

        if (_result[0] == OK
                && lookupFeatureFeeManager().takeExecutionFee(msg.sender, address(this), msg.sig) != OK) {
            revert();
        }
    }

    /**
    *  Abstract function
    */
    function lookupManager(bytes32 _identifier) constant returns (address manager);

    function lookupFeatureFeeManager() private returns (FeatureFeeManager) {
        return FeatureFeeManager(lookupManager("FeatureFeeManager"));
    }
}
