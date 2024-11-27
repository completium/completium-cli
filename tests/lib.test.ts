import { getBalance } from "../src/lib";
import axios from "axios";
import { RPC_URL } from "../src/utils/constants";
import BigNumber from "bignumber.js";

jest.mock("axios");

describe("getBalance", () => {
  const mockAxios = axios as jest.Mocked<typeof axios>;

  it("should return the balance in tez for a valid address", async () => {
    // Arrange
    const address = "tz1VnWuemMTvW9bKCi2tTsbRhgpPGccY1JhV";
    const balanceInMutez = "2000000";

    mockAxios.get.mockResolvedValueOnce({ data: balanceInMutez });

    // Act
    const balance = await getBalance(address, {});

    // Assert
    expect(balance.toString()).toBe(balanceInMutez);
    expect(mockAxios.get).toHaveBeenCalledWith(
      `${RPC_URL}/chains/main/blocks/head/context/contracts/${address}/balance`
    );
  });

  // it("should throw an error for an invalid address", async () => {
  //   // Arrange
  //   const invalidAddress = "fake_pkh";

  //   // Act & Assert
  //   await expect(getBalance(invalidAddress, {})).rejects.toThrow(
  //     "Invalid Tezos address. It should start with 'tz'."
  //   );
  // });

  // it("should throw an error for a failed RPC call", async () => {
  //   // Arrange
  //   const address = "tz1VnWuemMTvW9bKCi2tTsbRhgpPGccY1JhV";

  //   mockAxios.get.mockRejectedValueOnce(new Error("Network Error"));

  //   // Act & Assert
  //   await expect(getBalance(address, {})).rejects.toThrow(
  //     "[Library Error]: Failed to fetch balance for tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb. Network Error"
  //   );
  // });
});
