import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import VentasVendedor from './pages/VentasVendedor';
import DashboardAdmin from './pages/DashboardAdmin';
import AdminUsuarios from './pages/AdminUsuarios';
import AgregarProducto from './pages/AgregarProducto';
// Importamos el nuevo módulo de la casa
import VentasCasa from './pages/VentasCasa'; 

// --- PROTECCIÓN DE RUTAS (RBAC) ---
const ProtectedRoute = ({ children, allowedRoles }) => {
  const rol = localStorage.getItem('usuarioRol');
  const sessionActive = localStorage.getItem('sessionActive');

  if (!sessionActive || sessionActive !== 'true') {
    return <Navigate to="/" replace />;
  }

  // Si el usuario tiene sesión pero no tiene el rol permitido
  if (allowedRoles && !allowedRoles.includes(rol)) {
    return <Navigate to="/ventas" replace />;
  }

  return children;
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* Ruta accesible por ambos (Vendedor y Admin) */}
        <Route path="/ventas" element={
          <ProtectedRoute allowedRoles={['vendedor', 'admin']}>
            <VentasVendedor />
          </ProtectedRoute>
        } />

        {/* Rutas BLOQUEADAS para Vendedores (Solo Admin) */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <DashboardAdmin />
          </ProtectedRoute>
        } />

        <Route path="/personal" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminUsuarios />
          </ProtectedRoute>
        } />

        <Route path="/agregar-producto" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AgregarProducto />
          </ProtectedRoute>
        } />

        {/* NUEVA RUTA: Módulo exclusivo para el inventario de la casa */}
        <Route path="/venta-casa" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <VentasCasa />
          </ProtectedRoute>
        } />

        {/* Redirección por defecto si la URL no existe */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}