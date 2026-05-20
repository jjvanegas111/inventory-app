import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc, increment, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function VentasVendedor() {
  const navigate = useNavigate();
  const [carrito, setCarrito] = useState([]);
  const [codigoManual, setCodigoManual] = useState('');
  const [escanerActivo, setEscanerActivo] = useState(false);
  const [modalCobroAbierto, setModalCobroAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [buscando, setBuscando] = useState(false);

  const [modalBusquedaAbierto, setModalBusquedaAbierto] = useState(false);
  const [productosBD, setProductosBD] = useState([]);
  const [textoBusqueda, setTextoBusqueda] = useState('');

  const nombreVendedor = localStorage.getItem('usuarioNombre') || "Vendedor";

  const registrarLog = async (accion, detalles) => {
    try {
      await addDoc(collection(db, 'auditoria'), { fecha: serverTimestamp(), usuario: nombreVendedor, accion: accion, detalles: detalles });
    } catch (e) { console.error("Error en log", e); }
  };

  const formatearDinero = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

  const abrirModalBusqueda = async () => {
    setBuscando(true);
    try {
      const q = query(collection(db, 'productos'), orderBy('nombre', 'asc'));
      const snap = await getDocs(q);
      setProductosBD(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setModalBusquedaAbierto(true);
    } catch (error) {
      alert("Error al cargar el inventario.");
    } finally {
      setBuscando(false);
    }
  };

  const productosFiltrados = productosBD.filter(p => 
    p.nombre.toLowerCase().includes(textoBusqueda.toLowerCase()) ||
    p.codigo_barras?.includes(textoBusqueda) ||
    p.codigo_revista?.includes(textoBusqueda) ||
    (p.barras_adicionales && p.barras_adicionales.some(b => b.includes(textoBusqueda)))
  );

  const agregarDesdeBusqueda = (productoBD) => {
    setCarrito(prev => {
      const existe = prev.find(item => item.id === productoBD.id);
      if (existe) {
        if (existe.cantidad >= productoBD.stock_actual) {
          alert(`⚠️ Solo hay ${productoBD.stock_actual} unidades disponibles en inventario.`);
          return prev;
        }
        return prev.map(item => item.id === productoBD.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      return [...prev, { 
        id: productoBD.id, nombre: productoBD.nombre, precio: productoBD.precio_venta, 
        precio_original: productoBD.precio_venta, precio_costo: productoBD.precio_costo || 0, 
        cantidad: 1, stock_maximo: productoBD.stock_actual 
      }];
    });
    setModalBusquedaAbierto(false); 
    setTextoBusqueda('');
  };

  const buscarYAgregarProducto = async (codigoBuscado) => {
    if (!codigoBuscado) return;
    setBuscando(true);
    try {
      let q = query(collection(db, 'productos'), where('codigo_barras', '==', codigoBuscado));
      let querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        q = query(collection(db, 'productos'), where('barras_adicionales', 'array-contains', codigoBuscado));
        querySnapshot = await getDocs(q);
      }
      if (querySnapshot.empty) {
        q = query(collection(db, 'productos'), where('codigo_revista', '==', codigoBuscado));
        querySnapshot = await getDocs(q);
      }

      if (querySnapshot.empty) {
        alert(`❌ El código "${codigoBuscado}" no esta registrado en base de datos.`);
      } else {
        let productoBD = null;
        querySnapshot.forEach((doc) => { productoBD = { id: doc.id, ...doc.data() }; });
        
        if (productoBD.stock_actual <= 0) {
          alert(`⚠️ "${productoBD.nombre}" se encuentra AGOTADO.`);
          return;
        }

        setCarrito(prev => {
          const existe = prev.find(item => item.id === productoBD.id);
          if (existe) {
            if (existe.cantidad >= productoBD.stock_actual) {
              alert(`⚠️ No puedes agregar más. Solo hay ${productoBD.stock_actual} unidades disponibles.`);
              return prev;
            }
            return prev.map(item => item.id === productoBD.id ? { ...item, cantidad: item.cantidad + 1 } : item);
          }
          return [...prev, { 
            id: productoBD.id, nombre: productoBD.nombre, precio: productoBD.precio_venta, 
            precio_original: productoBD.precio_venta, precio_costo: productoBD.precio_costo || 0, 
            cantidad: 1, stock_maximo: productoBD.stock_actual
          }];
        });
      }
    } catch (error) { alert("Error de conexión."); } finally { setBuscando(false); setCodigoManual(''); }
  };

  const cambiarPrecio = (id, nombreActual, precioOrig) => {
    const nuevoPrecio = prompt(`Precio autorizado para: ${nombreActual}\nPrecio original: ${formatearDinero(precioOrig)}`);
    if (nuevoPrecio !== null && nuevoPrecio !== "" && !isNaN(nuevoPrecio)) {
      const nPrecio = parseFloat(nuevoPrecio);
      setCarrito(prev => prev.map(item => item.id === id ? { ...item, precio: nPrecio } : item));
      registrarLog("CAMBIO_PRECIO_CARRITO", `Producto: ${nombreActual} ajustado de ${formatearDinero(precioOrig)} a ${formatearDinero(nPrecio)}`);
    }
  };

  // --- LÓGICA DEL ESCÁNER CON TRADUCCIÓN PROFUNDA Y ESTILIZACIÓN DEL SELECTOR ---
  useEffect(() => {
    let scanner;
    if (escanerActivo) {
      scanner = new Html5QrcodeScanner("lector-caja", { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.777778 }, false);
      scanner.render((codigo) => {
        scanner.clear();
        setEscanerActivo(false);
        buscarYAgregarProducto(codigo);
      }, () => {});

      const traductor = setInterval(() => {
        
        // 1. TRADUCCIÓN PROFUNDA DE TEXTOS SUELTOS (Select Camera, etc.)
        const contenedor = document.getElementById('lector-caja');
        if (contenedor) {
          const walk = document.createTreeWalker(contenedor, NodeFilter.SHOW_TEXT, null, false);
          let node;
          while ((node = walk.nextNode())) {
            if (node.nodeValue.includes('Select Camera')) {
              node.nodeValue = node.nodeValue.replace('Select Camera', 'Seleccionar Cámara');
            }
            if (node.nodeValue.includes('Requesting camera permissions')) {
               node.nodeValue = node.nodeValue.replace('Requesting camera permissions...', 'Solicitando permisos de cámara...');
            }
          }
        }

        // 2. ESTILIZACIÓN DEL SELECTOR DE CÁMARAS (Dropdown)
        const selectCamera = document.getElementById('html5-qrcode-select-camera');
        if (selectCamera && selectCamera.style.borderRadius !== "8px") {
          selectCamera.style.padding = "10px 15px";
          selectCamera.style.borderRadius = "8px";
          selectCamera.style.border = "1px solid #d1d5db"; // Borde gris claro
          selectCamera.style.backgroundColor = "#f3f4f6"; // Fondo gris claro
          selectCamera.style.color = "#374151"; // Texto oscuro
          selectCamera.style.fontWeight = "bold";
          selectCamera.style.cursor = "pointer";
          selectCamera.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)"; // Sombra sutil
          selectCamera.style.width = "100%";
          selectCamera.style.maxWidth = "300px";
          selectCamera.style.margin = "10px auto";
          selectCamera.style.display = "block";
          selectCamera.style.outline = "none";
        }

        // 3. ESTILIZACIÓN Y TRADUCCIÓN DE BOTONES
        const aplicarEstiloBase = (btn, colorFondo) => {
            btn.style.backgroundColor = colorFondo; 
            btn.style.color = "white";
            btn.style.padding = "8px 16px";
            btn.style.borderRadius = "8px";
            btn.style.border = "none";
            btn.style.fontWeight = "bold";
            btn.style.margin = "4px";
            btn.style.cursor = "pointer";
        };

        const btnPermiso = document.getElementById('html5-qrcode-button-camera-permission');
        if (btnPermiso && btnPermiso.innerText !== "Habilitar Cámara") {
          btnPermiso.innerText = "Habilitar Cámara";
          aplicarEstiloBase(btnPermiso, "#ea580c"); 
        }

        const btnStart = document.getElementById('html5-qrcode-button-camera-start');
        if (btnStart && btnStart.innerText !== "Iniciar Escáner") {
          btnStart.innerText = "Iniciar Escáner";
          aplicarEstiloBase(btnStart, "#ea580c"); 
        }

        const btnStop = document.getElementById('html5-qrcode-button-camera-stop');
        if (btnStop && btnStop.innerText !== "Detener Escáner") {
          btnStop.innerText = "Detener Escáner";
          aplicarEstiloBase(btnStop, "#ef4444"); 
        }

        const aScanImage = document.getElementById('html5-qrcode-anchor-scan-type-change');
        if (aScanImage) {
          if (aScanImage.innerText.includes('Scan an Image File')) aScanImage.innerText = "Escanear desde foto";
          if (aScanImage.innerText.includes('Scan using camera directly')) aScanImage.innerText = "Usar cámara";
        }
      }, 100);

      return () => { clearInterval(traductor); scanner.clear().catch(() => {}); };
    }
  }, [escanerActivo]);

  const procesarPago = async (metodo) => {
    setGuardando(true);
    try {
      await addDoc(collection(db, 'ventas'), {
        total: totalVenta, metodo_pago: metodo, vendedor: nombreVendedor,
        productos: carrito, fecha: serverTimestamp()
      });
      const promesas = carrito.map(item => updateDoc(doc(db, 'productos', item.id), { stock_actual: increment(-item.cantidad) }));
      await Promise.all(promesas);
      alert("✅ Venta exitosa");
      setCarrito([]);
      setModalCobroAbierto(false);
    } catch (error) { alert("Error al procesar."); } finally { setGuardando(false); }
  };

  const realizarCierre = async () => {
    const base = prompt("¿Cuánto efectivo queda de base para mañana?");
    if (!base) return;
    try {
      await addDoc(collection(db, 'cierres'), { fecha: serverTimestamp(), vendedor: nombreVendedor, base_final: parseFloat(base) });
      await registrarLog("CIERRE_CAJA", `Base reportada: ${formatearDinero(parseFloat(base))}`);
      alert("✅ Cierre guardado");
      localStorage.clear();
      navigate('/');
    } catch (e) { alert("Error al cerrar"); }
  };

  const totalVenta = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative">
      <header className="bg-orange-600 text-white p-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="font-bold text-sm">Caja: {nombreVendedor}</h1>
          <button onClick={realizarCierre} className="text-[10px] bg-orange-800 px-2 py-1 rounded mt-1 font-bold uppercase tracking-wider hover:bg-orange-900 transition-colors">Cerrar Caja</button>
        </div>
        <button onClick={() => {localStorage.clear(); navigate('/')}} className="text-sm font-semibold opacity-80 hover:opacity-100">Salir</button>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-4 max-w-md w-full mx-auto overflow-hidden text-gray-800">
        
        <div className="flex gap-2">
          <button onClick={() => setEscanerActivo(!escanerActivo)} className="bg-gray-800 text-white px-4 py-3 rounded-2xl shadow-sm font-bold text-xl hover:bg-gray-900 transition-colors">
            {escanerActivo ? '❌' : '📷'}
          </button>
          <div className="flex-1 bg-white flex border rounded-2xl px-3 items-center shadow-sm">
            <input type="text" placeholder="Código de barras..." className="w-full bg-transparent outline-none text-sm font-medium" value={codigoManual} onChange={e => setCodigoManual(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscarYAgregarProducto(codigoManual)} />
            <button onClick={() => buscarYAgregarProducto(codigoManual)} className="text-orange-600 font-black text-xl px-2 hover:scale-110 transition-transform">+</button>
          </div>
          <button onClick={abrirModalBusqueda} disabled={buscando} className="bg-blue-100 text-blue-600 hover:bg-blue-200 px-4 py-3 rounded-2xl shadow-sm font-bold transition-colors">
             {buscando ? '...' : '🔍'}
          </button>
        </div>

        {escanerActivo && <div id="lector-caja" className="rounded-2xl overflow-hidden border bg-white p-2 shadow-sm"></div>}

        <div className="bg-white flex-1 rounded-3xl shadow-sm border p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Carrito</h2>
            {carrito.length > 0 && <button onClick={() => setCarrito([])} className="text-red-400 text-[10px] font-bold uppercase hover:text-red-600 transition-colors">Vaciar 🗑️</button>}
          </div>
          <ul className="space-y-3">
            {carrito.map(item => (
              <li key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
                <div className="flex-1">
                  <p className="font-bold text-sm">{item.nombre}</p>
                  <p className="text-[10px] text-gray-400 font-bold mt-1">Cant: {item.cantidad} (Máx: {item.stock_maximo})</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => cambiarPrecio(item.id, item.nombre, item.precio_original)} className="text-right hover:opacity-80 transition-opacity">
                        <p className="font-black text-orange-600">{formatearDinero(item.precio * item.cantidad)}</p>
                        <span className="text-[8px] text-orange-400 font-bold block leading-none mt-1">✏️ EDITAR</span>
                    </button>
                    <button onClick={() => setCarrito(prev => prev.filter(i => i.id !== item.id))} className="text-gray-300 ml-2 hover:text-red-500 transition-colors text-lg">✕</button>
                </div>
              </li>
            ))}
            {carrito.length === 0 && <p className="text-center text-gray-400 text-sm mt-10 italic font-medium">Carrito vacío</p>}
          </ul>
        </div>
      </main>

      <footer className="bg-white p-6 border-t shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total a cobrar</p>
            <p className="text-3xl font-black text-gray-900">{formatearDinero(totalVenta)}</p>
          </div>
          <button disabled={carrito.length === 0} onClick={() => setModalCobroAbierto(true)} className="bg-green-500 text-white px-10 py-4 rounded-2xl font-black shadow-lg shadow-green-200 active:scale-95 transition-all disabled:opacity-30 disabled:active:scale-100">
            COBRAR
          </button>
        </div>
      </footer>

      {/* --- MODAL DEL BUSCADOR DE INVENTARIO --- */}
      {modalBusquedaAbierto && (
        <div className="absolute inset-0 bg-gray-100 z-50 flex flex-col text-gray-800">
          <header className="bg-white p-4 flex items-center shadow-sm border-b">
            <button onClick={() => setModalBusquedaAbierto(false)} className="text-gray-400 font-bold text-xl mr-4 hover:text-gray-600">←</button>
            <input 
              type="text" autoFocus placeholder="Buscar por nombre, código o revista..." 
              className="w-full bg-gray-100 p-3 rounded-xl outline-none font-medium"
              value={textoBusqueda} onChange={e => setTextoBusqueda(e.target.value)} 
            />
          </header>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {productosFiltrados.length === 0 ? (
              <p className="text-center text-gray-400 mt-10 italic font-medium">No se encontraron productos.</p>
            ) : (
              productosFiltrados.map(p => (
                <div key={p.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                  <div className="flex-1 pr-4">
                    <p className="font-bold text-sm">{p.nombre}</p>
                    <p className="text-[10px] text-gray-400 font-mono mt-1 font-bold">Rev: {p.codigo_revista || 'Temp'}</p>
                    <p className="font-black text-orange-600 text-sm mt-1">{formatearDinero(p.precio_venta)}</p>
                  </div>
                  <div>
                    {p.stock_actual > 0 ? (
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-lg">Stock: {p.stock_actual}</span>
                        <button onClick={() => agregarDesdeBusqueda(p)} className="bg-gray-800 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-black active:scale-95 transition-all">
                          + Agregar
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-bold bg-red-100 text-red-600 px-3 py-2 rounded-xl uppercase tracking-wider">
                        Agotado
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL DE COBRO EXACTO */}
      {modalCobroAbierto && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-end p-4 z-50">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl mx-auto mb-4 text-gray-800">
            <p className="text-center text-3xl font-black text-green-600 mb-8">{formatearDinero(totalVenta)}</p>
            <div className="grid gap-3">
              <button disabled={guardando} onClick={() => procesarPago('Efectivo')} className="w-full bg-emerald-50 text-emerald-700 font-bold py-3 rounded-2xl border border-emerald-100 active:scale-95 transition-transform">💵 Efectivo</button>
              <button disabled={guardando} onClick={() => procesarPago('Nequi')} className="w-full bg-purple-50 text-purple-700 font-bold py-3 rounded-2xl border border-purple-100 active:scale-95 transition-transform">🟣 Nequi</button>
              <button disabled={guardando} onClick={() => procesarPago('Daviplata')} className="w-full bg-red-50 text-red-700 font-bold py-3 rounded-2xl border border-red-100 active:scale-95 transition-transform">🔴 Daviplata</button>
              <button disabled={guardando} onClick={() => procesarPago('Bre-b / Transf.')} className="w-full bg-blue-50 text-blue-700 font-bold py-3 rounded-2xl border border-blue-100 active:scale-95 transition-transform">🔵 Bre-b / Transf. Bancaria</button>
              <button disabled={guardando} onClick={() => procesarPago('Tarjeta')} className="w-full bg-gray-50 text-gray-700 font-bold py-3 rounded-2xl border border-gray-200 active:scale-95 transition-transform">💳 Tarjeta (Datáfono)</button>
              <button onClick={() => setModalCobroAbierto(false)} className="w-full mt-2 text-gray-400 font-bold py-2 hover:text-gray-600">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}