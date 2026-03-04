import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TtlCache } from "./cache.js";

describe("TtlCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores and retrieves values", () => {
    const cache = new TtlCache();
    cache.set("key", "value");
    expect(cache.get("key")).toBe("value");
  });

  it("returns undefined for missing keys", () => {
    const cache = new TtlCache();
    expect(cache.get("missing")).toBeUndefined();
  });

  it("expires entries after default TTL", () => {
    const cache = new TtlCache(1000);
    cache.set("key", "value");

    vi.advanceTimersByTime(999);
    expect(cache.get("key")).toBe("value");

    vi.advanceTimersByTime(2);
    expect(cache.get("key")).toBeUndefined();
  });

  it("supports custom TTL per entry", () => {
    const cache = new TtlCache(10_000);
    cache.set("short", "val", 500);
    cache.set("long", "val", 5000);

    vi.advanceTimersByTime(600);
    expect(cache.get("short")).toBeUndefined();
    expect(cache.get("long")).toBe("val");
  });

  it("invalidates keys matching pattern", () => {
    const cache = new TtlCache();
    cache.set("status:3STEST123:data", "a");
    cache.set("status:3STEST123:meta", "b");
    cache.set("locations:1234AB", "c");

    cache.invalidate("status:3STEST123");

    expect(cache.get("status:3STEST123:data")).toBeUndefined();
    expect(cache.get("status:3STEST123:meta")).toBeUndefined();
    expect(cache.get("locations:1234AB")).toBe("c");
  });

  it("clears all entries", () => {
    const cache = new TtlCache();
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.size).toBe(2);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeUndefined();
  });

  it("tracks size correctly", () => {
    const cache = new TtlCache();
    expect(cache.size).toBe(0);

    cache.set("a", 1);
    expect(cache.size).toBe(1);

    cache.set("b", 2);
    expect(cache.size).toBe(2);

    cache.set("a", 3); // overwrite
    expect(cache.size).toBe(2);
  });

  it("removes expired entry on get and updates size", () => {
    const cache = new TtlCache(100);
    cache.set("key", "val");
    expect(cache.size).toBe(1);

    vi.advanceTimersByTime(101);
    expect(cache.get("key")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("stores complex objects", () => {
    const cache = new TtlCache();
    const obj = { Barcode: "3STEST123", Status: { StatusCode: "1" } };
    cache.set("key", obj);
    expect(cache.get("key")).toEqual(obj);
  });

  it("uses default TTL of 120 seconds when none specified", () => {
    const cache = new TtlCache();
    cache.set("key", "value");

    vi.advanceTimersByTime(119_999);
    expect(cache.get("key")).toBe("value");

    vi.advanceTimersByTime(2);
    expect(cache.get("key")).toBeUndefined();
  });
});
