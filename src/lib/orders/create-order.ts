import { Prisma, type PrismaClient } from "@prisma/client";
import { effectivePrice, pickImages } from "../catalog/pricing";
import { OrderError } from "./errors";
import { generateOrderCode } from "./order-code";
import { orderInputSchema } from "./schema";

const MAX_CODE_ATTEMPTS = 5;

const isCodeCollision = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError &&
  e.code === "P2002" &&
  JSON.stringify(e.meta?.target ?? "").includes("code");

/**
 * Creates an order request. Prices and names always come from the database, never from the browser.
 * Stock is only checked here; it is deducted later, when the owner confirms (see changeOrderStatus).
 * Throws ZodError for invalid input and OrderError for business problems.
 */
export async function createOrder(db: PrismaClient, rawInput: unknown) {
  const input = orderInputSchema.parse(rawInput);

  // The same variant on two lines becomes one line.
  const quantities = new Map<string, number>();
  for (const { variantId, quantity } of input.items) {
    quantities.set(variantId, (quantities.get(variantId) ?? 0) + quantity);
  }

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const variants = await tx.productVariant.findMany({
          where: { id: { in: [...quantities.keys()] } },
          include: { product: { include: { images: true } }, color: true, size: true },
        });
        const byId = new Map(variants.map((v) => [v.id, v]));

        const lines = [...quantities].map(([variantId, quantity]) => {
          const variant = byId.get(variantId);
          if (!variant) throw new OrderError("VARIANT_NOT_FOUND", { variantId });
          if (!variant.isActive || variant.product.status !== "ACTIVE") {
            throw new OrderError("VARIANT_UNAVAILABLE", { variantId });
          }
          if (variant.stock < quantity) {
            throw new OrderError("OUT_OF_STOCK", { variantId, available: variant.stock });
          }
          const unitPrice = effectivePrice(variant.product, variant);
          return {
            variantId,
            productName: variant.product.nameVi,
            colorName: variant.color?.nameVi ?? null,
            sizeLabel: variant.size?.label ?? null,
            sku: variant.sku,
            imageUrl: pickImages(variant.product.images, variant)[0]?.url ?? null,
            unitPrice,
            quantity,
            lineTotal: unitPrice * quantity,
          };
        });

        const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

        return tx.order.create({
          data: {
            code: generateOrderCode(),
            userId: input.userId,
            customerName: input.customerName,
            phone: input.phone,
            email: input.email,
            preferredContact: input.preferredContact,
            province: input.province,
            district: input.district,
            ward: input.ward,
            street: input.street,
            customerNote: input.customerNote,
            locale: input.locale,
            subtotal,
            total: subtotal, // shipping is quoted later by the owner
            items: { create: lines },
            history: { create: { fromStatus: null, toStatus: "PENDING_CONTACT" } },
          },
          include: { items: true },
        });
      });
    } catch (e) {
      if (isCodeCollision(e)) continue;
      throw e;
    }
  }
  throw new OrderError("CODE_GENERATION_FAILED");
}
