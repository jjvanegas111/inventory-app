import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { collection, addDoc, query, where, getDocs, serverTimestamp, doc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../services/firebase';
import { registrarLog } from '../utils/logger';

export default function AgregarProducto() {
  const navigate = useNavigate();
  const [escanerActivo, setEscanerActivo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [producto, setProducto] = useState({
    codigo_barras: '',
    codigo_revista: '',
    nombre: '',
    precio_costo: '',
    precio_venta: '',
    stock: '',
    ubicacion_stock: 'casa' // Por defecto, lo que registres hoy irá a la casa
  });

  const nombreAdmin = localStorage.getItem('usuarioNombre') || "Admin";

  // --- LÓGICA DEL ESCÁNER CON TRADUCCIÓN PROFUNDA Y ESTILIZACIÓN DEL SELECTOR ---
  useEffect(() => {
    let scanner;
    if (escanerActivo) {
      scanner = new Html5QrcodeScanner("lector-inventario", { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.777778 }, false);
      scanner.render((codigo) => {
        scanner.clear();
        setEscanerActivo(false);
        // CORRECCIÓN: Guardamos el código leído en el estado del producto
        setProducto(prev => ({ ...prev, codigo_barras: codigo }));
      }, () => {});

      const traductor = setInterval(() => {
        
        // 1. TRADUCCIÓN PROFUNDA DE TEXTOS SUELTOS
        // CORRECCIÓN: Apuntamos al ID 'lector-inventario'
        const contenedor = document.getElementById('lector-inventario');
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

  const verificarCodigoRevista = async () => {
    if (!producto.codigo_revista.trim()) return;
    try {
      const qRevista = query(collection(db, 'productos'), where('codigo_revista', '==', producto.codigo_revista));
      const snapRevista = await getDocs(qRevista);

      if (!snapRevista.empty) {
        const prodDB = snapRevista.docs[0];
        const data = prodDB.data();

        const yaTieneEseCodigo = producto.codigo_barras && (data.codigo_barras === producto.codigo_barras || (data.barras_adicionales && data.barras_adicionales.includes(producto.codigo_barras)));
        let mensaje = `📦 PRODUCTO ENCONTRADO:\nNombre: ${data.nombre}\nStock Stand: ${data.stock_actual} | Stock Casa: ${data.stock_casa || 0}\n\n`;

        if (yaTieneEseCodigo || !producto.codigo_barras) {
          const agregarStock = window.confirm(mensaje + `¿Deseas AGREGAR MÁS UNIDADES de este producto?`);
          if (agregarStock) {
            const nuevasUnidades = window.prompt(`¿Cuántas unidades vas a sumar?`);
            const donde = window.prompt(`Escribe '1' para enviar al STAND o '2' para enviar a la CASA`);
            
            if (nuevasUnidades && !isNaN(nuevasUnidades) && donde) {
              setGuardando(true);
              const campoActualizar = donde === '1' ? 'stock_actual' : 'stock_casa';
              await updateDoc(doc(db, 'productos', prodDB.id), { [campoActualizar]: increment(parseInt(nuevasUnidades, 10)) });
              await registrarLog("INGRESO_STOCK", `Sumó ${nuevasUnidades} uds a ${data.nombre} en ${donde === '1' ? 'Stand' : 'Casa'}`);
              alert("✅ Stock actualizado.");
              navigate('/admin');
            }
          }
        } else if (producto.codigo_barras) {
          const confirmarVincular = window.confirm(mensaje + `¿VINCULAR el nuevo código de barras (${producto.codigo_barras}) a este producto?`);
          if (confirmarVincular) {
            setGuardando(true);
            await updateDoc(doc(db, 'productos', prodDB.id), { barras_adicionales: arrayUnion(producto.codigo_barras) });
            await registrarLog("VINCULO_BARRAS", `Vinculó código ${producto.codigo_barras} a ${data.nombre}`);
            alert("✅ Código de barras vinculado exitosamente.");
            navigate('/admin');
          }
        }
      }
    } catch (error) { console.error(error); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!producto.codigo_revista && !producto.codigo_barras) {
        return alert("⚠️ Debes ingresar al menos el Código de Revista o el Código de Barras.");
    }

    setGuardando(true);
    try {
        let codigoRevistaFinal = producto.codigo_revista.trim() || `TEMP-${producto.codigo_barras}`;

        const qRevista = query(collection(db, 'productos'), where('codigo_revista', '==', codigoRevistaFinal));
        const snapRevista = await getDocs(qRevista);
        if (!snapRevista.empty) {
            alert("⚠️ Este producto ya existe. Utiliza la validación automática al escribir el código de revista.");
            setGuardando(false); return;
        }

        if (producto.codigo_barras) {
            const qBarras = query(collection(db, 'productos'), where('codigo_barras', '==', producto.codigo_barras));
            const snapBarras = await getDocs(qBarras);
            if (!snapBarras.empty) {
                alert("⚠️ Error: Este código de barras ya está asignado a otro producto.");
                setGuardando(false); return; 
            }
        }

        // Lógica de ubicación de stock
        const stockIngresado = parseInt(producto.stock, 10) || 0;
        const stockStand = producto.ubicacion_stock === 'stand' ? stockIngresado : 0;
        const stockCasa = producto.ubicacion_stock === 'casa' ? stockIngresado : 0;

        await addDoc(collection(db, 'productos'), {
          codigo_barras: producto.codigo_barras || "", // Se guarda vacío si es desde la revista
          codigo_revista: codigoRevistaFinal,
          nombre: producto.nombre,
          precio_costo: parseFloat(producto.precio_costo),
          precio_venta: parseFloat(producto.precio_venta),
          stock_actual: stockStand, // Lo que ven las vendedoras
          stock_casa: stockCasa,   // Lo que ve tu mamá en su vitrina
          barras_adicionales: [],
          fecha_creacion: serverTimestamp()
        });

        await registrarLog("NUEVO_PRODUCTO", `Registró ${producto.nombre} con ${stockIngresado} uds en ${producto.ubicacion_stock.toUpperCase()}`);
        alert("✅ Producto registrado con éxito.");
        navigate('/admin');

    } catch (error) { alert("Error: " + error.message); } finally { setGuardando(false); }
 };

  return (
    <div className="min-h-screen bg-white p-4 text-gray-800">
      <header className="flex justify-between items-center mb-6 max-w-md mx-auto">
        <button onClick={() => navigate('/admin')} className="text-orange-600 font-bold">← Cancelar</button>
        <h1 className="text-xl font-black tracking-tighter">Nuevo Producto</h1>
        <div className="w-10"></div>
      </header>

      <div className="max-w-md mx-auto space-y-6">
        <button onClick={() => setEscanerActivo(!escanerActivo)} className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all ${escanerActivo ? 'bg-red-500 text-white' : 'bg-gray-800 text-white'}`}>
          {escanerActivo ? '❌ Cerrar Cámara' : '📷 Escanear Código de Barras'}
        </button>

        {escanerActivo && <div id="lector-inventario" className="bg-white p-2 rounded-2xl shadow-sm border overflow-hidden w-full"></div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 rounded-2xl transition-all border ${producto.codigo_barras ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-transparent'}`}>
              <label className="text-[10px] font-bold text-gray-400 uppercase">Cód. Barras (Opcional)</label>
              {/* Le quitamos el REQUIRED */}
              <input type="text" value={producto.codigo_barras} onChange={e => setProducto({...producto, codigo_barras: e.target.value})} className="w-full bg-transparent font-bold outline-none" placeholder="Dejar vacío si no lo tienes" />
            </div>
            <div className="bg-gray-50 p-3 rounded-2xl border border-transparent">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Cód. Revista</label>
              <input type="text" value={producto.codigo_revista} onChange={e => setProducto({...producto, codigo_revista: e.target.value})} onBlur={verificarCodigoRevista} className="w-full bg-transparent font-bold outline-none" placeholder="Obligatorio" />
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-2xl">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Nombre del Producto</label>
            <input type="text" required value={producto.nombre} onChange={e => setProducto({...producto, nombre: e.target.value})} className="w-full bg-transparent font-bold outline-none" placeholder="Ej: Crema Tododia" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 p-3 rounded-2xl">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Costo ($)</label>
              <input type="number" required value={producto.precio_costo} onChange={e => setProducto({...producto, precio_costo: e.target.value})} className="w-full bg-transparent font-bold outline-none" />
            </div>
            <div className="bg-gray-50 p-3 rounded-2xl">
              <label className="text-[10px] font-bold text-gray-400 uppercase">P. Venta ($)</label>
              <input type="number" required value={producto.precio_venta} onChange={e => setProducto({...producto, precio_venta: e.target.value})} className="w-full bg-transparent font-bold outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
              <label className="text-[10px] font-bold text-blue-600 uppercase">¿Dónde está el producto?</label>
              <select value={producto.ubicacion_stock} onChange={e => setProducto({...producto, ubicacion_stock: e.target.value})} className="w-full bg-transparent font-bold outline-none mt-1 text-blue-900">
                  <option value="casa">🏠 En la Casa</option>
                  <option value="stand">🏪 En el Stand</option>
              </select>
            </div>
            <div className="bg-gray-50 p-3 rounded-2xl border border-transparent">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Cantidad</label>
              <input type="number" required value={producto.stock} onChange={e => setProducto({...producto, stock: e.target.value})} className="w-full bg-transparent font-bold outline-none" />
            </div>
          </div>

          <button type="submit" disabled={guardando} className="w-full bg-orange-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-orange-100 active:scale-95 transition-all disabled:opacity-50 mt-4">
            {guardando ? 'PROCESANDO...' : 'REGISTRAR PRODUCTO'}
          </button>
        </form>
      </div>
    </div>
  );
}