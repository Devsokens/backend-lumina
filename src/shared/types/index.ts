/**
 * Types TypeScript globaux partagés dans tout le projet Lumina.
 * Règle .antigravityrules : le type `any` est proscrit.
 */

// ============================================================
// ENUMS (miroir des ENUMs PostgreSQL)
// ============================================================

export enum OrganizationSector {
  RESTAURANT = 'restaurant',
  SHOP = 'shop',
  EVENT = 'event',
}

export enum SubscriptionStatus {
  FREE = 'free',
  BASIC = 'basic',
  PRO = 'pro',
  SUSPENDED = 'suspended',
}

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ORG_ADMIN = 'org_admin',
  MANAGER = 'manager',
  CASHIER = 'cashier',
  WAITER = 'waiter',
  KITCHEN_STAFF = 'kitchen_staff',
  STOCK_MANAGER = 'stock_manager',
  EVENT_SCANNER = 'event_scanner',
}

export enum PaymentMethod {
  CASH = 'cash',
  MOBILE_MONEY = 'mobile_money',
  CARD = 'card',
}

export enum TransactionType {
  SALE = 'sale',
  EXPENSE = 'expense',
  REFUND = 'refund',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum OrderStatus {
  PENDING = 'pending',
  PREPARING = 'preparing',
  READY = 'ready',
  SERVED = 'served',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

export enum InventoryMovementType {
  SUPPLY = 'supply',
  SALE = 'sale',
  RETURN = 'return',
  ADJUSTMENT = 'adjustment',
  BREAKAGE = 'breakage',
}

export enum PurchaseOrderStatus {
  DRAFT = 'draft',
  ORDERED = 'ordered',
  RECEIVED = 'received',
  CANCELLED = 'cancelled',
}

export enum TicketPaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  REFUNDED = 'refunded',
}

export enum AuditAction {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

// ============================================================
// INTERFACES DES ENTITÉS
// ============================================================

export interface Organization {
  id: string;
  name: string;
  sector: OrganizationSector;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPlan: string;
  settings: Record<string, unknown>;
  createdAt: Date;
}

export interface User {
  id: string;
  organizationId: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface JwtPayload {
  sub: string;           // userId
  organizationId: string;
  role: UserRole;
  sector: OrganizationSector;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
