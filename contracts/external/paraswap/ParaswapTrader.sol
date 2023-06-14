// SPDX-License-Identifier: GPL-3.0-or-later

/*

    Copyright 2023 Dolomite.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

pragma solidity ^0.8.9;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteMarginExchangeWrapper } from "../../protocol/interfaces/IDolomiteMarginExchangeWrapper.sol";

import { Require } from "../../protocol/lib/Require.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";

import "hardhat/console.sol";

/**
 * @title ParaswapTrader
 * @author Dolomite
 *
 * Contract for performing an external trade with Paraswap.
 */
contract ParaswapTrader is OnlyDolomiteMargin, IDolomiteMarginExchangeWrapper {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "ParaswapTrader";
    uint256 private constant _ACTIONS_LENGTH = 1;

    // ============ Storage ============

    address public immutable PARASWAP_AUGUSTUS_ROUTER;
    address public immutable PARASWAP_TRANSFER_PROXY;

    // ============ Constructor ============

    constructor(
        address _paraswapAugustusRouter,
        address _paraswapTransferProxy,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        PARASWAP_AUGUSTUS_ROUTER = _paraswapAugustusRouter;
        PARASWAP_TRANSFER_PROXY = _paraswapTransferProxy;
    }

    function createActionsForExchange(
        uint256 _solidAccountId,
        uint256 _outputMarket,
        uint256 _mintAmountOut,
        uint256 _inputMarket,
        uint256 _inputAmount,
        bytes memory _orderData
    ) public view returns (IDolomiteMargin.ActionArgs[] memory) {
        IDolomiteMargin.ActionArgs[]
            memory actions = new IDolomiteMargin.ActionArgs[](_ACTIONS_LENGTH);

        actions[0] = AccountActionLib.encodeExternalSellAction(
            _solidAccountId,
            _inputMarket,
            _outputMarket,
            /* _trader = */ address(this),
            /* _amountInWei = */ _inputAmount,
            /* _amountOutMinWei = */ _mintAmountOut,
            _orderData
        );

        return actions;
    }

    // ============ Public Functions ============
    function exchange(
        address /*_tradeOriginator*/,
        address _receiver,
        address _outputToken,
        address _inputToken,
        uint256 _inputAmount,
        bytes calldata _orderData
    ) external override onlyDolomiteMargin(msg.sender) returns (uint256) {
        Require.that(_inputAmount > 0, _FILE, "Invalid input amount");

        IERC20(_inputToken).safeApprove(PARASWAP_TRANSFER_PROXY, 0);
        IERC20(_inputToken).safeApprove(PARASWAP_TRANSFER_PROXY, _inputAmount);

        (uint256 minAmountOutWei, bytes memory paraswapCallData) = abi.decode(
            _orderData,
            (uint256, bytes)
        );

        uint256 _beforeAmount = IERC20(_outputToken).balanceOf(address(this));

        _callAndCheckSuccess(paraswapCallData);

        uint256 amount = IERC20(_outputToken).balanceOf(address(this)) -
            _beforeAmount;

        Require.that(
            amount >= minAmountOutWei,
            _FILE,
            "insufficient output amount",
            amount,
            minAmountOutWei
        );

        IERC20(_outputToken).safeApprove(_receiver, 0);
        IERC20(_outputToken).safeApprove(_receiver, amount);

        return amount;
    }

    ///@dev We can call the getRate api in the frontend/backend to get the exchangeCost
    function getExchangeCost(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (uint256) {
        revert(
            string(
                abi.encodePacked(
                    Require.stringifyTruncated(_FILE),
                    "::getExchangeCost: not implemented"
                )
            )
        );
    }

    function actionsLength() public pure returns (uint256) {
        return _ACTIONS_LENGTH;
    }

    // ============ Private Functions ============

    function _callAndCheckSuccess(bytes memory _paraswapCallData) internal {
        // solium-disable-next-line security/no-low-level-calls
        (bool success, bytes memory result) = PARASWAP_AUGUSTUS_ROUTER.call(
            _paraswapCallData
        );
        if (!success) {
            if (result.length < 68) {
                revert(
                    string(
                        abi.encodePacked(
                            Require.stringifyTruncated(_FILE),
                            ": revert"
                        )
                    )
                );
            } else {
                // solium-disable-next-line security/no-inline-assembly
                assembly {
                    result := add(result, 0x04)
                }
                revert(
                    string(
                        abi.encodePacked(
                            Require.stringifyTruncated(_FILE),
                            ": ",
                            abi.decode(result, (string))
                        )
                    )
                );
            }
        }
    }
}
