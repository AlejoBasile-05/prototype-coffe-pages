# Modelo de datos — Mi Negocio

> Espejo de `prisma/schema.prisma` (Tarea 03). Si este diagrama y el schema
> divergen, gana el schema y se corrige este documento en el mismo commit.

```mermaid
erDiagram
    Category ||--o{ Product : "agrupa"
    Product ||--o{ ProductVariant : "ofrece"
    Category {
        string id PK
        string name
        string slug UK
        int    position
        bool   isVisible
    }
    Product {
        string  id PK
        string  name
        string  slug UK
        decimal price "numeric(10,2) · CHECK >= 0"
        string  imageUrl
        string  imagePublicId "nullable: id del asset en Cloudinary"
        bool    isAvailable "stock en vivo"
        string  status "DRAFT|PUBLISHED|ARCHIVED"
        bool    isFeatured
        int     sortOrder
        string  allergens "text[] · glosario cerrado (Tarea 00 §5)"
        string  categoryId FK
    }
    ProductVariant {
        string  id PK
        string  name
        decimal priceDelta "delta sobre price; admite negativos"
        bool    isAvailable
        string  productId FK
    }
    BusinessSettings {
        string id PK "siempre 1 (singleton)"
        string name
        string whatsappPhone "E.164 sin +"
        string address
        json   openingHours
        string closingMessage
        string legalNotice
    }
    StaffMember {
        string id PK "= auth.users.id"
        string email UK
        string role "OWNER|STAFF"
    }
```

**Reglas de lectura del modelo:**

- El catálogo público lee **únicamente** `status = 'PUBLISHED'`.
- `isAvailable` filtra la capa de disponibilidad, no la de publicación.
- No existe `Order`: el pedido se materializa en el WhatsApp del local.
- **`ProductVariant` está sin uso en v1** (decisión D-02, Tarea 00): ningún
  repositorio ni UI lo consume. Se conserva en el modelado porque D-02 lo
  permite como vía de retrofit sin migración destructiva; agregar variantes
  reales exige reabrir esa decisión de negocio.
- `products.price` lleva `CHECK (price >= 0)` a nivel base
  (`products_price_non_negative`); `.priceDelta` admite negativos a propósito
  (un descuento por variante).
- `Category.products` usa `onDelete: Restrict` (no se borra una categoría con
  productos asignados); `ProductVariant.product` usa `onDelete: Cascade`
  (borrar el producto borra sus variantes).
- `StaffMember` replica `auth.users.id` y **no** almacena credenciales: eso
  es de Supabase Auth. Esta tabla solo autoriza.
