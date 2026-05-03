// Manual mock for @google-cloud/logging
// Jest automatically uses this file instead of the real package for all test suites.
const mockWrite = jest.fn().mockResolvedValue(undefined);
const mockEntry = jest.fn().mockReturnValue({});
const mockLog = jest.fn().mockReturnValue({ write: mockWrite, entry: mockEntry });

const Logging = jest.fn().mockImplementation(() => ({
  log: mockLog,
}));

module.exports = { Logging };
