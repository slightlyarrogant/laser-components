/**
 * Unit tests for the pure country/product where-fragment builder shared by
 * search_leads and get_leads (src/tools/lead-filters.ts). DB-free.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { buildGeoProductFilters } from "../src/tools/lead-filters.js";

test("no args -> no fragments", () => {
  assert.deepEqual(buildGeoProductFilters({}), []);
});

test("blank / null strings are ignored", () => {
  assert.deepEqual(
    buildGeoProductFilters({ country: "  ", productName: "", countryId: null, productId: null }),
    []
  );
});

test("country -> case-insensitive contains on country.name (trimmed)", () => {
  assert.deepEqual(buildGeoProductFilters({ country: " Poland " }), [
    { country: { is: { name: { contains: "Poland", mode: "insensitive" } } } },
  ]);
});

test("productName -> case-insensitive contains on product.name", () => {
  assert.deepEqual(buildGeoProductFilters({ productName: "905" }), [
    { product: { is: { name: { contains: "905", mode: "insensitive" } } } },
  ]);
});

test("ids -> exact scalar matches (0 is a valid id, not skipped)", () => {
  assert.deepEqual(buildGeoProductFilters({ countryId: 7, productId: 0 }), [
    { countryId: 7 },
    { productId: 0 },
  ]);
});

test("country + productName combine as separate AND fragments", () => {
  const f = buildGeoProductFilters({ country: "Poland", productName: "Pulsed Laser Diodes" });
  assert.equal(f.length, 2);
  assert.deepEqual(f[0], {
    country: { is: { name: { contains: "Poland", mode: "insensitive" } } },
  });
  assert.deepEqual(f[1], {
    product: { is: { name: { contains: "Pulsed Laser Diodes", mode: "insensitive" } } },
  });
});
