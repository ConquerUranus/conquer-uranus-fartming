// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./token/ShitiumToken.sol";

contract PoolContract is Ownable {

    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    
    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
        uint256 pendingRewards;
        uint256 lastClaim;
    }

    struct PoolInfo {
        IERC20 token;
        uint256 allocPoint;
        uint256 lastRewardBlock;
        uint256 accShitiumPerShare;
        uint256 rewardsAmount;
        uint256 lockupDuration;
        uint16 depositFee;
    }


    ShitiumToken public immutable shitiumToken;
    // Fee address
    address public feeAddress;
    uint256 public shitiumPerBlock;

    PoolInfo[] public poolInfo;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    uint256 public totalAllocPoint = 0;
    uint256 public startBlock;
    uint256 public totalLockedUpRewards;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event Claim(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(
        address indexed user,
        uint256 indexed pid,
        uint256 amount
    );
    
    constructor(
        ShitiumToken _shitiumToken,
        uint256 _shitiumPerBlock,
        uint256 _startBlock,
        address _feeAddress
    ) {
        require(address(_shitiumToken) != address(0), "Token is a zero value");
        shitiumToken = _shitiumToken;
        shitiumPerBlock = _shitiumPerBlock;
        startBlock = _startBlock;

        feeAddress = _feeAddress;
    }

    modifier onlyEOA() {
        // Makes flash-loan exploitation difficult using only externally owned addresses.
        require(msg.sender == tx.origin, "must use EOA");
        _;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    function getMultiplier(uint256 _from, uint256 _to) public pure returns (uint256) {
            return _to.sub(_from);
    }

    function add(uint256 _allocPoint, IERC20 _token, uint256 _lockupDuration, uint16 _depositFee) public onlyOwner {
        checkPoolDuplicate(_token);
        massUpdatePools();
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(
            PoolInfo({
                token: _token,
                allocPoint: _allocPoint,
                lastRewardBlock: lastRewardBlock,
                accShitiumPerShare: 0,
                rewardsAmount: 0,
                lockupDuration: _lockupDuration,
                depositFee: _depositFee
            })
        );
    }

    function setAllocPoint(uint256 _pid, uint256 _allocPoint) external onlyOwner {
        massUpdatePools();
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
    }

    function setDepositFee(uint256 _pid, uint16 _depositFee) external onlyOwner {
        massUpdatePools();
        poolInfo[_pid].depositFee = _depositFee;
    }

    function setLockupDuration(uint256 _pid, uint256 _lockupDuration) external onlyOwner {
        massUpdatePools();
        poolInfo[_pid].lockupDuration = _lockupDuration;
    }

    function pendingShitium(uint256 _pid, address _user) external view returns (uint256) {
        require(poolInfo[_pid].lastRewardBlock > 0 && block.number >= poolInfo[_pid].lastRewardBlock, 'Staking not yet started');
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accShitiumPerShare = pool.accShitiumPerShare;
        uint256 depositedAmount = pool.token.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && depositedAmount != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock,block.number);
            uint256 shitiumReward = multiplier.mul(shitiumPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
            accShitiumPerShare = accShitiumPerShare.add(shitiumReward.mul(1e12).div(depositedAmount));
        }
        return  user.amount.mul(accShitiumPerShare).div(1e12).sub(user.rewardDebt).add(user.pendingRewards);
    }

    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    function updatePool(uint256 _pid) public {
        require(poolInfo[_pid].lastRewardBlock > 0 && block.number >= poolInfo[_pid].lastRewardBlock, 'Staking not yet started');
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 depositedAmount = pool.token.balanceOf(address(this));
        if (depositedAmount == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 shitiumReward = multiplier.mul(shitiumPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
        shitiumToken.mint(address(this), shitiumReward);
        pool.accShitiumPerShare = pool.accShitiumPerShare.add(shitiumReward.mul(1e12).div(depositedAmount));
        pool.lastRewardBlock = block.number;
    }

    function deposit(uint256 _pid, uint256 _amount, bool _withdrawRewards) public onlyEOA {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if(user.lastClaim == 0){
            user.lastClaim = block.timestamp;
        }
        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accShitiumPerShare).div(1e12).sub(user.rewardDebt);

            if (pending > 0) {
                user.pendingRewards = user.pendingRewards.add(pending);

                if (_withdrawRewards && (block.timestamp > (user.lastClaim + pool.lockupDuration))) {
                    safeTokenTransfer(msg.sender, user.pendingRewards);
                    emit Claim(msg.sender, _pid, user.pendingRewards);
                    user.pendingRewards = 0;
                }
            }
        }
        if (_amount > 0) {
            pool.token.safeTransferFrom(address(msg.sender), address(this), _amount);
            if (pool.depositFee > 0) {
                uint256 depositFee = _amount.mul(pool.depositFee).div(10000);
                pool.token.safeTransfer(feeAddress, depositFee);
                _amount = _amount.sub(depositFee);
            }
            user.amount = user.amount.add(_amount);
        }
        user.rewardDebt = user.amount.mul(pool.accShitiumPerShare).div(1e12);
        emit Deposit(msg.sender, _pid, _amount);
    }

    function withdraw(uint256 _pid, uint256 _amount, bool _withdrawRewards) public onlyEOA {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");
        updatePool(_pid);
        uint256 pending = user.amount.mul(pool.accShitiumPerShare).div(1e12).sub(user.rewardDebt);
        if (pending > 0) {
            user.pendingRewards = user.pendingRewards.add(pending);

            if (_withdrawRewards && (block.timestamp > (user.lastClaim + pool.lockupDuration))) {
                safeTokenTransfer(msg.sender, user.pendingRewards);
                emit Claim(msg.sender, _pid, user.pendingRewards);
                user.pendingRewards = 0;
            }
        }
        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.token.safeTransfer(address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount.mul(pool.accShitiumPerShare).div(1e12);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        pool.token.safeTransfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, _pid, user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
        user.pendingRewards = 0;
    }

    function claim(uint256 _pid) public onlyEOA {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(block.timestamp > user.lastClaim + pool.lockupDuration, "You cannot claim yet!");
        updatePool(_pid);
        uint256 pending = user.amount.mul(pool.accShitiumPerShare).div(1e12).sub(user.rewardDebt);
        if (pending > 0 || user.pendingRewards > 0) {
            user.pendingRewards = user.pendingRewards.add(pending);
            safeTokenTransfer(msg.sender, user.pendingRewards);
            emit Claim(msg.sender, _pid, user.pendingRewards);
            user.pendingRewards = 0;
            user.lastClaim = block.timestamp;
        }
        user.rewardDebt = user.amount.mul(pool.accShitiumPerShare).div(1e12);
    }

    function safeTokenTransfer(address _to, uint256 _amount) internal {
        uint256 tokenBal = shitiumToken.balanceOf(address(this));
        if (_amount > tokenBal) {
            IERC20(shitiumToken).safeTransfer(_to, tokenBal);
        } else {
            IERC20(shitiumToken).safeTransfer(_to, _amount);
        }
    }

    function checkPoolDuplicate(IERC20 _token) public view {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            require(poolInfo[pid].token != _token, "add: existing pool?");
        }
    }

    function setShitiumPerBlock(uint256 _shitiumPerBlock) external onlyOwner {
        require(_shitiumPerBlock > 0,"Token per block must be greather than zero");
        massUpdatePools();
        shitiumPerBlock = _shitiumPerBlock;
    }

    function setFeeAddress(address _feeAddress) external onlyOwner {
        require(_feeAddress != address(0), "setFeeAddress: ZERO");
        feeAddress = _feeAddress;
    }

}
