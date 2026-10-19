/**
 * Configuración del prototipo genérico.
 *
 * CAMBIAR ESTE ARCHIVO para adaptar a cualquier negocio.
 * No tocar el resto del código.
 */

export interface PrototypeConfig {
  // Identidad básica
  brand: {
    name: string;           // "Tu Negocio"
    tagline: string;        // "Productos artesanales. Pedí por WhatsApp."
    description: string;    // Para SEO/metadatos
  };

  // Ubicación (genérica, sin datos reales)
  location: {
    city: string;           // "Tu Ciudad"
    region: string;         // "Tu Provincia/Estado"
    countryCode: string;    // "AR" | "US" | "MX" | etc.
    phoneCountryCode: string; // "54" | "1" | "52" | etc.
  };

  // Moneda
  currency: {
    code: "ARS" | "USD" | "EUR" | "MXN" | string;
    locale: "es-AR" | "en-US" | "es-MX" | string;
    symbol: string;         // "$" | "US$" | "€" | etc.
  };

  // Terminología del dominio (lo que ve el usuario)
  terminology: {
    // Catálogo
    catalog: string;        // "Menú" | "Catálogo" | "Productos" | "Servicios"
    category: string;       // "Categoría" | "Sección" | "Colección"
    product: string;        // "Producto" | "Artículo" | "Servicio" | "Plato"
    featured: string;       // "Destacados" | "Recomendados" | "Populares"

    // Carrito/Checkout
    cart: string;           // "Carrito" | "Pedido" | "Orden" | "Bolsa"
    addToCart: string;      // "Agregar" | "Pedir" | "Solicitar"
    checkout: string;       // "Finalizar pedido" | "Comprar" | "Confirmar"

    // Pedido/Comanda
    order: string;          // "Pedido" | "Comanda" | "Orden" | "Solicitud"
    orderNumber: string;    // "#0045" | "ORD-0045" | "PED-0045"

    // Estados
    available: string;      // "Disponible" | "En stock"
    unavailable: string;    // "Agotado" | "Sin stock" | "No disponible"
    pending: string;        // "Pendiente" | "En espera"
    preparing: string;      // "En preparación" | "Procesando"
    ready: string;          // "Listo" | "Completado" | "Entregado"
    cancelled: string;      // "Cancelado" | "Anulado"

    // Entrega
    delivery: string;       // "Delivery" | "Envío" | "A domicilio"
    pickup: string;         // "Retiro en local" | "Pickup" | "Recoger"

    // WhatsApp/Contacto
    whatsappCTA: string;    // "Enviar por WhatsApp" | "Contactar por WhatsApp"
    whatsappPlaceholder: string; // "Tu WhatsApp" | "Número de contacto"

    // Admin
    adminPanel: string;     // "Panel de administración" | "Dashboard" | "Admin"
    settings: string;       // "Ajustes" | "Configuración" | "Settings"
    products: string;       // "Productos" | "Artículos" | "Catálogo"
    categories: string;     // "Categorías" | "Secciones"
    orders: string;         // "Comandas" | "Pedidos" | "Órdenes"
    staff: string;          // "Equipo" | "Staff" | "Personal"

    // Admin - Panel stats & actions
    published: string;      // "Publicados"
    outOfStock: string;     // "Agotados"
    drafts: string;         // "Borradores"
    shortcuts: string;      // "Atajos"
    newProduct: string;     // "Nuevo producto"

    // Admin - Settings form labels
    businessName: string;   // "Nombre del negocio"
    whatsapp: string;       // "WhatsApp"
    address: string;        // "Dirección"
    instagramUrl: string;   // "Instagram (URL)"
    openingHours: string;   // "Horarios de apertura"
    closingMessage: string; // "Mensaje de cierre"
    legalNotice: string;    // "Aviso legal"

    // Admin - Status plural (board headers)
    pendingPlural: string;  // "Pendientes"
    preparingPlural: string; // "En preparación"
    readyPlural: string;    // "Listos"
    cancelledPlural: string; // "Cancelados"
  };

  // Categorías por defecto (plantilla)
  defaultCategories: readonly {
    name: string;
    slug: string;
    description: string;
  }[];

  // Alérgenos/etiquetas por defecto (plantilla vacía o genérica)
  defaultAllergens: readonly string[];

  // Mensajes del sistema
  messages: {
    closed: string;                    // "Estamos cerrados. Volvé mañana."
    noProducts: string;                // "No hay productos cargados aún."
    cartEmpty: string;                 // "Tu carrito está vacío."
    orderSent: string;                 // "Pedido enviado. Te contactaremos pronto."
    validationError: string;           // "Revisá los campos marcados."
    settingsDescription: string;       // "Datos de contacto, horarios y pie de página del sitio."
    ownerOnly: string;                 // "Solo el dueño del negocio puede cambiar estos datos."
  };

  // Configuración visual (opcional, para theming futuro)
  theme?: {
    primaryColor?: string;
    accentColor?: string;
    fontDisplay?: string;
    fontBody?: string;
  };
}

// ─── CONFIGURACIÓN POR DEFECTO (Genérica) ───
export const PROTOTYPE_CONFIG: PrototypeConfig = {
  brand: {
    name: "Mi Negocio",
    tagline: "Productos de calidad. Pedí por WhatsApp.",
    description: "Catálogo de productos con pedidos por WhatsApp.",
  },

  location: {
    city: "Tu Ciudad",
    region: "Tu Provincia",
    countryCode: "AR",
    phoneCountryCode: "54",
  },

  currency: {
    code: "ARS",
    locale: "es-AR",
    symbol: "$",
  },

  terminology: {
    catalog: "Catálogo",
    category: "Categoría",
    product: "Producto",
    featured: "Destacados",
    cart: "Carrito",
    addToCart: "Agregar",
    checkout: "Finalizar pedido",
    order: "Pedido",
    orderNumber: "#",
    available: "Disponible",
    unavailable: "Sin stock",
    pending: "Pendiente",
    preparing: "En preparación",
    ready: "Listo",
    cancelled: "Cancelado",
    delivery: "Delivery",
    pickup: "Retiro en local",
    whatsappCTA: "Enviar por WhatsApp",
    whatsappPlaceholder: "Tu WhatsApp",
    adminPanel: "Panel de administración",
    settings: "Configuración",
    products: "Productos",
    categories: "Categorías",
    orders: "Pedidos",
    staff: "Equipo",

    // Admin - Panel stats & actions
    published: "Publicados",
    outOfStock: "Agotados",
    drafts: "Borradores",
    shortcuts: "Atajos",
    newProduct: "Nuevo producto",

    // Admin - Settings form labels
    businessName: "Nombre del negocio",
    whatsapp: "WhatsApp",
    address: "Dirección",
    instagramUrl: "Instagram (URL)",
    openingHours: "Horarios de apertura",
    closingMessage: "Mensaje de cierre",
    legalNotice: "Aviso legal",

    // Admin - Status plural (board headers)
    pendingPlural: "Pendientes",
    preparingPlural: "En preparación",
    readyPlural: "Listos",
    cancelledPlural: "Cancelados",
  },

  defaultCategories: [
    { name: "Principales", slug: "principales", description: "Nuestros productos principales" },
    { name: "Secundarios", slug: "secundarios", description: "Opciones complementarias" },
    { name: "Combos", slug: "combos", description: "Combinaciones con precio especial" },
    { name: "Bebidas", slug: "bebidas", description: "Para acompañar tu pedido" },
    { name: "Postres", slug: "postres", description: "Algo dulce para cerrar" },
  ],

  defaultAllergens: [], // Vacío = sin alérgenos predefinidos

  messages: {
    closed: "Estamos cerrados por ahora. Volvé más tarde.",
    noProducts: "Aún no hay productos publicados.",
    cartEmpty: "Tu carrito está vacío.",
    orderSent: "¡Pedido enviado! Te contactaremos en breve.",
    validationError: "Por favor completá los campos requeridos.",
    settingsDescription: "Datos de contacto, horarios y pie de página del sitio.",
    ownerOnly: "Solo el dueño del negocio puede cambiar estos datos.",
  },
};

// ─── Helpers de acceso tipado ───
export function t<T extends keyof PrototypeConfig["terminology"]>(key: T): PrototypeConfig["terminology"][T] {
  return PROTOTYPE_CONFIG.terminology[key];
}

export function formatCurrency(amount: number): string {
  const { code, locale } = PROTOTYPE_CONFIG.currency;
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  });
  return formatter.format(amount);
}