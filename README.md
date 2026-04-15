# LottoGuard — Lottery Fraud Prevention SaaS

Ohio Lottery scratch-off fraud prevention for gas stations & convenience stores.

## Stack
Next.js 16 (App Router) · AWS Cognito · DynamoDB · S3 · OpenAI Vision · Tailwind v4 · ShadCN · Phosphor Icons

## Roles
| Role | Access |
|------|--------|
| Owner/Manager | Full dashboard — inventory, slots, employees, settings |
| Employee | Clock in/out, shift tracking, ticket counts |

## Pages
| Route | Description |
|-------|-------------|
| `/` | Landing — login/signup entry point |
| `/owner` | Owner dashboard |
| `/owner/signup` | Organization onboarding |
| `/employee` | Employee dashboard |
| `/employee/register` | Employee registration with invite code |

## Owner Dashboard Sections
- **Inventory** — manual entry or camera → S3 → OpenAI Vision extraction
- **Activate / Deactivate / Settle** — lottery book lifecycle
- **Slots** — visual grid, book assignments
- **Employee Management** — approve/reject/disable employees
- **Settings** — org profile

## Shift Flow (Employee)
1. Clock in → enter starting ticket number
2. Work shift
3. Clock out → enter ending ticket number → system calculates sold

## Security
- All API routes validate Cognito JWT
- Role-based route protection (owner ↔ employee)
- S3 uploads via presigned URLs only
- DynamoDB PK/SK single-table design
- Input sanitization on all forms

## Data Model (DynamoDB — Single Table)
```
PK                    SK                    Entity
ORG#{orgId}           PROFILE               Organization
ORG#{orgId}           OWNER#{ownerId}        Owner
ORG#{orgId}           EMP#{empId}            Employee
ORG#{orgId}           BOOK#{bookId}          LotteryBook
ORG#{orgId}           SLOT#{slotNum}         Slot
ORG#{orgId}           SHIFT#{shiftId}        Shift
```

## Getting Started
```bash
npm install
cp .env.example .env.local   # fill Cognito, DynamoDB, S3, OpenAI keys
npm run dev
```
