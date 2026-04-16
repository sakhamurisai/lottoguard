/**
 * Single-table DynamoDB helpers.
 *
 * Key schema:
 *   PK                 SK                       Entity
 *   ORG#{orgId}        PROFILE                  Organization
 *   ORG#{orgId}        OWNER#{sub}              Owner
 *   ORG#{orgId}        EMP#{sub}                Employee
 *   ORG#{orgId}        BOOK#{bookId}            LotteryBook
 *   ORG#{orgId}        SLOT#{num}               Slot
 *   ORG#{orgId}        SHIFT#{empSub}#{id}      Shift
 *
 *   GSI1 (UserIndex):  GSI1PK = USER#{sub}       → locate user's org
 *   GSI2 (EmployeeIndex): GSI2PK = EMP#{sub}     → employee shift history
 */

import {
  GetCommand, PutCommand, UpdateCommand, QueryCommand, ScanCommand,
  TransactWriteCommand, DeleteCommand,
  type TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { db, TABLE, GSI_USER, GSI_EMP } from "./aws";
import { randomUUID } from "crypto";

// ── Keys ──────────────────────────────────────────────────────────────────────

export const k = {
  org:      (id: string)                          => ({ PK: `ORG#${id}`, SK: "PROFILE" }),
  owner:    (orgId: string, sub: string)           => ({ PK: `ORG#${orgId}`, SK: `OWNER#${sub}` }),
  emp:      (orgId: string, sub: string)           => ({ PK: `ORG#${orgId}`, SK: `EMP#${sub}` }),
  book:     (orgId: string, id: string)            => ({ PK: `ORG#${orgId}`, SK: `BOOK#${id}` }),
  shipment: (orgId: string, id: string)            => ({ PK: `ORG#${orgId}`, SK: `SHIPMENT#${id}` }),
  slot:     (orgId: string, num: number)           => ({ PK: `ORG#${orgId}`, SK: `SLOT#${String(num).padStart(3,"0")}` }),
  shift:    (orgId: string, sub: string, id: string) => ({ PK: `ORG#${orgId}`, SK: `SHIFT#${sub}#${id}` }),
};

// ── Generic get ───────────────────────────────────────────────────────────────

export async function getItem<T>(pk: string, sk: string): Promise<T | null> {
  const res = await db.send(new GetCommand({ TableName: TABLE, Key: { PK: pk, SK: sk } }));
  return (res.Item as T) ?? null;
}

// ── User lookup by Cognito sub (GSI1) ────────────────────────────────────────

export async function getUserBySub(sub: string) {
  // Primary: GSI query (fast)
  try {
    const res = await db.send(new QueryCommand({
      TableName: TABLE,
      IndexName: GSI_USER,
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: { ":pk": `USER#${sub}` },
      Limit: 1,
    }));
    if (res.Items?.length) return res.Items[0];
  } catch (e) {
    console.warn("GSI query failed, falling back to scan:", e);
  }

  // Fallback: full table scan filtered by sub field.
  // NOTE: No Limit — Limit caps items *evaluated*, not items *returned*,
  // so Limit: 10 would miss a user whose record is the 11th item scanned.
  let lastKey: Record<string, unknown> | undefined;
  do {
    const fallback = await db.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: "#s = :sub",
      ExpressionAttributeNames: { "#s": "sub" },
      ExpressionAttributeValues: { ":sub": sub },
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
    }));
    if (fallback.Items?.length) return fallback.Items[0];
    lastKey = fallback.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);
  return null;
}

// ── Org ───────────────────────────────────────────────────────────────────────

export async function createOrg(data: {
  orgId: string; orgName: string; llcName: string; address: string;
  retailNum: string; phone: string; slots: number; inviteCode: string;
}) {
  await db.send(new PutCommand({
    TableName: TABLE,
    Item: { ...k.org(data.orgId), ...data, createdAt: new Date().toISOString() },
    ConditionExpression: "attribute_not_exists(PK)",
  }));
}

export async function getOrg(orgId: string) {
  return getItem<Record<string, unknown>>(k.org(orgId).PK, "PROFILE");
}

export async function updateOrg(orgId: string, fields: Record<string, unknown>) {
  const entries = Object.entries(fields);
  const expr = entries.map((_, i) => `#f${i} = :v${i}`).join(", ");
  const names = Object.fromEntries(entries.map(([k], i) => [`#f${i}`, k]));
  const values = Object.fromEntries(entries.map(([, v], i) => [`:v${i}`, v]));
  await db.send(new UpdateCommand({
    TableName: TABLE,
    Key: k.org(orgId),
    UpdateExpression: `SET ${expr}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

// ── Find org by invite code ───────────────────────────────────────────────────

export async function getOrgByInviteCode(code: string) {
  // Scan with filter — invite code validation is low-volume so scan is acceptable
  const res = await db.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: "SK = :sk AND inviteCode = :code",
    ExpressionAttributeValues: { ":sk": "PROFILE", ":code": code },
  }));
  return res.Items?.[0] ?? null;
}

// ── Owner / Employee ──────────────────────────────────────────────────────────

export async function createOwner(orgId: string, sub: string, data: { name: string; email: string }) {
  await db.send(new PutCommand({
    TableName: TABLE,
    Item: {
      ...k.owner(orgId, sub),
      GSI1PK: `USER#${sub}`,
      orgId, sub, role: "owner",
      ...data,
      createdAt: new Date().toISOString(),
    },
  }));
}

export async function createEmployee(orgId: string, sub: string, data: { name: string; email: string; phone: string }) {
  await db.send(new PutCommand({
    TableName: TABLE,
    Item: {
      ...k.emp(orgId, sub),
      GSI1PK: `USER#${sub}`,
      orgId, sub, role: "employee", status: "pending",
      ...data,
      createdAt: new Date().toISOString(),
    },
  }));
}

export async function listEmployees(orgId: string) {
  const res = await db.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": `ORG#${orgId}`, ":prefix": "EMP#" },
  }));
  return res.Items ?? [];
}

export async function updateEmployee(orgId: string, sub: string, fields: Record<string, unknown>) {
  const entries = Object.entries(fields);
  const expr = entries.map((_, i) => `#f${i} = :v${i}`).join(", ");
  const names = Object.fromEntries(entries.map(([k], i) => [`#f${i}`, k]));
  const values = Object.fromEntries(entries.map(([, v], i) => [`:v${i}`, v]));
  await db.send(new UpdateCommand({
    TableName: TABLE,
    Key: k.emp(orgId, sub),
    UpdateExpression: `SET ${expr}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

// ── Books ─────────────────────────────────────────────────────────────────────

export async function listBooks(orgId: string) {
  const res = await db.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": `ORG#${orgId}`, ":prefix": "BOOK#" },
  }));
  return res.Items ?? [];
}

export async function createBook(orgId: string, data: {
  gameId: string; gameName: string; pack: string;
  ticketStart: number; ticketEnd: number; price: number;
  shipmentId?: string | null;
}) {
  const bookId = randomUUID();
  const item = {
    ...k.book(orgId, bookId),
    orgId, bookId, status: "inactive", slot: null,
    activatedAt: null, settledAt: null,
    ...data,
    createdAt: new Date().toISOString(),
  };
  await db.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

export async function updateBook(orgId: string, bookId: string, fields: Record<string, unknown>) {
  const entries = Object.entries(fields);
  const expr = entries.map((_, i) => `#f${i} = :v${i}`).join(", ");
  const names = Object.fromEntries(entries.map(([k], i) => [`#f${i}`, k]));
  const values = Object.fromEntries(entries.map(([, v], i) => [`:v${i}`, v]));
  await db.send(new UpdateCommand({
    TableName: TABLE,
    Key: k.book(orgId, bookId),
    UpdateExpression: `SET ${expr}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

export async function deleteBook(orgId: string, bookId: string) {
  await db.send(new DeleteCommand({ TableName: TABLE, Key: k.book(orgId, bookId) }));
}

// ── Shipments ─────────────────────────────────────────────────────────────────

export async function createShipment(orgId: string, data: Record<string, unknown>) {
  const shipmentId = randomUUID();
  const item = {
    ...k.shipment(orgId, shipmentId),
    orgId, shipmentId, ...data,
    createdAt: new Date().toISOString(),
  };
  await db.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

export async function listShipments(orgId: string) {
  const res = await db.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": `ORG#${orgId}`, ":prefix": "SHIPMENT#" },
  }));
  const items = res.Items ?? [];
  return items.sort((a, b) =>
    new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()
  );
}

export async function updateShipment(orgId: string, shipmentId: string, fields: Record<string, unknown>) {
  const entries = Object.entries(fields);
  const expr   = entries.map((_, i) => `#f${i} = :v${i}`).join(", ");
  const names  = Object.fromEntries(entries.map(([k], i) => [`#f${i}`, k]));
  const values = Object.fromEntries(entries.map(([, v], i) => [`:v${i}`, v]));
  await db.send(new UpdateCommand({
    TableName: TABLE,
    Key: k.shipment(orgId, shipmentId),
    UpdateExpression: `SET ${expr}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

export async function deleteShipment(orgId: string, shipmentId: string) {
  await db.send(new DeleteCommand({ TableName: TABLE, Key: k.shipment(orgId, shipmentId) }));
}

// ── Slots ─────────────────────────────────────────────────────────────────────

export async function listSlots(orgId: string) {
  const res = await db.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": `ORG#${orgId}`, ":prefix": "SLOT#" },
  }));
  return res.Items ?? [];
}

export async function upsertSlot(orgId: string, slotNum: number, bookId: string | null) {
  await db.send(new PutCommand({
    TableName: TABLE,
    Item: { ...k.slot(orgId, slotNum), orgId, slotNum, bookId, updatedAt: new Date().toISOString() },
  }));
}

// ── Shifts ────────────────────────────────────────────────────────────────────

export async function getActiveShift(orgId: string, sub: string) {
  const res = await db.send(new QueryCommand({
    TableName: TABLE,
    IndexName: GSI_EMP,
    KeyConditionExpression: "GSI2PK = :pk",
    FilterExpression: "#s = :active",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: { ":pk": `EMP#${sub}`, ":active": "active" },
    Limit: 1,
  }));
  return res.Items?.[0] ?? null;
}

export async function listShifts(orgId: string, sub: string, limit = 20) {
  const res = await db.send(new QueryCommand({
    TableName: TABLE,
    IndexName: GSI_EMP,
    KeyConditionExpression: "GSI2PK = :pk",
    ExpressionAttributeValues: { ":pk": `EMP#${sub}` },
    ScanIndexForward: false,
    Limit: limit,
  }));
  return res.Items ?? [];
}

export async function clockIn(orgId: string, sub: string, empName: string, ticketStart: number, slotNum: number) {
  const shiftId = randomUUID();
  const item = {
    ...k.shift(orgId, sub, shiftId),
    GSI2PK: `EMP#${sub}`,
    GSI2SK: `SHIFT#${shiftId}`,
    orgId, shiftId, empSub: sub, empName, slotNum,
    ticketStart, clockIn: new Date().toISOString(), status: "active",
  };
  await db.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

// ── Delivery Receipts ─────────────────────────────────────────────────────────

export async function createDeliveryReceipt(orgId: string, data: Record<string, unknown>) {
  const id = randomUUID();
  await db.send(new PutCommand({
    TableName: TABLE,
    Item: { PK: `ORG#${orgId}`, SK: `DELIVERY#${id}`, orgId, id, ...data, createdAt: new Date().toISOString() },
  }));
  return id;
}

export async function listDeliveryReceipts(orgId: string, limit = 20) {
  const res = await db.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": `ORG#${orgId}`, ":prefix": "DELIVERY#" },
    ScanIndexForward: false,
    Limit: limit,
  }));
  return res.Items ?? [];
}

// ── Confirm Order Receipts ────────────────────────────────────────────────────

export async function createOrderReceipt(orgId: string, data: Record<string, unknown>) {
  const id = randomUUID();
  await db.send(new PutCommand({
    TableName: TABLE,
    Item: { PK: `ORG#${orgId}`, SK: `CONFORDER#${id}`, orgId, id, ...data, createdAt: new Date().toISOString() },
  }));
  return id;
}

export async function listOrderReceipts(orgId: string, limit = 20) {
  const res = await db.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": `ORG#${orgId}`, ":prefix": "CONFORDER#" },
    ScanIndexForward: false,
    Limit: limit,
  }));
  return res.Items ?? [];
}

// ── Activation / Deactivation Logs ───────────────────────────────────────────

export async function createActivationLog(orgId: string, data: Record<string, unknown>) {
  const id = randomUUID();
  await db.send(new PutCommand({
    TableName: TABLE,
    Item: { PK: `ORG#${orgId}`, SK: `ACTLOG#${id}`, orgId, id, ...data, createdAt: new Date().toISOString() },
  }));
  return id;
}

export async function listActivationLogs(orgId: string, limit = 50) {
  const res = await db.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": `ORG#${orgId}`, ":prefix": "ACTLOG#" },
    ScanIndexForward: false,
    Limit: limit,
  }));
  return res.Items ?? [];
}

// ── Employee Shifts (by sub) ──────────────────────────────────────────────────

export async function listShiftsByEmployee(orgId: string, sub: string, limit = 30) {
  const res = await db.send(new QueryCommand({
    TableName: TABLE,
    IndexName: GSI_EMP,
    KeyConditionExpression: "GSI2PK = :pk",
    ExpressionAttributeValues: { ":pk": `EMP#${sub}` },
    ScanIndexForward: false,
    Limit: limit,
  }));
  return res.Items ?? [];
}

export async function clockOut(orgId: string, sub: string, shiftId: string, ticketEnd: number) {
  const now = new Date().toISOString();
  await db.send(new UpdateCommand({
    TableName: TABLE,
    Key: k.shift(orgId, sub, shiftId),
    UpdateExpression: "SET ticketEnd = :te, #s = :done, clockOut = :co",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: { ":te": ticketEnd, ":done": "completed", ":co": now },
  }));
}
