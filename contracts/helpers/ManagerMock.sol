pragma solidity ^0.4.11;

contract ManagerMock {
    bool denied;

    function deny() public {
        denied = true;
    }

    function isAllowed(address, bytes32) public returns (bool) {
        if (denied) {
            denied = false;
            return false;
        }
        return true;
    }

    function hasAccess(address) public pure returns(bool) {
        return true;
    }
}
