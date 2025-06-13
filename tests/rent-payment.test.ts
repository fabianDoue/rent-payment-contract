import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock addresses for testing
const LANDLORD_ADDRESS = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
const TENANT_ADDRESS = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG";
const NEW_TENANT_ADDRESS = "ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0";

// Error codes from the contract
const ERR_UNAUTHORIZED = 1000;
const ERR_INSUFFICIENT_FUNDS = 1001;
const ERR_ALREADY_PAID = 1002;
const ERR_INVALID_AMOUNT = 1003;

// Mock contract state
let contractState = {
  landlord: LANDLORD_ADDRESS,
  tenant: null,
  rentAmount: 0,
  rentDueDay: 1,
  penaltyPercentage: 5,
  securityDeposit: 0,
  currentPeriod: 0,
  paymentStatus: {},
};

// Mock wallet balances
let walletBalances = {
  [LANDLORD_ADDRESS]: 10000,
  [TENANT_ADDRESS]: 5000,
  [NEW_TENANT_ADDRESS]: 3000,
};

// Mock contract functions
const mockContractCall = (functionName, args, sender) => {
  // Set the current sender
  const currentSender = sender;

  switch (functionName) {
    case "initialize": {
      // Check if caller is landlord
      if (currentSender !== contractState.landlord) {
        return { type: "err", value: ERR_UNAUTHORIZED };
      }

      const [newTenant, newRentAmount, newRentDueDay, newPenaltyPercentage] =
        args;

      // Validate inputs
      if (newRentAmount <= 0) {
        return { type: "err", value: ERR_INVALID_AMOUNT };
      }

      if (newRentDueDay <= 0 || newRentDueDay > 28) {
        return { type: "err", value: ERR_INVALID_AMOUNT };
      }

      // Update contract state
      contractState.tenant = newTenant;
      contractState.rentAmount = newRentAmount;
      contractState.rentDueDay = newRentDueDay;
      contractState.penaltyPercentage = newPenaltyPercentage;
      contractState.currentPeriod = 1;

      return { type: "ok", value: true };
    }

    case "pay-rent": {
      // Check if caller is tenant
      if (currentSender !== contractState.tenant) {
        return { type: "err", value: ERR_UNAUTHORIZED };
      }

      const [isLate] = args;
      const currentPeriod = contractState.currentPeriod;

      // Check if rent is already paid for this period
      if (contractState.paymentStatus[currentPeriod]?.paid) {
        return { type: "err", value: ERR_ALREADY_PAID };
      }

      // Calculate payment amount
      const baseAmount = contractState.rentAmount;
      const penaltyAmount = isLate
        ? Math.floor((baseAmount * contractState.penaltyPercentage) / 100)
        : 0;
      const finalPaymentAmount = baseAmount + penaltyAmount;

      // Check if tenant has enough funds
      if (walletBalances[currentSender] < finalPaymentAmount) {
        return { type: "err", value: ERR_INSUFFICIENT_FUNDS };
      }

      // Process payment
      walletBalances[currentSender] -= finalPaymentAmount;
      walletBalances[contractState.landlord] += finalPaymentAmount;

      // Update payment status
      contractState.paymentStatus[currentPeriod] = {
        paid: true,
        amountPaid: finalPaymentAmount,
        late: isLate,
      };

      // Increment period
      contractState.currentPeriod += 1;

      return { type: "ok", value: finalPaymentAmount };
    }

    case "pay-security-deposit": {
      // Check if caller is tenant
      if (currentSender !== contractState.tenant) {
        return { type: "err", value: ERR_UNAUTHORIZED };
      }

      const [amount] = args;

      // Validate amount
      if (amount <= 0) {
        return { type: "err", value: ERR_INVALID_AMOUNT };
      }

      // Check if tenant has enough funds
      if (walletBalances[currentSender] < amount) {
        return { type: "err", value: ERR_INSUFFICIENT_FUNDS };
      }

      // Process payment
      walletBalances[currentSender] -= amount;
      walletBalances[contractState.landlord] += amount;

      // Update security deposit
      contractState.securityDeposit = amount;

      return { type: "ok", value: amount };
    }

    case "return-security-deposit": {
      // Check if caller is landlord
      if (currentSender !== contractState.landlord) {
        return { type: "err", value: ERR_UNAUTHORIZED };
      }

      // Check if there's a security deposit to return
      if (contractState.securityDeposit <= 0) {
        return { type: "err", value: ERR_INVALID_AMOUNT };
      }

      const depositAmount = contractState.securityDeposit;

      // Check if landlord has enough funds
      if (walletBalances[currentSender] < depositAmount) {
        return { type: "err", value: ERR_INSUFFICIENT_FUNDS };
      }

      // Process refund
      walletBalances[currentSender] -= depositAmount;
      walletBalances[contractState.tenant] += depositAmount;

      // Reset security deposit
      contractState.securityDeposit = 0;

      return { type: "ok", value: depositAmount };
    }

    case "update-rent-amount": {
      // Check if caller is landlord
      if (currentSender !== contractState.landlord) {
        return { type: "err", value: ERR_UNAUTHORIZED };
      }

      const [newAmount] = args;

      // Validate amount
      if (newAmount <= 0) {
        return { type: "err", value: ERR_INVALID_AMOUNT };
      }

      // Update rent amount
      contractState.rentAmount = newAmount;

      return { type: "ok", value: newAmount };
    }

    case "change-tenant": {
      // Check if caller is landlord
      if (currentSender !== contractState.landlord) {
        return { type: "err", value: ERR_UNAUTHORIZED };
      }

      const [newTenant] = args;

      // Update tenant
      contractState.tenant = newTenant;

      return { type: "ok", value: true };
    }

    default:
      return { type: "err", value: "Unknown function" };
  }
};

// Reset contract state before each test
beforeEach(() => {
  contractState = {
    landlord: LANDLORD_ADDRESS,
    tenant: null,
    rentAmount: 0,
    rentDueDay: 1,
    penaltyPercentage: 5,
    securityDeposit: 0,
    currentPeriod: 0,
    paymentStatus: {},
  };

  walletBalances = {
    [LANDLORD_ADDRESS]: 10000,
    [TENANT_ADDRESS]: 5000,
    [NEW_TENANT_ADDRESS]: 3000,
  };
});

describe("Rent Payment Contract", () => {
  describe("Initialization", () => {
    it("should initialize contract with correct values", () => {
      const result = mockContractCall(
        "initialize",
        [TENANT_ADDRESS, 1000, 15, 5],
        LANDLORD_ADDRESS,
      );

      expect(result).toEqual({ type: "ok", value: true });
      expect(contractState.tenant).toBe(TENANT_ADDRESS);
      expect(contractState.rentAmount).toBe(1000);
      expect(contractState.rentDueDay).toBe(15);
      expect(contractState.penaltyPercentage).toBe(5);
      expect(contractState.currentPeriod).toBe(1);
    });

    it("should fail initialization if not called by landlord", () => {
      const result = mockContractCall(
        "initialize",
        [TENANT_ADDRESS, 1000, 15, 5],
        TENANT_ADDRESS,
      );

      expect(result).toEqual({ type: "err", value: ERR_UNAUTHORIZED });
    });

    it("should fail initialization with invalid rent amount", () => {
      const result = mockContractCall(
        "initialize",
        [TENANT_ADDRESS, 0, 15, 5],
        LANDLORD_ADDRESS,
      );

      expect(result).toEqual({ type: "err", value: ERR_INVALID_AMOUNT });
    });

    it("should fail initialization with invalid due day", () => {
      const result = mockContractCall(
        "initialize",
        [TENANT_ADDRESS, 1000, 0, 5],
        LANDLORD_ADDRESS,
      );

      expect(result).toEqual({ type: "err", value: ERR_INVALID_AMOUNT });
    });
  });

  describe("Rent Payment", () => {
    beforeEach(() => {
      // Initialize contract before testing payments
      mockContractCall(
        "initialize",
        [TENANT_ADDRESS, 1000, 15, 5],
        LANDLORD_ADDRESS,
      );
    });

    it("should allow tenant to pay rent on time", () => {
      const initialLandlordBalance = walletBalances[LANDLORD_ADDRESS];
      const initialTenantBalance = walletBalances[TENANT_ADDRESS];

      const result = mockContractCall(
        "pay-rent",
        [false], // not late
        TENANT_ADDRESS,
      );

      expect(result).toEqual({ type: "ok", value: 1000 });
      expect(contractState.paymentStatus[1].paid).toBe(true);
      expect(contractState.paymentStatus[1].amountPaid).toBe(1000);
      expect(contractState.paymentStatus[1].late).toBe(false);
      expect(contractState.currentPeriod).toBe(2);

      // Check balances
      expect(walletBalances[LANDLORD_ADDRESS]).toBe(
        initialLandlordBalance + 1000,
      );
      expect(walletBalances[TENANT_ADDRESS]).toBe(initialTenantBalance - 1000);
    });

    it("should apply penalty for late payment", () => {
      const initialLandlordBalance = walletBalances[LANDLORD_ADDRESS];
      const initialTenantBalance = walletBalances[TENANT_ADDRESS];

      const result = mockContractCall(
        "pay-rent",
        [true], // late
        TENANT_ADDRESS,
      );

      // Expected penalty: 5% of 1000 = 50
      const expectedPayment = 1050;

      expect(result).toEqual({ type: "ok", value: expectedPayment });
      expect(contractState.paymentStatus[1].paid).toBe(true);
      expect(contractState.paymentStatus[1].amountPaid).toBe(expectedPayment);
      expect(contractState.paymentStatus[1].late).toBe(true);

      // Check balances
      expect(walletBalances[LANDLORD_ADDRESS]).toBe(
        initialLandlordBalance + expectedPayment,
      );
      expect(walletBalances[TENANT_ADDRESS]).toBe(
        initialTenantBalance - expectedPayment,
      );
    });

    it("should not allow non-tenant to pay rent", () => {
      const result = mockContractCall("pay-rent", [false], LANDLORD_ADDRESS);

      expect(result).toEqual({ type: "err", value: ERR_UNAUTHORIZED });
    });

    it("should fail if tenant has insufficient funds", () => {
      // Set tenant balance to less than rent
      walletBalances[TENANT_ADDRESS] = 500;

      const result = mockContractCall("pay-rent", [false], TENANT_ADDRESS);

      expect(result).toEqual({ type: "err", value: ERR_INSUFFICIENT_FUNDS });
    });
  });

  describe("Security Deposit", () => {
    beforeEach(() => {
      // Initialize contract before testing
      mockContractCall(
        "initialize",
        [TENANT_ADDRESS, 1000, 15, 5],
        LANDLORD_ADDRESS,
      );
    });

    it("should allow tenant to pay security deposit", () => {
      const initialLandlordBalance = walletBalances[LANDLORD_ADDRESS];
      const initialTenantBalance = walletBalances[TENANT_ADDRESS];

      const result = mockContractCall(
        "pay-security-deposit",
        [2000],
        TENANT_ADDRESS,
      );

      expect(result).toEqual({ type: "ok", value: 2000 });
      expect(contractState.securityDeposit).toBe(2000);

      // Check balances
      expect(walletBalances[LANDLORD_ADDRESS]).toBe(
        initialLandlordBalance + 2000,
      );
      expect(walletBalances[TENANT_ADDRESS]).toBe(initialTenantBalance - 2000);
    });

    it("should allow landlord to return security deposit", () => {
      // First pay the deposit
      mockContractCall("pay-security-deposit", [2000], TENANT_ADDRESS);

      const initialLandlordBalance = walletBalances[LANDLORD_ADDRESS];
      const initialTenantBalance = walletBalances[TENANT_ADDRESS];

      const result = mockContractCall(
        "return-security-deposit",
        [],
        LANDLORD_ADDRESS,
      );

      expect(result).toEqual({ type: "ok", value: 2000 });
      expect(contractState.securityDeposit).toBe(0);

      // Check balances
      expect(walletBalances[LANDLORD_ADDRESS]).toBe(
        initialLandlordBalance - 2000,
      );
      expect(walletBalances[TENANT_ADDRESS]).toBe(initialTenantBalance + 2000);
    });

    it("should not allow non-landlord to return security deposit", () => {
      // First pay the deposit
      mockContractCall("pay-security-deposit", [2000], TENANT_ADDRESS);

      const result = mockContractCall(
        "return-security-deposit",
        [],
        TENANT_ADDRESS,
      );

      expect(result).toEqual({ type: "err", value: ERR_UNAUTHORIZED });
      expect(contractState.securityDeposit).toBe(2000);
    });
  });

  describe("Administrative Functions", () => {
    beforeEach(() => {
      // Initialize contract before testing
      mockContractCall(
        "initialize",
        [TENANT_ADDRESS, 1000, 15, 5],
        LANDLORD_ADDRESS,
      );
    });

    it("should allow landlord to update rent amount", () => {
      const result = mockContractCall(
        "update-rent-amount",
        [1200],
        LANDLORD_ADDRESS,
      );

      expect(result).toEqual({ type: "ok", value: 1200 });
      expect(contractState.rentAmount).toBe(1200);
    });

    it("should not allow tenant to update rent amount", () => {
      const result = mockContractCall(
        "update-rent-amount",
        [1200],
        TENANT_ADDRESS,
      );

      expect(result).toEqual({ type: "err", value: ERR_UNAUTHORIZED });
      expect(contractState.rentAmount).toBe(1000);
    });

    it("should allow landlord to change tenant", () => {
      const result = mockContractCall(
        "change-tenant",
        [NEW_TENANT_ADDRESS],
        LANDLORD_ADDRESS,
      );

      expect(result).toEqual({ type: "ok", value: true });
      expect(contractState.tenant).toBe(NEW_TENANT_ADDRESS);
    });

    it("should not allow non-landlord to change tenant", () => {
      const result = mockContractCall(
        "change-tenant",
        [NEW_TENANT_ADDRESS],
        TENANT_ADDRESS,
      );

      expect(result).toEqual({ type: "err", value: ERR_UNAUTHORIZED });
      expect(contractState.tenant).toBe(TENANT_ADDRESS);
    });
  });
});
