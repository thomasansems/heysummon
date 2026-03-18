import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ProviderStore } from "../src/provider-store.js";

let tmpDir: string;
let filePath: string;
let store: ProviderStore;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "heysummon-test-"));
  filePath = join(tmpDir, "providers.json");
  store = new ProviderStore(filePath);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("ProviderStore", () => {
  it("load() returns [] when file does not exist", () => {
    expect(store.load()).toEqual([]);
  });

  it("add() creates the file on first write", () => {
    store.add({ name: "Alice", apiKey: "hs_cli_alice", providerId: "pid1", providerName: "Alice Co" });
    expect(store.load()).toHaveLength(1);
  });

  it("add() deduplicates by API key", () => {
    store.add({ name: "Alice", apiKey: "hs_cli_alice", providerId: "pid1", providerName: "Alice Co" });
    store.add({ name: "Alice v2", apiKey: "hs_cli_alice", providerId: "pid1", providerName: "Alice Co" });
    expect(store.load()).toHaveLength(1);
    expect(store.load()[0].name).toBe("Alice v2");
  });

  it("add() deduplicates by case-insensitive name", () => {
    store.add({ name: "Alice", apiKey: "hs_cli_alice1", providerId: "pid1", providerName: "Alice Co" });
    store.add({ name: "ALICE", apiKey: "hs_cli_alice2", providerId: "pid2", providerName: "Alice Corp" });
    expect(store.load()).toHaveLength(1);
    expect(store.load()[0].apiKey).toBe("hs_cli_alice2");
  });

  it("add() preserves other entries when deduplicating", () => {
    store.add({ name: "Alice", apiKey: "hs_cli_alice", providerId: "pid1", providerName: "Alice Co" });
    store.add({ name: "Bob", apiKey: "hs_cli_bob", providerId: "pid2", providerName: "Bob Inc" });
    store.add({ name: "Alice", apiKey: "hs_cli_alice_new", providerId: "pid1", providerName: "Alice Co" });
    const providers = store.load();
    expect(providers).toHaveLength(2);
    expect(providers.find((p) => p.name === "Bob")).toBeTruthy();
  });

  it("findByName() returns provider with case-insensitive match", () => {
    store.add({ name: "Alice", apiKey: "hs_cli_alice", providerId: "pid1", providerName: "Alice Co" });
    expect(store.findByName("alice")).toBeDefined();
    expect(store.findByName("ALICE")).toBeDefined();
    expect(store.findByName("bob")).toBeUndefined();
  });

  it("findByKey() returns provider with exact key match", () => {
    store.add({ name: "Alice", apiKey: "hs_cli_alice", providerId: "pid1", providerName: "Alice Co" });
    expect(store.findByKey("hs_cli_alice")).toBeDefined();
    expect(store.findByKey("hs_cli_other")).toBeUndefined();
  });

  it("getDefault() returns first provider", () => {
    store.add({ name: "Alice", apiKey: "hs_cli_alice", providerId: "pid1", providerName: "Alice Co" });
    store.add({ name: "Bob", apiKey: "hs_cli_bob", providerId: "pid2", providerName: "Bob Inc" });
    expect(store.getDefault()?.name).toBe("Alice");
  });

  it("getDefault() returns undefined when store is empty", () => {
    expect(store.getDefault()).toBeUndefined();
  });

  it("remove() deletes entry by API key", () => {
    store.add({ name: "Alice", apiKey: "hs_cli_alice", providerId: "pid1", providerName: "Alice Co" });
    const removed = store.remove("hs_cli_alice");
    expect(removed).toBe(true);
    expect(store.load()).toHaveLength(0);
  });

  it("remove() returns false for unknown key", () => {
    expect(store.remove("hs_cli_unknown")).toBe(false);
  });

  it("add() stores nameLower correctly", () => {
    store.add({ name: "My Expert", apiKey: "hs_cli_x", providerId: "pid1", providerName: "Expert" });
    expect(store.load()[0].nameLower).toBe("my expert");
  });

  it("add() creates parent directories if needed", () => {
    const nestedPath = join(tmpDir, "nested", "deep", "providers.json");
    const nestedStore = new ProviderStore(nestedPath);
    nestedStore.add({ name: "Alice", apiKey: "hs_cli_alice", providerId: "pid1", providerName: "Alice Co" });
    expect(nestedStore.load()).toHaveLength(1);
  });
});
