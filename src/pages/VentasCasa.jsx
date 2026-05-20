import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc, increment, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function VentasCasa() {
  const navigate = useNavigate();
  const [carrito, setCarrito] = useState([]);
  const [modalCobroAbierto, setModalCobroAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [modalBusquedaAbierto, setModalBusquedaAbierto] = useState(false);
  const [productosBD, setProductosBD] = useState([]);
  const [textoBusqueda, setTextoBusqueda] = useState('');
  
  // Contador de ventas del día en casa
  const [ventasHoyCasa, setVentasHoyCasa] = useState(0);

  const nombreVendedor = localStorage.getItem('usuarioNombre') || "Admin";

  const formatearDinero = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

  // Cargar ventas de HOY en la CASA
  useEffect(() => {
    const cargarVentasHoy = async () => {
      const hoy = new Date(); hoy.setHours(0,0,0,0);
      const q = query(collection(db, 'ventas'), where('fecha', '>=', hoy), where('ubicacion', '==', 'casa'));
      const snap = await getDocs(q);
      const total = snap.docs.reduce((acc, doc) => acc + doc.data().total, 0);
      setVentasHoyCasa(total);
    };
    cargarVentasHoy();
  }, [modalCobroAbierto]); // Se recarga cada vez que se cierra el modal de cobro (venta terminada)

  const abrirModalBusqueda = async () => {
    try {
      const q = query(collection(db, 'productos'), orderBy('nombre', 'asc'));
      const snap = await getDocs(q);
      setProductosBD(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setModalBusquedaAbierto(true);
    } catch (error) { alert("Error al cargar el inventario."); }
  };

  const productosFiltrados = productosBD.filter(p => 
    p.nombre.toLowerCase().includes(textoBusqueda.toLowerCase()) ||
    p.codigo_barras?.includes(textoBusqueda) || p.codigo_revista?.includes(textoBusqueda)
  );

  const agregarDesdeBusqueda = (productoBD) => {
    setCarrito(prev => {
      const existe = prev.find(item => item.id === productoBD.id);
      if (existe) {
        if (existe.cantidad >= (productoBD.stock_casa || 0)) {
          alert(`⚠️ Solo hay ${productoBD.stock_casa || 0} unidades en la CASA.`);
          return prev;
        }
        return prev.map(item => item.id === productoBD.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      return [...prev, { 
        id: productoBD.id, nombre: productoBD.nombre, precio: productoBD.precio_venta, 
        precio_costo: productoBD.precio_costo || 0, cantidad: 1, stock_maximo: productoBD.stock_casa || 0 
      }];
    });
    setModalBusquedaAbierto(false);
    setTextoBusqueda('');
  };

  const procesarPago = async (metodo) => {
    setGuardando(true);
    try {
      await addDoc(collection(db, 'ventas'), {
        total: totalVenta, 
        metodo_pago: metodo, 
        vendedor: nombreVendedor,
        productos: carrito, 
        fecha: serverTimestamp(),
        ubicacion: 'casa' // <--- ETIQUETA CRUCIAL
      });
      // Descontamos ÚNICAMENTE del stock_casa
      const promesas = carrito.map(item => updateDoc(doc(db, 'productos', item.id), { stock_casa: increment(-item.cantidad) }));
      await Promise.all(promesas);
      alert("✅ Venta en Casa Exitosa");
      setCarrito([]);
      setModalCobroAbierto(false);
    } catch (error) { alert("Error al procesar."); } finally { setGuardando(false); }
  };

  const totalVenta = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col relative">
      <header className="bg-blue-700 text-white p-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="font-bold text-lg flex items-center gap-2">🏠 POS Casa</h1>
          <p className="text-xs text-blue-200">Vendido hoy: {formatearDinero(ventasHoyCasa)}</p>
        </div>
        <button onClick={() => navigate('/admin')} className="text-sm font-bold bg-blue-800 px-4 py-2 rounded-xl">Volver al Panel</button>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-4 max-w-md w-full mx-auto overflow-hidden text-gray-800">
        <button onClick={abrirModalBusqueda} className="bg-blue-600 text-white hover:bg-blue-700 w-full py-4 rounded-2xl shadow-lg font-black text-lg transition-colors flex justify-center items-center gap-2">
          🔍 BUSCAR PRODUCTO EN VITRINA
        </button>

        <div className="bg-white flex-1 rounded-3xl shadow-sm border border-blue-100 p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h2 className="text-xs font-bold text-blue-400 uppercase tracking-widest">Carrito de Casa</h2>
            {carrito.length > 0 && <button onClick={() => setCarrito([])} className="text-red-400 text-[10px] font-bold uppercase">Vaciar 🗑️</button>}
          </div>
          <ul className="space-y-3">
            {carrito.map(item => (
              <li key={item.id} className="flex justify-between items-center bg-blue-50/50 p-3 rounded-2xl border border-blue-50">
                <div className="flex-1">
                  <p className="font-bold text-sm text-blue-900">{item.nombre}</p>
                  <p className="text-[10px] text-blue-500 font-bold">Cant: {item.cantidad}</p>
                </div>
                <div className="flex items-center gap-3">
                    <p className="font-black text-blue-700">{formatearDinero(item.precio * item.cantidad)}</p>
                    <button onClick={() => setCarrito(prev => prev.filter(i => i.id !== item.id))} className="text-gray-400 hover:text-red-500 ml-2">✕</button>
                </div>
              </li>
            ))}
            {carrito.length === 0 && <p className="text-center text-blue-300 text-sm mt-10 italic">Carrito vacío</p>}
          </ul>
        </div>
      </main>

      <footer className="bg-white p-6 border-t border-blue-100 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-blue-400 uppercase">Total a Cobrar</p>
            <p className="text-3xl font-black text-blue-900">{formatearDinero(totalVenta)}</p>
          </div>
          <button disabled={carrito.length === 0} onClick={() => setModalCobroAbierto(true)} className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black shadow-lg disabled:opacity-30">COBRAR</button>
        </div>
      </footer>

      {/* MODAL DE BÚSQUEDA */}
      {modalBusquedaAbierto && (
        <div className="absolute inset-0 bg-gray-100 z-50 flex flex-col text-gray-800">
          <header className="bg-blue-700 p-4 flex items-center shadow-sm">
            <button onClick={() => setModalBusquedaAbierto(false)} className="text-white font-bold text-xl mr-4">←</button>
            <input type="text" autoFocus placeholder="Buscar en inventario de casa..." className="w-full bg-blue-800 text-white placeholder-blue-300 p-3 rounded-xl outline-none font-medium" value={textoBusqueda} onChange={e => setTextoBusqueda(e.target.value)} />
          </header>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {productosFiltrados.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-2xl shadow-sm border border-blue-50 flex justify-between items-center">
                <div className="flex-1 pr-4">
                  <p className="font-bold text-sm text-blue-900">{p.nombre}</p>
                  <p className="font-black text-blue-600 text-sm mt-1">{formatearDinero(p.precio_venta)}</p>
                </div>
                <div>
                  {(p.stock_casa || 0) > 0 ? (
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-lg">En Casa: {p.stock_casa}</span>
                      <button onClick={() => agregarDesdeBusqueda(p)} className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl">+ Agregar</button>
                    </div>
                  ) : (
                    <span className="text-xs font-bold bg-gray-100 text-gray-400 px-3 py-2 rounded-xl">Sin Stock</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL DE COBRO */}
      {modalCobroAbierto && (
        <div className="absolute inset-0 bg-blue-900/80 backdrop-blur-sm flex items-end p-4 z-50">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl mx-auto mb-4">
            <p className="text-center text-3xl font-black text-blue-600 mb-8">{formatearDinero(totalVenta)}</p>
            <div className="grid gap-3">
              <button onClick={() => procesarPago('Efectivo')} className="w-full bg-blue-50 text-blue-700 font-bold py-3 rounded-2xl border border-blue-100">Efectivo</button>
              <button onClick={() => procesarPago('Nequi')} className="w-full bg-purple-50 text-purple-700 font-bold py-3 rounded-2xl border border-purple-100">Nequi</button>
              <button onClick={() => procesarPago('Daviplata')} className="w-full bg-red-50 text-red-700 font-bold py-3 rounded-2xl border border-red-100">Daviplata</button>
              <button onClick={() => procesarPago('Bre-b / Transf.')} className="w-full bg-indigo-50 text-indigo-700 font-bold py-3 rounded-2xl border border-indigo-100">Llave Bre-b / Transf. Bancaria</button>
              <button onClick={() => setModalCobroAbierto(false)} className="w-full mt-2 text-gray-400 font-bold py-2">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}