// Cached wrappers around queries-core. Next.js caches the result per argument set
// (see node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md).
// Cached functions must not read runtime APIs (params, searchParams, cookies): callers pass plain values.
// Admin edits and stock changes invalidate everything with updateTag("products").
import { cacheLife, cacheTag } from "next/cache";
import { db } from "../db";
import type { ListParams } from "./parse-list-params";
import * as core from "./queries-core";

export async function listProducts(params: ListParams) {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");
  return core.listProducts(db, params);
}

export async function getListFacets(category?: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");
  return core.getListFacets(db, category);
}

export async function getCategories() {
  "use cache";
  cacheLife("hours");
  cacheTag("products", "categories");
  return core.getCategories(db);
}

export async function getProductDetail(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("products", `product:${slug}`);
  return core.getProductDetail(db, slug);
}

export async function getHomeData() {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");
  return core.getHomeData(db);
}

export async function getProductSlugs() {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  return core.getProductSlugs(db);
}
