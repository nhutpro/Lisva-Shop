import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getImageStorage } from "@/lib/storage";
import { inspectImage, MAX_IMAGE_BYTES } from "@/lib/storage/image-check";

// POST /api/admin/upload  (multipart form, field "file") -> { url } or { error }.
// Only a signed-in administrator can upload. The file is judged by its content, size-limited, and stored under a
// random name. Errors are stable codes: UNAUTHORIZED 401, FORBIDDEN 403, EMPTY/BAD_TYPE 400, TOO_LARGE 413,
// LENGTH_REQUIRED 411, UNKNOWN 500.

const fail = (error: string, status: number) =>
  NextResponse.json(
    { error },
    { status, headers: { "cache-control": "no-store" } },
  );

/** True when the request comes from this site (or has no Origin header, as with tools and same-origin GET-like calls). */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  try {
    return new URL(origin).host === request.headers.get("host"); // "Origin: null" and junk fail the parse
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("FORBIDDEN", 403);

  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN")
    return fail("UNAUTHORIZED", user ? 403 : 401);

  // Refuse before reading the body: without a length the size cannot be limited up front.
  const length = Number(request.headers.get("content-length"));
  if (!request.headers.has("content-length") || !Number.isFinite(length))
    return fail("LENGTH_REQUIRED", 411);
  if (length > MAX_IMAGE_BYTES + 64 * 1024) return fail("TOO_LARGE", 413);

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return fail("BAD_TYPE", 400);
  }
  if (!(file instanceof File)) return fail("EMPTY", 400);
  if (file.size > MAX_IMAGE_BYTES) return fail("TOO_LARGE", 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = inspectImage(bytes);
  if (!check.ok)
    return fail(check.code, check.code === "TOO_LARGE" ? 413 : 400);

  try {
    const { url } = await getImageStorage().put(bytes, check.ext);
    return NextResponse.json(
      { url },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    // Say what failed (never the file, its name, or any key) so a wrong setting can be found.
    console.error(
      `[upload] storage failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    return fail("UNKNOWN", 500);
  }
}
