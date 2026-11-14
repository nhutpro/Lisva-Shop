# 001 Database: Table Diagram

All tables for release 1. PK = primary key, FK = foreign key, UK = unique. Lines show relationships (one, zero-or-one, many). Details and rules are in [plan.md](plan.md).

```mermaid
erDiagram
  Category ||--o{ Category : "parent of"
  Category ||--o{ Product : contains
  Brand ||--o{ Product : makes
  Product ||--o{ ProductColor : "has colors"
  Product ||--|{ ProductVariant : "has variants"
  ProductColor |o--o{ ProductVariant : "color of"
  Size |o--o{ ProductVariant : "size of"
  Product ||--o{ ProductImage : "has photos"
  ProductVariant |o--o{ ProductImage : "photos of"
  ProductColor |o--o{ ProductImage : "photos of"

  User ||--o{ Address : "saves"
  User ||--o{ Account : "login via"
  User ||--o{ Session : "has"
  User |o--o{ Order : "places"
  User |o--o{ OrderNote : "writes"
  User |o--o{ OrderStatusHistory : "changes"

  Order ||--|{ OrderItem : contains
  ProductVariant |o--o{ OrderItem : "bought as"
  Order ||--o{ OrderStatusHistory : logs
  Order ||--o{ OrderNote : "has notes"

  Category {
    string id PK
    string slug UK
    string nameVi
    string nameEn "nullable"
    string parentId FK "nullable"
    int position
    string imageUrl "nullable"
  }

  Brand {
    string id PK
    string slug UK
    string name
    string skuPrefix "e.g. NIKE"
    string logoUrl "nullable"
  }

  Product {
    string id PK
    string slug UK
    string categoryId FK
    string brandId FK
    string nameVi
    string nameEn "nullable"
    string descriptionVi "nullable"
    string descriptionEn "nullable"
    int price "VND"
    int compareAtPrice "nullable, original price"
    string status "DRAFT, ACTIVE, ARCHIVED"
    json specs "spec table vi and en"
    string searchText "no diacritics"
    boolean featured
    datetime publishedAt "nullable"
  }

  ProductColor {
    string id PK
    string productId FK
    string nameVi
    string nameEn "nullable"
    string hex "nullable swatch"
    int position
  }

  Size {
    string id PK
    string type "SHOE or WATCH"
    string label "42 or 40mm"
    int position
    decimal footLengthCm "nullable"
    string usSize "nullable"
  }

  ProductVariant {
    string id PK
    string productId FK
    string colorId FK "nullable"
    string sizeId FK "nullable"
    string sku UK
    int price "nullable, overrides product"
    int stock
    boolean isActive
    int position
  }

  ProductImage {
    string id PK
    string productId FK
    string variantId FK "nullable"
    string colorId FK "nullable"
    string url
    string altVi "nullable"
    string altEn "nullable"
    int position
  }

  User {
    string id PK
    string email UK
    string name "nullable"
    string phone "nullable"
    string passwordHash "nullable"
    string role "CUSTOMER or ADMIN"
    string locale
  }

  Address {
    string id PK
    string userId FK
    string recipientName
    string phone
    string province
    string district
    string ward
    string street
    boolean isDefault
  }

  Account {
    string id PK
    string userId FK
    string provider "Auth.js, e.g. google"
    string providerAccountId
  }

  Session {
    string id PK
    string userId FK
    string sessionToken UK
    datetime expires
  }

  Order {
    string id PK
    string code UK "LV-2611-7KQ2"
    string userId FK "nullable, guests allowed"
    string customerName
    string phone
    string email "nullable"
    string preferredContact "PHONE or ZALO"
    string province
    string district
    string ward
    string street
    string customerNote "nullable"
    string locale
    string status "PENDING_CONTACT to COMPLETED or CANCELLED"
    int subtotal
    int shippingFee "nullable until quoted"
    int total
    string paymentStatus "UNPAID or PAID"
    string paymentMethod "nullable"
    datetime paidAt "nullable"
    string paymentNote "nullable"
    boolean stockDeducted
    datetime adminSeenAt "null means new"
    datetime createdAt
  }

  OrderItem {
    string id PK
    string orderId FK
    string variantId FK "nullable, set null on delete"
    string productName "copy"
    string colorName "copy, nullable"
    string sizeLabel "copy, nullable"
    string sku "copy"
    string imageUrl "copy, nullable"
    int unitPrice "copy"
    int quantity
    int lineTotal
  }

  OrderStatusHistory {
    string id PK
    string orderId FK
    string fromStatus "nullable"
    string toStatus
    string changedById FK "nullable"
    datetime createdAt
  }

  OrderNote {
    string id PK
    string orderId FK
    string authorId FK "nullable"
    string body "private to owner"
    datetime createdAt
  }
```

## Groups
| Group | Tables |
|---|---|
| Catalog | Category, Brand, Product, ProductColor, Size, ProductVariant, ProductImage |
| People | User, Address, Account, Session (Auth.js also adds VerificationToken) |
| Orders | Order, OrderItem, OrderStatusHistory, OrderNote |

Every table also has `createdAt` and `updatedAt` unless shown otherwise.
