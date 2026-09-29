/**
 * Pure Prisma where-fragment builder for the country + product lead filters
 * shared by search_leads and get_leads. DB-free so it is unit-testable.
 */

export interface GeoProductFilterArgs {
  country?: string | null;
  countryId?: number | null;
  productId?: number | null;
  productName?: string | null;
}

/**
 * Returns AND-able Prisma `Lead` where fragments. Name filters are
 * case-insensitive contains (an exact name is a contains match too). A country
 * filter only ever matches leads that have a country assigned.
 */
export function buildGeoProductFilters(a: GeoProductFilterArgs): any[] {
  const and: any[] = [];
  const country = a.country?.trim();
  const productName = a.productName?.trim();

  if (country) {
    and.push({
      country: { is: { name: { contains: country, mode: "insensitive" } } },
    });
  }
  if (a.countryId != null) and.push({ countryId: a.countryId });
  if (a.productId != null) and.push({ productId: a.productId });
  if (productName) {
    and.push({
      product: { is: { name: { contains: productName, mode: "insensitive" } } },
    });
  }
  return and;
}
