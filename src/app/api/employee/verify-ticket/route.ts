import { requireEmployee, errResponse } from "@/lib/validate";
import { listBooks, listSlots } from "@/lib/db";

const SERIAL_RE = /^(\d{4})-(\d{7})-(\d{3})-\d$/;

export async function GET(req: Request) {
  try {
    const { orgId } = await requireEmployee();

    const { searchParams } = new URL(req.url);
    const serial = searchParams.get("serial")?.trim() ?? "";

    if (!SERIAL_RE.test(serial)) {
      return Response.json({ error: "Invalid serial format. Expected GGGG-BBBBBBB-TTT-C." }, { status: 400 });
    }

    const [, gameId, bookNum, ticketStr] = SERIAL_RE.exec(serial)!;
    const scannedTicket = parseInt(ticketStr, 10);

    const [books, slots] = await Promise.all([
      listBooks(orgId),
      listSlots(orgId),
    ]);

    // Find book in inventory
    const book = books.find(
      (b) => String(b.gameId) === gameId && String(b.pack) === bookNum
    );

    if (!book) {
      return Response.json({
        valid:   false,
        reason:  "not_found",
        message: "Book not found. Make sure you're scanning a ticket from your store.",
      }, { status: 404 });
    }

    if (book.status === "settled") {
      return Response.json({
        valid:   false,
        reason:  "settled",
        message: `Book ${bookNum} is already settled and cannot be used for a new shift.`,
      }, { status: 422 });
    }

    // Find the slot the manager allocated this book to
    const slot = slots.find((s) => s.bookId === book.bookId);

    if (!slot) {
      return Response.json({
        valid:    false,
        reason:   "no_slot",
        message:  `Book ${bookNum} is not assigned to any slot. Ask your manager to assign it first, or it will be auto-assigned when you start the shift.`,
        bookId:   book.bookId,
        gameId,
        bookNum,
        gameName: book.gameName ?? "",
        price:    book.price ?? 0,
        ticketStart: book.ticketStart ?? 0,
      });
    }

    // Cross-verify: scanned ticket must match manager's inventory starting ticket
    const inventoryStart = book.ticketStart as number;
    if (scannedTicket !== inventoryStart) {
      return Response.json({
        valid:    false,
        reason:   "wrong_ticket",
        message:  `Wrong starting ticket. Slot #${slot.slotNum as number} expects ticket #${inventoryStart} — you scanned #${scannedTicket}.`,
        slotNum:  slot.slotNum,
        bookId:   book.bookId,
        gameName: book.gameName ?? "",
        price:    book.price ?? 0,
        inventoryStart,
      }, { status: 422 });
    }

    // All good
    return Response.json({
      valid:       true,
      slotNum:     slot.slotNum,
      bookId:      book.bookId,
      gameId,
      bookNum,
      gameName:    book.gameName  ?? "",
      price:       book.price     ?? 0,
      ticketStart: inventoryStart,
      status:      book.status,
    });
  } catch (err) {
    return errResponse(err);
  }
}
