-- ============================================================
-- SCHÉMA DE LA BASE DE DONNÉES LUMINA (POSTGRESQL / SUPABASE)
-- Règles: Multi-tenancy stricte (RLS) et Audit log obligatoire.
-- ============================================================

-- ─── EXTENSIONS ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── ENUMS ────────────────────────────────────────────────
CREATE TYPE organization_sector AS ENUM ('restaurant', 'shop', 'event');
CREATE TYPE subscription_status AS ENUM ('free', 'basic', 'pro', 'suspended');
CREATE TYPE user_role AS ENUM ('super_admin', 'org_admin', 'manager', 'cashier', 'waiter', 'kitchen_staff', 'stock_manager', 'event_scanner');
CREATE TYPE payment_method AS ENUM ('cash', 'mobile_money', 'card');
CREATE TYPE transaction_type AS ENUM ('sale', 'expense', 'refund');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed');
CREATE TYPE order_status AS ENUM ('pending', 'preparing', 'ready', 'served', 'paid', 'cancelled');
CREATE TYPE inventory_movement_type AS ENUM ('supply', 'sale', 'return', 'adjustment', 'breakage');
CREATE TYPE purchase_order_status AS ENUM ('draft', 'ordered', 'received', 'cancelled');
CREATE TYPE ticket_payment_status AS ENUM ('pending', 'paid', 'refunded');

-- ─── TABLES CENTRALES (CORE) ──────────────────────────────

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    sector organization_sector NOT NULL,
    subscription_status subscription_status DEFAULT 'free',
    subscription_plan VARCHAR(50) DEFAULT 'free',
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── PRODUITS & STOCKS ────────────────────────────────────

CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT '#6B7280',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    barcode VARCHAR(100),
    price NUMERIC(15, 2) NOT NULL,
    cost_price NUMERIC(15, 2) DEFAULT 0,
    stock_quantity NUMERIC(15, 2) DEFAULT 0,
    alert_threshold NUMERIC(15, 2) DEFAULT 5,
    expiry_date DATE,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── FINANCE & AUDIT ──────────────────────────────────────

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    amount NUMERIC(15, 2) NOT NULL,
    payment_method payment_method NOT NULL,
    type transaction_type NOT NULL,
    status transaction_status DEFAULT 'completed',
    reference_id UUID,
    description TEXT,
    mobile_money_ref VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- INSERT, UPDATE, DELETE
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── MODULE RESTAURANT ────────────────────────────────────

CREATE TABLE tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    table_number VARCHAR(50) NOT NULL,
    capacity INT DEFAULT 4,
    qr_code_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
    staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status order_status DEFAULT 'pending',
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity NUMERIC(10, 2) NOT NULL,
    unit_price NUMERIC(15, 2) NOT NULL,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE order_cancellations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    cancelled_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    cancelled_items JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── MODULE MAGASIN ───────────────────────────────────────

CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type inventory_movement_type NOT NULL,
    quantity NUMERIC(15, 2) NOT NULL,
    unit_cost NUMERIC(15, 2),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    loyalty_points INT DEFAULT 0,
    total_spent NUMERIC(15, 2) DEFAULT 0,
    total_orders INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── MODULE ÉVÉNEMENTIEL ──────────────────────────────────

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    location VARCHAR(255) NOT NULL,
    capacity INT NOT NULL,
    ticket_price NUMERIC(15, 2) NOT NULL,
    is_published BOOLEAN DEFAULT FALSE,
    cover_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_email VARCHAR(255),
    qr_code_hash VARCHAR(255) NOT NULL UNIQUE,
    is_scanned BOOLEAN DEFAULT FALSE,
    scanned_at TIMESTAMP WITH TIME ZONE,
    scanned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    payment_status ticket_payment_status DEFAULT 'pending',
    payment_reference VARCHAR(255),
    certificate_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- FONCTIONS ET PROCÉDURES
-- ============================================================

-- Fonction pour ajuster le stock (incrément/décrément)
CREATE OR REPLACE FUNCTION adjust_stock(p_product_id UUID, p_organization_id UUID, p_delta NUMERIC)
RETURNS VOID AS $$
BEGIN
    UPDATE products
    SET stock_quantity = stock_quantity + p_delta
    WHERE id = p_product_id AND organization_id = p_organization_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour décrémenter le stock depuis le point de vente (Offline sync)
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_organization_id UUID, p_quantity NUMERIC)
RETURNS VOID AS $$
BEGIN
    UPDATE products
    SET stock_quantity = stock_quantity - p_quantity
    WHERE id = p_product_id AND organization_id = p_organization_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- INDEX D'OPTIMISATION
-- ============================================================

CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_products_org_active ON products(organization_id, is_active);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_transactions_org_date ON transactions(organization_id, created_at);
CREATE INDEX idx_orders_org_status ON orders(organization_id, status);
CREATE INDEX idx_tickets_hash ON tickets(qr_code_hash);


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Active la sécurité multi-tenant sur TOUTES les tables.
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Note : Les politiques RLS (Policies) peuvent être créées ici si l'accès
-- se fait via un client Supabase avec le jeton JWT de l'utilisateur.
-- Exemple (à adapter selon la configuration de Supabase Auth) :
-- CREATE POLICY "Isolation par Tenant" ON users FOR ALL USING (organization_id = auth.jwt()->>'organizationId'::uuid);
-- Cependant, puisque le backend NestJS utilise `adminClient` (service_role) pour beaucoup d'opérations et gère l'isolation
-- logiciellement via `TenantGuard` et le code métier, les politiques strictes ne sont pas obligatoires ici, mais recommandées.
