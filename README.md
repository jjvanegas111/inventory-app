# 🛍️ Inventario Stand - App de Gestión Comercial

Aplicación web desarrollada para gestionar el inventario y las ventas de un 
negocio familiar dedicado a la venta de productos Natura, Avon, accesorios 
y bisutería.

## 🚀 Demo en vivo
[Ver aplicación](https://stand-natura-app.web.app)

## 📋 Descripción

Esta app nació de una necesidad real: llevar un control ordenado del inventario 
y las ventas diarias de un stand comercial. Permite registrar productos, 
registrar ventas y consultar reportes por día, semana o mes.

## ✨ Funcionalidades

- 🔐 Sistema de acceso por PIN con roles diferenciados
- 📦 Gestión completa de inventario (agregar, editar productos)
- 💰 Registro de ventas por vendedor
- 📊 Dashboard administrativo con resumen de ventas
- 📅 Reportes por día, semana y mes
- 👥 Administración de usuarios y roles
- 🔍 Registro de auditoría para trazabilidad
- 📵 Soporte offline gracias a persistencia de Firestore

## 🛠️ Tecnologías utilizadas

- **React** — Interfaz de usuario
- **Vite** — Bundler y entorno de desarrollo
- **Firebase Firestore** — Base de datos en tiempo real (NoSQL)
- **Firebase Hosting** — Despliegue en producción
- **Tailwind CSS** — Estilos y diseño responsivo
- **React Router** — Navegación entre pantallas

## 🏗️ Arquitectura
src/
├── pages/
│   ├── Login.jsx           # Autenticación por PIN
│   ├── DashboardAdmin.jsx  # Panel administrativo
│   ├── AgregarProducto.jsx # Gestión de inventario
│   ├── VentasVendedor.jsx  # Registro de ventas
│   ├── VentasCasa.jsx      # Ventas desde casa
│   └── AdminUsuarios.jsx   # Gestión de usuarios
├── services/
│   └── firebase.js         # Configuración de Firebase (ver abajo)
└── utils/
└── logger.js           # Utilidad de auditoría

## ⚙️ Instalación local

1. Clona el repositorio
```bash
git clone git@github.com:jjvanegas111/inventory-app.git
cd inventory-app
```

2. Instala las dependencias
```bash
npm install
```

3. Configura Firebase — copia el archivo de ejemplo y agrega tus credenciales
```bash
cp src/services/firebase.example.js src/services/firebase.js
```

4. Inicia el servidor de desarrollo
```bash
npm run dev
```

## 🔒 Seguridad

Las credenciales de Firebase no están incluidas en el repositorio por razones 
de seguridad. Usa `firebase.example.js` como plantilla.

### Mejoras de seguridad planificadas
- [ ] Migrar autenticación de PIN a Firebase Authentication
- [ ] Implementar tokens de sesión seguros (reemplazar localStorage)
- [ ] Agregar límite de intentos de login
- [ ] Hashear PINs en base de datos

## 👨‍💻 Autor

**Juan Jose Vanegas**  
Ingeniero de Sistemas | Cloud Computing  
[LinkedIn](#) · [GitHub](https://github.com/jjvanegas111)