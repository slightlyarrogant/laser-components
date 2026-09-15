/**
 * Unit tests for the pure authorization rules in src/core/access.ts.
 *
 * Run with:  npx tsx --test tests/access.test.ts
 *
 * These are deliberately DB-free: access.ts takes an Actor plus four lead
 * columns and returns a boolean, so the whole rule set is testable without a
 * Postgres connection, a Prisma client, or an HTTP server.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  canEditLead,
  isAdmin,
  leadRegionId,
  requireRole,
  type Actor,
  type LeadAccessFields,
} from "../src/core/access.js";

// Region ids mirror the live taxonomy: 1 = NA, 2 = EU, 3 = AS.
const NA = 1;
const EU = 2;
const AS = 3;

const admin: Actor = { id: 10, role: "ADMIN", regionIds: [] };
const globalSales: Actor = { id: 20, role: "SALES", regionIds: [] };
const euSales: Actor = { id: 30, role: "SALES", regionIds: [EU] };
const researcher: Actor = { id: 40, role: "RESEARCHER", regionIds: [NA, EU] };

const unownedEU: LeadAccessFields = {
  ownerUserId: null,
  createdByUserId: null,
  regionId: EU,
};
const unownedAS: LeadAccessFields = {
  ownerUserId: null,
  createdByUserId: null,
  regionId: AS,
};
const unownedNoGeography: LeadAccessFields = {
  ownerUserId: null,
  createdByUserId: null,
  regionId: null,
  countryRegionId: null,
};

test("ADMIN may edit anything — owned by others, out of region, geography unknown", () => {
  assert.equal(isAdmin(admin), true);
  assert.equal(canEditLead(admin, { ownerUserId: 999, regionId: AS }), true);
  assert.equal(canEditLead(admin, unownedAS), true);
  assert.equal(canEditLead(admin, unownedNoGeography), true);
});

test("the owner may edit their own lead, even outside their region", () => {
  const lead: LeadAccessFields = {
    ownerUserId: euSales.id,
    createdByUserId: 999,
    regionId: AS, // far outside euSales' competency
  };
  assert.equal(canEditLead(euSales, lead), true);
});

test("the creator may edit a lead they created, even after it is reassigned", () => {
  const lead: LeadAccessFields = {
    ownerUserId: 999, // handed to somebody else
    createdByUserId: euSales.id,
    regionId: AS,
  };
  assert.equal(canEditLead(euSales, lead), true);
});

test("a global-competency user (no regions) may edit any UNOWNED lead", () => {
  assert.equal(canEditLead(globalSales, unownedEU), true);
  assert.equal(canEditLead(globalSales, unownedAS), true);
  assert.equal(canEditLead(globalSales, unownedNoGeography), true);
});

test("a regional user may edit an unowned lead IN region and is refused OUT of region", () => {
  assert.equal(canEditLead(euSales, unownedEU), true);
  assert.equal(canEditLead(euSales, unownedAS), false);
  // Geography unknown falls OPEN (one company; most leads have no geography yet).
  assert.equal(canEditLead(euSales, unownedNoGeography), true);
});

test("region competency also resolves through the lead's country", () => {
  const viaCountry: LeadAccessFields = {
    ownerUserId: null,
    createdByUserId: null,
    regionId: null,
    countryRegionId: EU,
  };
  assert.equal(leadRegionId(viaCountry), EU);
  assert.equal(canEditLead(euSales, viaCountry), true);
  assert.equal(canEditLead(researcher, viaCountry), true);
  assert.equal(
    canEditLead({ id: 50, role: "SALES", regionIds: [NA] }, viaCountry),
    false
  );
  // A direct region_id wins over the country's region.
  assert.equal(leadRegionId({ regionId: AS, countryRegionId: EU }), AS);
});

test("a regional user is refused on a lead owned by somebody else, even in region", () => {
  const ownedByOther: LeadAccessFields = {
    ownerUserId: 999,
    createdByUserId: 998,
    regionId: EU, // squarely inside euSales' competency — still refused
  };
  assert.equal(canEditLead(euSales, ownedByOther), false);
  // Same for a global-competency user: ownership beats competency.
  assert.equal(canEditLead(globalSales, ownedByOther), false);
});

test("requireRole throws 'Requires role X' for the wrong role and passes for the right one", () => {
  assert.throws(
    () => requireRole(euSales, "ADMIN"),
    /Requires role ADMIN/
  );
  assert.throws(
    () => requireRole(euSales, "ADMIN", "RESEARCHER"),
    /Requires role ADMIN or RESEARCHER/
  );
  assert.doesNotThrow(() => requireRole(admin, "ADMIN"));
  assert.doesNotThrow(() => requireRole(researcher, "ADMIN", "RESEARCHER"));
  assert.doesNotThrow(() => requireRole(euSales));
});
