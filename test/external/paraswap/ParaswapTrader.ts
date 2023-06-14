import { expect } from "chai";
import { BigNumber, ethers } from "ethers";
import { ParaswapTrader, ParaswapTrader__factory, IERC20, IWETH, IERC20__factory } from "../../../src/types";
import { Account } from "../../../src/types/IDolomiteMargin";
import { createContractWithAbi, depositIntoDolomiteMargin } from "../../../src/utils/dolomite-utils";
import { BYTES_EMPTY, Network, ZERO_BI } from "../../../src/utils/no-deps-constants";
import { impersonate, revertToSnapshotAndCapture, snapshot } from "../../utils";
import { expectThrow } from "../../utils/assertions";
import { CoreProtocol, setupCoreProtocol, setupUSDCBalance } from "../../utils/setup";

import { getCalldataForParaswap } from "../../utils/liquidation-utils";

const defaultAccountNumber = "0";

function expandDecimals(n: Number | String, decimals = 18) {
  return ethers.utils.parseUnits(n.toString(), decimals);
}

const abiCoder = ethers.utils.defaultAbiCoder;
const usdcAmount = expandDecimals(1000, 6);
const usableUsdcAmount = usdcAmount.div(2);

describe("ParaswapTrader", () => {
  let snapshotId: string;

  let usdc: IERC20;
  let weth: IWETH;
  let core: CoreProtocol;
  let trader: ParaswapTrader;
  let defaultAccount: Account.InfoStruct;

  const PARASWAP_AUGUSTUS_ROUTER = "0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57";
  const PARASWAP_TRANSFER_PROXY = "0x216B4B4Ba9F3e719726886d34a177484278Bfcae";

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 100940047,
      network: Network.ArbitrumOne,
    });

    usdc = core.usdc;
    weth = core.weth;

    trader = await createContractWithAbi<ParaswapTrader>(
      ParaswapTrader__factory.abi,
      ParaswapTrader__factory.bytecode,
      [PARASWAP_AUGUSTUS_ROUTER, PARASWAP_TRANSFER_PROXY, core.dolomiteMargin.address]
    );

    defaultAccount = {
      owner: core.hhUser1.address,
      number: defaultAccountNumber,
    };

    await core.dolomiteMargin.ownerSetInterestSetter(core.marketIds.usdc, core.alwaysZeroInterestSetter.address);

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccount.number, core.marketIds.usdc, usableUsdcAmount);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe("Exchange for non-liquidation sale", () => {
    it("should work when called with the normal conditions", async () => {
      const solidAccountId = 0;
      const minOutAmount = BigNumber.from("200000000000000000");

      const { calldata: paraswapCallData } = await getCalldataForParaswap(
        usableUsdcAmount,
        core.usdc,
        6,
        minOutAmount,
        core.weth,
        18,
        core.hhUser1,
        trader,
        core
      );

      const actions = await trader.createActionsForExchange(
        solidAccountId,
        core.marketIds.weth,
        minOutAmount,
        core.marketIds.usdc,
        usableUsdcAmount,
        paraswapCallData
      );

      const _balanceBefore = await core.weth.balanceOf(core.dolomiteMargin.address);

      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await core.dolomiteMargin.connect(core.hhUser5).operate([defaultAccount], actions);

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.weth);
      expect(underlyingBalanceWei.value).to.gt(minOutAmount);
      expect(underlyingBalanceWei.sign).to.eq(true);

      const _balanceAfter = await core.weth.balanceOf(core.dolomiteMargin.address);
      expect(_balanceAfter.sub(_balanceBefore)).to.be.gt(minOutAmount);
    });
  });

  describe("#exchange", () => {
    it("should fail if not called by DolomiteMargin", async () => {
      await expectThrow(
        trader
          .connect(core.hhUser1)
          .exchange(
            core.hhUser1.address,
            core.dolomiteMargin.address,
            core.weth.address,
            core.usdc.address,
            usableUsdcAmount,
            BYTES_EMPTY
          ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it("should fail if input amount is 0", async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        trader
          .connect(dolomiteMarginImpersonator)
          .exchange(
            core.hhUser1.address,
            core.dolomiteMargin.address,
            core.weth.address,
            core.usdc.address,
            ZERO_BI,
            BYTES_EMPTY
          ),
        "ParaswapTrader: Invalid input amount"
      );
    });
  });

  describe("#PARASWAP_AUGUSTUS_ROUTER", () => {
    it("should work", async () => {
      expect(await trader.PARASWAP_AUGUSTUS_ROUTER()).to.eq(PARASWAP_AUGUSTUS_ROUTER);
    });
  });

  describe("#PARASWAP_TRANSFER_PROXY", () => {
    it("should work", async () => {
      expect(await trader.PARASWAP_TRANSFER_PROXY()).to.eq(PARASWAP_TRANSFER_PROXY);
    });
  });

  describe("#actionsLength", () => {
    it("should work", async () => {
      expect(await trader.actionsLength()).to.eq(1);
    });
  });
});
