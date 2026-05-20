# Documentación del Proyecto: Sistema POS e Inventario "Stand Natura/Avon"

## 1. Descripción General
Aplicación Web Progresiva (PWA) diseñada para gestionar el inventario, procesar ventas y generar reportes financieros de un stand comercial. El sistema cuenta con control de accesos por roles para proteger la información financiera y auditar las operaciones diarias.

## 2. Stack Tecnológico
* **Frontend:** React.js (Vite)
* **Estilos:** Tailwind CSS
* **Backend / Base de Datos:** Firebase (Firestore & Firebase Auth)
* **Despliegue:** Firebase Hosting o Vercel
* **Hardware Target:** Smartphones (iOS para Admin, Android para Vendedor) usando cámara nativa como lector de barras.

## 3. Roles de Usuario
* **Vendedor (Empleada):** * Acceso mediante PIN.
  * Permisos: Escanear productos, buscar manual, procesar ventas, aplicar descuentos con nota obligatoria, registrar cierre de caja (Efectivo físico).
  * Restricciones: No ve precio de costo, no ve margen de ganancia, no puede eliminar productos de la base de datos, no puede modificar stock directamente sin procesar una venta o devolución.
* **Administrador (Propietaria):** * Acceso total.
  * Permisos: CRUD completo de productos, visualización de métricas de negocio (Costo Promedio Ponderado, Ingresos Brutos, Ganancia Neta), auditoría de descuentos y cierres de caja.

## 4. Modelo de Base de Datos (Firestore NoSQL)
* **Colección `usuarios`:** { id, nombre, rol, pin }
* **Colección `productos`:** { id, codigo_barras (String), codigo_natura (String), nombre, marca, precio_costo, precio_venta, stock_actual, stock_minimo }
* **Colección `ventas`:** { id, fecha_hora, id_vendedor, total_venta, metodo_pago, descuento_aplicado (Boolean), nota_descuento }
* **Colección `detalle_ventas`:** { id, id_venta, id_producto, cantidad, precio_unitario, subtotal }
* **Colección `cierres_caja`:** { id, fecha, id_vendedor, base_inicial, ventas_efectivo, pago_empleada, efectivo_teorico, efectivo_real, diferencia }

## 5. Reglas de Negocio Clave
1. **Stock Negativo:** El sistema nunca bloquea una venta física. Si el stock en sistema es 0 pero hay producto físico, la venta procede, el stock pasa a -1 y se genera alerta visual para el Administrador.
2. **Costo Dinámico:** Se utilizará el método de Costo Promedio Ponderado para calcular el valor del inventario y márgenes reales frente a las fluctuaciones de compra de la proveedora.
3. **Descuentos:** Requieren validación a través de un campo obligatorio de "Nota de Autorización" para auditoría.
4. **Offline First (Futuro):** Si se pierde la conexión temporalmente, la venta se almacena en el caché local y se sincroniza con Firebase al recuperar el internet.