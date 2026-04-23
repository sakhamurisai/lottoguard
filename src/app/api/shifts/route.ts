import { z } from "zod";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLE } from "@/lib/aws";
import { requireEmployee, errResponse } from "@/lib/validate";
import {
  listShifts, getActiveShift, clockIn, clockOut,
  listBooks, listSlots, upsertSlot, updateBook,
  createNotification,
} from "@/lib/db";

export async function GET() {
  try {
    const { orgId, sub } = await requireEmployee();
    const [shifts, active] = await Promise.all([
      listShifts(orgId, sub),
      getActiveShift(orgId, sub),
    ]);

    // Enrich shifts with book price for tier attribution
    const books = await listBooks(orgId);
    const slots  = await listSlots(orgId);
    const slotBookMap: Record<number, string> = {};
    for (const s of slots) slotBookMap[s.slotNum as number] = s.bookId as string;
    const bookPriceMap: Record<string, number> = {};
    const bookNameMap:  Record<string, string> = {};
    for (const b of books) {
      bookPriceMap[b.bookId as string] = b.price as number;
      bookNameMap[b.bookId  as string] = b.gameName as string ?? "";
    }

    const enriched = (shifts as Record<string, unknown>[]).map((sh) => {
      const bookId = slotBookMap[sh.slotNum as number];
      return { ...sh, bookPrice: bookPriceMap[bookId] ?? 0, gameName: bookNameMap[bookId] ?? "" };
    });

    return Response.json({ shifts: enriched, active });
  } catch (err) { return errResponse(err); }
}

// ── Serial helpers ─────────────────────────────────────────────────────────────

const SERIAL_RE = /^(\d{4})-(\d{7})-(\d{3})-\d$/;

function parseSerial(serial: string) {
  const m = SERIAL_RE.exec(serial);
  if (!m) return null;
  return { gameId: m[1], bookNum: m[2], ticketNum: parseInt(m[3], 10) };
}

// ── Schemas ────────────────────────────────────────────────────────────────────

const serialEntrySchema = z.object({
  serial:  z.string().regex(SERIAL_RE, "Invalid ticket serial format"),
  slotNum: z.number().int().min(1).optional(),
});

const directEntrySchema = z.object({
  slotNum:     z.number().int().min(1),
  bookId:      z.string().min(1),
  ticketStart: z.number().int().min(0),
});

const bookEntrySchema = z.union([serialEntrySchema, directEntrySchema]);

const clockInSchema = z.object({
  action:  z.literal("clock_in"),
  entries: z.array(bookEntrySchema).min(1),
});

const receiptDataSchema = z.object({
  raw:                z.string(),
  grossSales:         z.number().optional(),
  onlineNetSales:     z.number(),
  cashlessInstant:    z.number(),
  terminalNumber:     z.string().optional(),
  receiptDate:        z.string().optional(),
  receiptTime:        z.string().optional(),
}).optional();

const cashesDataSchema = z.object({
  raw:         z.string(),
  totalCashes: z.number(),
  terminalNumber: z.string().optional(),
  receiptDate:    z.string().optional(),
  receiptTime:    z.string().optional(),
}).optional();

const clockOutSchema = z.object({
  action:           z.literal("clock_out"),
  shiftId:          z.string(),
  ticketEnd:        z.coerce.number().int().min(0),
  drawerCash:       z.coerce.number().min(0),
  discrepancyNote:  z.string().optional(),
  salesReceipt:     receiptDataSchema,
  cashesReceipt:    cashesDataSchema,
  booksSoldOut:     z.array(z.object({
    bookId:  z.string(),
    slotNum: z.number().int().min(1),
  })).optional(),
});

const bookSoldOutSchema = z.object({
  action:  z.literal("book_sold_out"),
  bookId:  z.string(),
  slotNum: z.number().int().min(1),
  newBookSerial: z.string().regex(SERIAL_RE).optional(),
});

const updateSlotSchema = z.object({
  action:  z.literal("update_slot"),
  slotNum: z.number().int().min(1),
  bookId:  z.string().nullable(),
});

const notifySlotChangeSchema = z.object({
  action:   z.literal("notify_slot_change"),
  slotNum:  z.number().int().min(1),
  message:  z.string().optional(),
  priority: z.boolean().optional(),
});

const bodySchema = z.discriminatedUnion("action", [
  clockInSchema,
  clockOutSchema,
  bookSoldOutSchema,
  updateSlotSchema,
  notifySlotChangeSchema,
]);

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const payload = await requireEmployee();
    const body    = bodySchema.parse(await req.json());

    // ── Clock In ──────────────────────────────────────────────────────────────
    if (body.action === "clock_in") {
      const existing = await getActiveShift(payload.orgId, payload.sub);
      if (existing) return Response.json({ error: "You already have an active shift." }, { status: 409 });

      const [books, slots] = await Promise.all([
        listBooks(payload.orgId),
        listSlots(payload.orgId),
      ]);

      const slotByBookId: Record<string, number> = {};
      for (const s of slots) if (s.bookId) slotByBookId[s.bookId as string] = s.slotNum as number;
      const emptySlots = slots.filter((s) => !s.bookId).map((s) => s.slotNum as number).sort((a, b) => a - b);

      const resolvedEntries: { serial: string; ticketStart: number; slotNum: number; bookId: string }[] = [];
      let emptySlotIdx = 0;

      for (const entry of body.entries) {
        let book: (typeof books)[number] | undefined;
        let ticketNum: number;
        let resolvedBookNum: string;

        if ("bookId" in entry) {
          // Direct entry: slotNum + bookId + ticketStart (no serial scan)
          book = books.find((b) => b.bookId === entry.bookId);
          if (!book) {
            return Response.json({ error: `Book not found: ${entry.bookId}.` }, { status: 404 });
          }
          if (entry.ticketStart !== (book.ticketStart as number)) {
            return Response.json({
              error: `Wrong starting ticket. Expected #${book.ticketStart as number}, got #${entry.ticketStart}.`,
            }, { status: 422 });
          }
          ticketNum = entry.ticketStart;
          resolvedBookNum = String(book.pack ?? book.bookId);
          resolvedEntries.push({
            serial:      "",
            ticketStart: ticketNum,
            slotNum:     entry.slotNum,
            bookId:      entry.bookId,
          });
          continue;
        }

        // Serial-based entry
        const parsed = parseSerial(entry.serial)!;
        book = books.find(
          (b) => String(b.gameId) === parsed.gameId && String(b.pack) === parsed.bookNum
        );
        resolvedBookNum = parsed.bookNum;
        if (!book) {
          return Response.json({
            error: `Book not found for serial ${entry.serial}. Make sure you're scanning a ticket from your store.`,
          }, { status: 404 });
        }

        // Cross-verify starting ticket
        if (parsed.ticketNum !== (book.ticketStart as number)) {
          return Response.json({
            error: `Wrong starting ticket for book ${parsed.bookNum}. Inventory expects ticket #${book.ticketStart as number}. Please scan that ticket.`,
          }, { status: 422 });
        }
        ticketNum = parsed.ticketNum;

        let slotNum = entry.slotNum ?? slotByBookId[book.bookId as string];

        if (!slotNum) {
          // Auto-assign to next empty slot
          if (emptySlotIdx >= emptySlots.length) {
            return Response.json({
              error: "No empty slots available for auto-assignment. Ask your manager to free a slot.",
            }, { status: 422 });
          }
          slotNum = emptySlots[emptySlotIdx++];
          await upsertSlot(payload.orgId, slotNum, book.bookId as string);
          await createNotification(payload.orgId, {
            type:     "auto_slot_assigned",
            severity: "important",
            message:  `Book ${resolvedBookNum} had no slot — auto-assigned to Slot #${slotNum} by ${payload.name} at clock-in.`,
            empName:  payload.name,
            empSub:   payload.sub,
            detail:   { bookId: book.bookId, bookNum: resolvedBookNum, slotNum },
          });
        }

        resolvedEntries.push({
          serial:      entry.serial,
          ticketStart: ticketNum,
          slotNum,
          bookId:      book.bookId as string,
        });
      }

      // Use first entry's slot/ticket as primary shift anchor; store all in shiftBooks
      const primary = resolvedEntries[0];
      const shift = await clockIn(
        payload.orgId, payload.sub, payload.name,
        primary.ticketStart, primary.slotNum,
      );

      // Attach all book entries to shift record
      await db.send(new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `ORG#${payload.orgId}`, SK: `SHIFT#${payload.sub}#${shift.shiftId}` },
        UpdateExpression: "SET shiftBooks = :sb",
        ExpressionAttributeValues: { ":sb": resolvedEntries },
      }));

      return Response.json({ shift: { ...shift, shiftBooks: resolvedEntries } }, { status: 201 });
    }

    // ── Book Sold Out ─────────────────────────────────────────────────────────
    if (body.action === "book_sold_out") {
      await updateBook(payload.orgId, body.bookId, { status: "settled", settledAt: new Date().toISOString() });

      if (body.newBookSerial) {
        const parsed = parseSerial(body.newBookSerial)!;
        const books  = await listBooks(payload.orgId);
        const book   = books.find((b) => String(b.gameId) === parsed.gameId && String(b.pack) === parsed.bookNum);
        if (book) {
          await upsertSlot(payload.orgId, body.slotNum, book.bookId as string);
        }
      } else {
        await upsertSlot(payload.orgId, body.slotNum, null);
      }

      await createNotification(payload.orgId, {
        type:     "book_sold_out",
        severity: "important",
        message:  `Book sold out on Slot #${body.slotNum}${body.newBookSerial ? " — new book auto-linked" : ""} — reported by ${payload.name}.`,
        empName:  payload.name,
        empSub:   payload.sub,
        detail:   { bookId: body.bookId, slotNum: body.slotNum, newBookSerial: body.newBookSerial },
      });

      return Response.json({ message: "Book marked sold out." });
    }

    // ── Update Slot ───────────────────────────────────────────────────────────
    if (body.action === "update_slot") {
      await upsertSlot(payload.orgId, body.slotNum, body.bookId);
      await createNotification(payload.orgId, {
        type:     "slot_updated_by_employee",
        severity: "warning",
        message:  `Slot #${body.slotNum} was updated by employee ${payload.name}${body.bookId ? ` — assigned book ${body.bookId}` : " — cleared"}.`,
        empName:  payload.name,
        empSub:   payload.sub,
        detail:   { slotNum: body.slotNum, bookId: body.bookId },
      });
      return Response.json({ message: "Slot updated." });
    }

    // ── Notify Slot Change ────────────────────────────────────────────────────
    if (body.action === "notify_slot_change") {
      await createNotification(payload.orgId, {
        type:     body.priority ? "slot_not_assigned_priority" : "slot_change_requested",
        severity: body.priority ? "emergency" : "warning",
        message:  body.message ?? `${payload.name} flagged Slot #${body.slotNum} — book may need to be updated.`,
        empName:  payload.name,
        empSub:   payload.sub,
        detail:   { slotNum: body.slotNum, priority: body.priority ?? false },
      });
      return Response.json({ message: body.priority ? "Priority error sent to manager." : "Manager notified." });
    }

    // ── Clock Out ─────────────────────────────────────────────────────────────
    {
      const b = body as z.infer<typeof clockOutSchema>;

      // Calculate total sale from shiftBooks
      const activeShift = await getActiveShift(payload.orgId, payload.sub);
      if (!activeShift) return Response.json({ error: "No active shift found." }, { status: 404 });

      const shiftBooks = (activeShift.shiftBooks as { bookId: string; ticketStart: number; slotNum: number }[]) ?? [];
      const allBooks   = await listBooks(payload.orgId);
      const bookPriceMap: Record<string, number> = {};
      for (const bk of allBooks) bookPriceMap[bk.bookId as string] = bk.price as number;

      // Sum tickets sold across all books in shift
      let totalTicketSale = 0;
      if (shiftBooks.length > 0) {
        for (const sb of shiftBooks) {
          const price   = bookPriceMap[sb.bookId] ?? 0;
          const endTick = b.ticketEnd; // end ticket applies to last/primary book
          const sold    = Math.max(0, endTick - sb.ticketStart);
          totalTicketSale += sold * price;
        }
      } else {
        // Legacy single-book shift
        const singleBookId = (activeShift.shiftBooks as undefined) ?? null;
        const slotN        = activeShift.slotNum as number;
        const slots        = await listSlots(payload.orgId);
        const slot         = slots.find((s) => (s.slotNum as number) === slotN);
        const bkId         = slot?.bookId as string | undefined;
        const price        = bkId ? (bookPriceMap[bkId] ?? 0) : 0;
        void singleBookId;
        totalTicketSale = Math.max(0, b.ticketEnd - (activeShift.ticketStart as number)) * price;
      }

      const onlineNet     = b.salesReceipt?.onlineNetSales  ?? 0;
      const cashlessInst  = b.salesReceipt?.cashlessInstant ?? 0;
      const totalCashes   = b.cashesReceipt?.totalCashes    ?? 0;
      const finalCalc     = totalTicketSale + onlineNet + cashlessInst - totalCashes;
      const diff          = finalCalc - b.drawerCash;
      const tolerance     = 0.005;

      let discrepancySeverity: "none" | "over" | "short" = "none";
      if (Math.abs(diff) > tolerance) discrepancySeverity = diff > 0 ? "over" : "short";

      // Mark books sold out if flagged
      if (b.booksSoldOut?.length) {
        await Promise.all(
          b.booksSoldOut.map((bso) =>
            updateBook(payload.orgId, bso.bookId, { status: "settled", settledAt: new Date().toISOString() })
          )
        );
      }

      await clockOut(payload.orgId, payload.sub, b.shiftId, {
        ticketEnd:          b.ticketEnd,
        salesReceipt:       b.salesReceipt as Record<string, unknown> | undefined,
        cashesReceipt:      b.cashesReceipt as Record<string, unknown> | undefined,
        finalCalc,
        drawerCash:         b.drawerCash,
        discrepancyNote:    b.discrepancyNote,
        discrepancySeverity,
      });

      // Send manager notifications based on discrepancy
      if (discrepancySeverity === "over") {
        await createNotification(payload.orgId, {
          type:     "shift_discrepancy_over",
          severity: "emergency",
          message:  `SHIFT DISCREPANCY — ${payload.name}'s shift shows $${Math.abs(diff).toFixed(2)} MORE than drawer. Immediate review required.`,
          empName:  payload.name,
          empSub:   payload.sub,
          detail:   { finalCalc, drawerCash: b.drawerCash, diff, note: b.discrepancyNote },
        });
      } else if (discrepancySeverity === "short") {
        await createNotification(payload.orgId, {
          type:     "shift_discrepancy_short",
          severity: "warning",
          message:  `Shift note — ${payload.name}'s drawer is $${Math.abs(diff).toFixed(2)} over calculated amount. Please review.`,
          empName:  payload.name,
          empSub:   payload.sub,
          detail:   { finalCalc, drawerCash: b.drawerCash, diff },
        });
      }

      return Response.json({
        message:  "Clocked out successfully.",
        finalCalc,
        drawerCash: b.drawerCash,
        discrepancySeverity,
        diff,
      });
    }
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    return errResponse(err);
  }
}
