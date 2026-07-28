import { describe, it, expect } from "vitest";

interface ReassignmentEntry {
  fromCustomerId: string;
  fromCustomerName: string;
  toCustomerId: string;
  toCustomerName: string;
  reassignedAt: string;
  staffName?: string;
}

function buildUpdatedHistory(
  history: ReassignmentEntry[],
  newEntry: ReassignmentEntry
): ReassignmentEntry[] {
  const lastEntry = history[history.length - 1];
  const isDuplicate =
    lastEntry &&
    lastEntry.fromCustomerId === newEntry.fromCustomerId &&
    lastEntry.toCustomerId === newEntry.toCustomerId;
  return isDuplicate ? history : [...history, newEntry];
}

describe("reassignment history dedup logic", () => {
  const entry: ReassignmentEntry = {
    fromCustomerId: "cust-1",
    fromCustomerName: "Alice",
    toCustomerId: "cust-2",
    toCustomerName: "Bob",
    reassignedAt: new Date().toISOString(),
  };

  it("appends the first entry to an empty history", () => {
    const result = buildUpdatedHistory([], entry);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      fromCustomerId: "cust-1",
      toCustomerId: "cust-2",
    });
  });

  it("appends when the new entry has a different from/to combination", () => {
    const differentEntry: ReassignmentEntry = {
      ...entry,
      fromCustomerId: "cust-2",
      toCustomerId: "cust-3",
    };
    const result = buildUpdatedHistory([entry], differentEntry);
    expect(result).toHaveLength(2);
  });

  it("skips duplicate when the last entry has the same fromCustomerId + toCustomerId", () => {
    const duplicateEntry: ReassignmentEntry = {
      ...entry,
      reassignedAt: new Date().toISOString(),
    };
    const result = buildUpdatedHistory([entry], duplicateEntry);
    expect(result).toHaveLength(1);
  });

  it("does not skip when the duplicate is not the last entry", () => {
    const secondEntry: ReassignmentEntry = {
      fromCustomerId: "cust-2",
      fromCustomerName: "Bob",
      toCustomerId: "cust-3",
      toCustomerName: "Carol",
      reassignedAt: new Date().toISOString(),
    };
    const history = [entry, secondEntry];
    const replayFirstEntry: ReassignmentEntry = { ...entry, reassignedAt: new Date().toISOString() };
    const result = buildUpdatedHistory(history, replayFirstEntry);
    expect(result).toHaveLength(3);
  });

  it("preserves all existing entries when no duplicate is detected", () => {
    const history: ReassignmentEntry[] = [
      { fromCustomerId: "a", fromCustomerName: "A", toCustomerId: "b", toCustomerName: "B", reassignedAt: "t1" },
      { fromCustomerId: "b", fromCustomerName: "B", toCustomerId: "c", toCustomerName: "C", reassignedAt: "t2" },
    ];
    const newEntry: ReassignmentEntry = {
      fromCustomerId: "c", fromCustomerName: "C", toCustomerId: "d", toCustomerName: "D", reassignedAt: "t3",
    };
    const result = buildUpdatedHistory(history, newEntry);
    expect(result).toHaveLength(3);
    expect(result[2].toCustomerId).toBe("d");
  });
});
