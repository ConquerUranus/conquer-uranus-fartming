// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract ShitiumToken is ERC20("Shitium Token", "SHITIUM"), AccessControl {
    
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    using SafeMath for uint256;
    
    event Minted(
        address indexed minter,
        address indexed receiver,
        uint256 mintAmount
    );
    
    event Burned(address indexed burner, uint256 burnAmount);
    
    constructor() {
        _mint(msg.sender, 1000000000 * 10 ** decimals());
        // Define as DEFAULT_ADMIN_ROLE the creator of the contract
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    function burn(uint256 _amount) public {
        _burn(msg.sender, _amount);
        emit Burned(msg.sender, _amount);
    }
    
    function mint(address _to, uint256 _amount) public {
        require(hasRole(MINTER_ROLE, msg.sender), "Caller is not a minter");
        _mint(_to, _amount);
        emit Minted(msg.sender, _to, _amount);
    }
}