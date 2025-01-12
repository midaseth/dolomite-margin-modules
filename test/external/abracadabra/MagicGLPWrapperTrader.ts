import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, ethers } from 'ethers';
import {
  IERC4626,
  MagicGLPPriceOracle,
  MagicGLPPriceOracle__factory,
  MagicGLPWrapperTrader,
  MagicGLPWrapperTrader__factory,
} from '../../../src/types';
import { Account } from '../../../src/types/IDolomiteMargin';
import { createContractWithAbi, depositIntoDolomiteMargin } from '../../../src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import { CoreProtocol, setupCoreProtocol, setupTestMarket, setupUSDCBalance } from '../../utils/setup';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const usdcAmount = amountWei.div(1e12).mul(5);
const usableUsdcAmount = usdcAmount.div(2);

const abiCoder = ethers.utils.defaultAbiCoder;

describe('MagicGLPWrapperTrader', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let magicGlp: IERC4626;
  let marketId: BigNumber;
  let wrapper: MagicGLPWrapperTrader;
  let magicGlpPriceOracle: MagicGLPPriceOracle;
  let defaultAccount: Account.InfoStruct;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 81874000,
      network: Network.ArbitrumOne,
    });
    magicGlp = core.abraEcosystem!.magicGlp;
    magicGlpPriceOracle = await createContractWithAbi<MagicGLPPriceOracle>(
      MagicGLPPriceOracle__factory.abi,
      MagicGLPPriceOracle__factory.bytecode,
      [core.dolomiteMargin.address, core.abraEcosystem!.magicGlp.address, core.marketIds.dfsGlp!],
    );

    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, magicGlp, true, magicGlpPriceOracle);

    wrapper = await createContractWithAbi<MagicGLPWrapperTrader>(
      MagicGLPWrapperTrader__factory.abi,
      MagicGLPWrapperTrader__factory.bytecode,
      [
        magicGlp.address,
        core.gmxRegistry!.address,
        core.dolomiteMargin.address,
      ],
    );

    defaultAccount = { owner: core.hhUser1.address, number: defaultAccountNumber };

    // setting the interest rate to 0 makes calculations more consistent
    await core.dolomiteMargin.ownerSetInterestSetter(core.marketIds.usdc, core.alwaysZeroInterestSetter.address);

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
    await core.usdc.connect(core.hhUser1).approve(core.gmxEcosystem!.glpManager.address, usdcAmount);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccount.number, core.marketIds.usdc, usableUsdcAmount);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Exchange for non-liquidation sale', () => {
    it('should work when called with the normal conditions', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;
      const actions = await wrapper.createActionsForWrapping(
        solidAccountId,
        liquidAccountId,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        marketId,
        core.marketIds.usdc,
        ZERO_BI,
        usableUsdcAmount,
      );

      const amountOut = await wrapper.getExchangeCost(
        core.usdc.address,
        magicGlp.address,
        usableUsdcAmount,
        BYTES_EMPTY,
      );

      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await core.dolomiteMargin.connect(core.hhUser5).operate(
        [defaultAccount],
        actions,
      );

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, marketId);
      expect(underlyingBalanceWei.value).to.eq(amountOut);
      expect(underlyingBalanceWei.sign).to.eq(true);
      expect(await magicGlp.balanceOf(core.dolomiteMargin.address)).to.eq(amountOut);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.usdc);
      expect(otherBalanceWei.value).to.eq(ZERO_BI);
    });

    it('should fail when output token is not magicGLP', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;
      await expectThrow(
        wrapper.createActionsForWrapping(
          solidAccountId,
          liquidAccountId,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          core.marketIds.weth,
          core.marketIds.usdc,
          ZERO_BI,
          usableUsdcAmount,
        ),
        `MagicGLPWrapperTrader: Invalid output market <${core.marketIds.weth.toString()}>`,
      );
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        wrapper.connect(core.hhUser1).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          magicGlp.address,
          core.usdc.address,
          usableUsdcAmount,
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if input token is not compatible with GLP', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          magicGlp.address,
          core.dfsGlp!.address,
          usableUsdcAmount,
          abiCoder.encode(['uint256'], [ZERO_BI]),
        ),
        `MagicGLPWrapperTrader: Invalid input token <${core.dfsGlp!.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.weth.address,
          core.usdc.address,
          amountWei,
          abiCoder.encode(['uint256'], [otherAmountWei]),
        ),
        `MagicGLPWrapperTrader: Invalid output token <${core.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if input amount is 0', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          magicGlp.address,
          core.usdc.address,
          ZERO_BI,
          abiCoder.encode(['uint256'], [otherAmountWei]),
        ),
        'MagicGLPWrapperTrader: Invalid input amount',
      );
    });
  });

  describe('#MAGIC_GLP', () => {
    it('should work', async () => {
      expect(await wrapper.MAGIC_GLP()).to.eq(magicGlp.address);
    });
  });

  describe('#GMX_REGISTRY', () => {
    it('should work', async () => {
      expect(await wrapper.GMX_REGISTRY()).to.eq(core.gmxRegistry!.address);
    });
  });

  describe('#actionsLength', () => {
    it('should work', async () => {
      expect(await wrapper.actionsLength()).to.eq(1);
    });
  });

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      const inputAmount = usableUsdcAmount;
      const glpAmount = await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
        .callStatic
        .mintAndStakeGlp(
          core.usdc.address,
          inputAmount,
          1,
          1,
        );
      const expectedAmount = await magicGlp.convertToShares(glpAmount);
      expect(await wrapper.getExchangeCost(core.usdc.address, magicGlp.address, inputAmount, BYTES_EMPTY))
        .to
        .eq(expectedAmount);
    });

    it('should work for 10 random numbers, as long as balance is sufficient', async () => {
      for (let i = 0; i < 10; i++) {
        // create a random number from 1 to 99 and divide by 101 (making the number, at-most, slightly smaller)
        const randomNumber = BigNumber.from(Math.floor(Math.random() * 99) + 1);
        const weirdAmount = usableUsdcAmount.mul(randomNumber).div(101);
        const glpAmount = await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
          .callStatic
          .mintAndStakeGlp(
            core.usdc.address,
            weirdAmount,
            1,
            1,
          );
        const expectedAmount = await magicGlp.convertToShares(glpAmount);
        expect(await wrapper.getExchangeCost(core.usdc.address, magicGlp.address, weirdAmount, BYTES_EMPTY))
          .to
          .eq(expectedAmount);
      }
    });

    it('should fail if the input token is not in GLP', async () => {
      await expectThrow(
        wrapper.getExchangeCost(core.dfsGlp!.address, magicGlp.address, usableUsdcAmount, BYTES_EMPTY),
        `MagicGLPWrapperTrader: Invalid input token <${core.dfsGlp!.address.toLowerCase()}>`,
      );
    });

    it('should fail if the output token is not dfsGLP', async () => {
      await expectThrow(
        wrapper.getExchangeCost(core.usdc.address, core.weth.address, usableUsdcAmount, BYTES_EMPTY),
        `MagicGLPWrapperTrader: Invalid output token <${core.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if the input amount is 0', async () => {
      await expectThrow(
        wrapper.getExchangeCost(core.usdc.address, magicGlp.address, ZERO_BI, BYTES_EMPTY),
        'MagicGLPWrapperTrader: Invalid desired input amount',
      );
    });
  });
});
