import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, where, doc, deleteDoc, limit, updateDoc, addDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Html5QrcodeScanner } from 'html5-qrcode';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function DashboardAdmin() {
  const navigate = useNavigate();
  const [ventas, setVentas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [logs, setLogs] = useState([]);
  const [baseActual, setBaseActual] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  
  const [modalReporte, setModalReporte] = useState(false);
  const [tipoReporte, setTipoReporte] = useState('diario');
  const [fechaSeleccionada, setFechaSeleccionada] = useState('');
  
  const [productoEditando, setProductoEditando] = useState(null);
  const [escanerEdicion, setEscanerEdicion] = useState(false);

  const nombreAdmin = localStorage.getItem('usuarioNombre') || "Admin";

  const formatearDinero = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

  const registrarLog = async (accion, detalles) => {
    try { await addDoc(collection(db, 'auditoria'), { fecha: serverTimestamp(), usuario: nombreAdmin, accion: accion, detalles: detalles }); } 
    catch (e) { console.error(e); }
  };

  // --- LÓGICA DEL ESCÁNER CON TRADUCCIÓN Y ESTILIZACIÓN TOTAL ---
  useEffect(() => {
    let scanner;
    if (escanerEdicion && productoEditando) {
      scanner = new Html5QrcodeScanner("lector-edicion", { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.777778 }, false);
      
      scanner.render((codigo) => {
        scanner.clear();
        setEscanerEdicion(false);
        setProductoEditando(prev => ({ ...prev, codigo_temporal: codigo }));
      }, () => {});

      const traductor = setInterval(() => {
        
        // 1. TRADUCCIÓN PROFUNDA DE TEXTOS SUELTOS
        const contenedor = document.getElementById('lector-edicion');
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
  }, [escanerEdicion]);

  const guardarEdicionProducto = async (e) => {
    e.preventDefault();
    try {
      let codigosFinales = [...productoEditando.lista_codigos];
      const temporal = (productoEditando.codigo_temporal || "").trim();
      
      if (temporal !== '' && !codigosFinales.includes(temporal)) {
          codigosFinales.push(temporal);
      }

      for (const cod of codigosFinales) {
          const q1 = query(collection(db, 'productos'), where('codigo_barras', '==', cod));
          const snap1 = await getDocs(q1);
          const dup1 = snap1.docs.find(d => d.id !== productoEditando.id);
          if (dup1) return alert(`⚠️ El código ${cod} ya está registrado en: ${dup1.data().nombre}`);
          
          const q2 = query(collection(db, 'productos'), where('barras_adicionales', 'array-contains', cod));
          const snap2 = await getDocs(q2);
          const dup2 = snap2.docs.find(d => d.id !== productoEditando.id);
          if (dup2) return alert(`⚠️ El código ${cod} ya está registrado en: ${dup2.data().nombre}`);
      }

      const nuevoPrincipal = codigosFinales.length > 0 ? codigosFinales[0] : "";
      const nuevosAdicionales = codigosFinales.length > 1 ? codigosFinales.slice(1) : [];

      const ref = doc(db, 'productos', productoEditando.id);
      await updateDoc(ref, {
        nombre: productoEditando.nombre,
        codigo_barras: nuevoPrincipal,
        barras_adicionales: nuevosAdicionales,
        precio_costo: parseFloat(productoEditando.precio_costo),
        precio_venta: parseFloat(productoEditando.precio_venta),
        stock_actual: parseInt(productoEditando.stock_actual, 10),
        stock_casa: parseInt(productoEditando.stock_casa, 10)
      });
      
      setProductos(prev => prev.map(p => p.id === productoEditando.id ? {
          ...p,
          nombre: productoEditando.nombre,
          codigo_barras: nuevoPrincipal,
          barras_adicionales: nuevosAdicionales,
          precio_costo: parseFloat(productoEditando.precio_costo),
          precio_venta: parseFloat(productoEditando.precio_venta),
          stock_actual: parseInt(productoEditando.stock_actual, 10),
          stock_casa: parseInt(productoEditando.stock_casa, 10)
      } : p));

      await registrarLog("EDICIÓN_PRODUCTO", `Se editó el producto: ${productoEditando.nombre}`);
      
      alert("✅ Producto actualizado con éxito.");
      setProductoEditando(null); 
      setEscanerEdicion(false); 
    } catch (error) {
      alert("Error al actualizar el producto.");
    }
  };

  const handleTraslado = async (p) => {
    const direccion = prompt(`TRASLADO DE INVENTARIO: ${p.nombre}\n\nEscribe '1' para mover de CASA a STAND.\nEscribe '2' para mover de STAND a CASA.`);
    if (!direccion) return;
    const cantidadStr = prompt(`¿Cuántas unidades deseas trasladar?`);
    const cantidad = parseInt(cantidadStr, 10);
    if (!cantidad || isNaN(cantidad) || cantidad <= 0) return alert("Cantidad inválida");

    try {
      const ref = doc(db, 'productos', p.id);
      if (direccion === '1') {
        if ((p.stock_casa || 0) < cantidad) return alert(`⚠️ Solo tienes ${p.stock_casa || 0} unidades en casa.`);
        await updateDoc(ref, { stock_casa: increment(-cantidad), stock_actual: increment(cantidad) });
        await registrarLog("TRASLADO", `Movió ${cantidad} uds de CASA a STAND (${p.nombre})`);
      } else if (direccion === '2') {
        if (p.stock_actual < cantidad) return alert(`⚠️ Solo hay ${p.stock_actual} unidades en el stand.`);
        await updateDoc(ref, { stock_actual: increment(-cantidad), stock_casa: increment(cantidad) });
        await registrarLog("TRASLADO", `Movió ${cantidad} uds de STAND a CASA (${p.nombre})`);
      } else {
        return alert("Opción no válida.");
      }
      
      setProductos(prev => prev.map(prod => {
        if (prod.id === p.id) {
          return {
            ...prod,
            stock_casa: direccion === '1' ? (prod.stock_casa || 0) - cantidad : (prod.stock_casa || 0) + cantidad,
            stock_actual: direccion === '1' ? prod.stock_actual + cantidad : prod.stock_actual - cantidad
          };
        }
        return prod;
      }));
      alert("✅ Traslado exitoso");
    } catch (e) { alert("Error en el traslado."); }
  };

  const procesarYGenerarPDF = async (fechaInicio, fechaFin, tituloReporte) => {
    try {
      const q = query(collection(db, 'ventas'), where('fecha', '>=', fechaInicio), where('fecha', '<=', fechaFin), orderBy('fecha', 'asc'));
      const snap = await getDocs(q);
      const ventasReporte = snap.docs.map(doc => doc.data());

      if (ventasReporte.length === 0) {
        alert("No hay ventas registradas en este periodo."); return;
      }

      let totalBruto = 0, totalCostos = 0, totalEfectivo = 0, totalTransferencias = 0;
      const filasTabla = [];
      const conteoProductos = {}; 
      const esMensual = tituloReporte.toLowerCase().includes('mensual'); 

      ventasReporte.forEach(venta => {
        totalBruto += venta.total;
        if (venta.metodo_pago === 'Efectivo') totalEfectivo += venta.total;
        else totalTransferencias += venta.total;

        let costoVenta = 0;
        venta.productos.forEach(p => {
            costoVenta += (p.precio_costo || 0) * p.cantidad; 
            if (esMensual) {
                conteoProductos[p.nombre] = (conteoProductos[p.nombre] || 0) + p.cantidad;
            }
        });
        totalCostos += costoVenta;

        filasTabla.push([
          venta.fecha?.toDate().toLocaleDateString() + ' ' + venta.fecha?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          venta.metodo_pago,
          venta.ubicacion === 'casa' ? '🏠 Casa' : '🏪 Stand',
          formatearDinero(venta.total)
        ]);
      });

      const gananciaNeta = totalBruto - totalCostos;
      let topProductos = [];
      if (esMensual) {
          topProductos = Object.keys(conteoProductos)
              .map(nombre => ({ nombre, cantidad: conteoProductos[nombre] }))
              .sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);
      }

      const doc = new jsPDF();
      doc.setFontSize(18); doc.setTextColor(234, 88, 12); doc.text("STAND NATURA & AVON", 14, 20);
      doc.setFontSize(11); doc.setTextColor(100); 
      doc.text(`REPORTE: ${tituloReporte.toUpperCase()}`, 14, 28);
      doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 34);

      doc.setFillColor(249, 250, 251); doc.rect(14, 40, 182, 30, 'F');
      doc.setTextColor(50); doc.setFontSize(10);
      doc.text(`TOTAL VENDIDO: ${formatearDinero(totalBruto)}`, 20, 48);
      doc.text(`EFECTIVO INGRESADO: ${formatearDinero(totalEfectivo)}`, 20, 56);
      doc.text(`DIGITAL (Nequi/Tarjeta): ${formatearDinero(totalTransferencias)}`, 20, 64);
      
      doc.setTextColor(220, 38, 38); doc.text(`COSTO DE MERCANCÍA: -${formatearDinero(totalCostos)}`, 110, 48);
      doc.setFont(undefined, 'bold'); doc.setTextColor(22, 163, 74); 
      doc.text(`GANANCIA NETA (LIBRE): ${formatearDinero(gananciaNeta)}`, 110, 58);
      doc.setFont(undefined, 'normal');

      let posicionY = 75;

      if (esMensual && topProductos.length > 0) {
          doc.setFontSize(12); doc.setTextColor(234, 88, 12);
          doc.text("TOP 5 PRODUCTOS MÁS VENDIDOS DEL MES", 14, posicionY);
          const filasTop = topProductos.map((p, index) => [`# ${index + 1}`, p.nombre, `${p.cantidad} uds`]);
          doc.autoTable({ startY: posicionY + 4, head: [["Ranking", "Producto", "Unidades Vendidas"]], body: filasTop, theme: 'grid', headStyles: { fillColor: [75, 85, 99] }, margin: { left: 14, right: 14 } });
          posicionY = doc.lastAutoTable.finalY + 15; 
      }

      doc.setFontSize(12); doc.setTextColor(234, 88, 12);
      doc.text("DETALLE DE TRANSACCIONES", 14, posicionY - 4);
      doc.autoTable({ startY: posicionY, head: [["Fecha y Hora", "Método", "Ubicación", "Venta Final"]], body: filasTabla, theme: 'striped', headStyles: { fillColor: [234, 88, 12] } });

      doc.save(`Natura_Reporte_${tituloReporte.replace(/ /g, '_')}.pdf`);
      setModalReporte(false);
    } catch (error) { alert("Error al generar el reporte PDF."); }
  };

  const handleGenerarPDF = () => { 
    const hoy = new Date();
    if (tipoReporte === 'diario') {
      if (!fechaSeleccionada) return alert("Selecciona una fecha.");
      const fechaEl = new Date(fechaSeleccionada + 'T00:00:00');
      const esHoy = fechaEl.toDateString() === hoy.toDateString();
      if (fechaEl.getDay() === 0) return alert("El stand no abre los domingos.");
      if (fechaEl > hoy) return alert("No puedes generar reportes de días en el futuro.");
      if (esHoy) {
        const hora = hoy.getHours();
        const diaSemana = hoy.getDay();
        if (diaSemana >= 1 && diaSemana <= 5 && hora < 18) {
          return alert("⚠️ El stand cierra a las 6:00 PM. No puedes generar el reporte de hoy hasta que termine la jornada.");
        }
        if (diaSemana === 6 && hora < 13) {
          return alert("⚠️ Los sábados cerramos a la 1:00 PM. Reporte bloqueado hasta el cierre.");
        }
      }
      const fechaInicio = new Date(fechaEl); fechaInicio.setHours(0,0,0,0);
      const fechaFin = new Date(fechaEl); fechaFin.setHours(23,59,59,999);
      procesarYGenerarPDF(fechaInicio, fechaFin, `Diario ${fechaSeleccionada}`);
    }

    if (tipoReporte === 'semanal') {
      if (!fechaSeleccionada) return alert("Selecciona una semana.");
      const [inicioStr, finStr] = fechaSeleccionada.split('|');
      const fechaInicio = new Date(inicioStr + 'T00:00:00');
      const fechaFin = new Date(finStr + 'T23:59:59');
      procesarYGenerarPDF(fechaInicio, fechaFin, `Semanal ${inicioStr} al ${finStr}`);
    }

    if (tipoReporte === 'mensual') {
      if (!fechaSeleccionada) return alert("Selecciona un mes.");
      const [year, month] = fechaSeleccionada.split('-');
      const mesElegido = new Date(year, parseInt(month) - 1, 1); 
      if (mesElegido.getFullYear() === hoy.getFullYear() && mesElegido.getMonth() === hoy.getMonth()) {
        return alert("⚠️ El reporte mensual estará disponible cuando acabe este mes.");
      }
      if (mesElegido > hoy) return alert("Mes futuro no válido.");
      const fechaInicio = new Date(year, parseInt(month) - 1, 1, 0, 0, 0);
      const fechaFin = new Date(year, parseInt(month), 0, 23, 59, 59); 
      procesarYGenerarPDF(fechaInicio, fechaFin, `Mensual ${year}-${month}`);
    }
  };

  const getSemanasCerradas = () => {
    const opciones = [];
    let fechaActual = new Date();
    while (fechaActual.getDay() !== 6) { fechaActual.setDate(fechaActual.getDate() - 1); }
    for (let i = 0; i < 4; i++) {
      const finSemana = new Date(fechaActual);
      const inicioSemana = new Date(fechaActual);
      inicioSemana.setDate(inicioSemana.getDate() - 5); 
      const strInicio = inicioSemana.toISOString().split('T')[0];
      const strFin = finSemana.toISOString().split('T')[0];
      opciones.push({
        label: `Lun ${inicioSemana.getDate()}/${inicioSemana.getMonth()+1} al Sáb ${finSemana.getDate()}/${finSemana.getMonth()+1}`,
        value: `${strInicio}|${strFin}`
      });
      fechaActual.setDate(fechaActual.getDate() - 7);
    }
    return opciones;
  };

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const qVentas = query(collection(db, 'ventas'), where('fecha', '>=', hoy), orderBy('fecha', 'desc'));
        const snapVentas = await getDocs(qVentas);
        setVentas(snapVentas.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const qCierre = query(collection(db, 'cierres'), orderBy('fecha', 'desc'), limit(1));
        const snapCierre = await getDocs(qCierre);
        if (!snapCierre.empty) setBaseActual(snapCierre.docs[0].data().base_final);

        const qProd = query(collection(db, 'productos'), orderBy('nombre', 'asc'));
        const snapProd = await getDocs(qProd);
        setProductos(snapProd.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const qLogs = query(collection(db, 'auditoria'), orderBy('fecha', 'desc'), limit(10));
        const snapLogs = await getDocs(qLogs);
        setLogs(snapLogs.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      } catch (error) { console.error(error); } finally { setCargando(false); }
    };
    cargarDatos();
  }, []);

  const eliminarProducto = async (id, nombre) => {
    if(window.confirm(`¿Eliminar ${nombre} de la base de datos?`)) {
      await deleteDoc(doc(db, 'productos', id));
      setProductos(productos.filter(p => p.id !== id));
      await registrarLog("ELIMINACION_PRODUCTO", `Se eliminó el producto: ${nombre}`);
    }
  };

  const productosFiltrados = productos.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.codigo_barras?.includes(busqueda) ||
    p.codigo_revista?.includes(busqueda)
  );

  const ventasStand = ventas.filter(v => v.ubicacion !== 'casa');
  const ingresosTotales = ventasStand.reduce((sum, v) => sum + v.total, 0);
  const efectivoHoy = ventasStand.filter(v => v.metodo_pago === 'Efectivo').reduce((sum, v) => sum + v.total, 0);
  const transferenciasHoy = ventasStand.filter(v => v.metodo_pago !== 'Efectivo').reduce((sum, v) => sum + v.total, 0);

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 text-gray-800 relative">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl font-black text-gray-800">Panel Admin</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => navigate('/venta-casa')} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-1">🏠 Venta Casa</button>
          <button onClick={() => navigate('/personal')} className="bg-purple-600 text-white px-4 py-2 rounded-xl font-bold">👥 Personal</button>
          <button onClick={() => navigate('/agregar-producto')} className="bg-orange-600 text-white px-4 py-2 rounded-xl font-bold">➕ Producto</button>
          <button onClick={() => {localStorage.clear(); navigate('/')}} className="bg-white text-gray-400 px-4 py-2 rounded-xl font-bold border">Salir</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-3xl shadow-sm border-l-4 border-orange-500 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ventas Hoy (Stand)</p>
              <p className="text-2xl font-black text-gray-800">{formatearDinero(ingresosTotales)}</p>
            </div>
            <button onClick={() => setModalReporte(true)} className="bg-orange-100 text-orange-600 px-4 py-2 rounded-xl font-bold hover:bg-orange-200 transition-colors">📄 PDF</button>
          </div>
          <div className="bg-emerald-50 p-6 rounded-3xl shadow-sm border border-emerald-100 flex flex-col justify-center">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Efectivo Total (Stand)</p>
            <p className="text-2xl font-black text-emerald-900">{formatearDinero(baseActual + efectivoHoy)}</p>
            <p className="text-[10px] text-emerald-600 mt-1 font-bold">Base inicial: {formatearDinero(baseActual)}</p>
          </div>
          <div className="bg-purple-50 p-6 rounded-3xl shadow-sm border border-purple-100 flex flex-col justify-center">
            <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Nequi / DaviPlata / Bre-b (Stand)</p>
            <p className="text-2xl font-black text-purple-900">{formatearDinero(transferenciasHoy)}</p>
          </div>
        </div>

        <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-200 flex items-center">
            <span className="p-3">🔍</span>
            <input type="text" placeholder="Buscar por nombre o código..." className="w-full p-3 bg-transparent outline-none font-medium" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>

        <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
          <div className="bg-gray-50/50 p-5 border-b flex justify-between items-center">
            <h2 className="font-bold">Inventario ({productosFiltrados.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-black">
                <tr>
                  <th className="p-5">Producto</th>
                  <th className="p-5 text-center text-blue-600">🏠 Casa</th>
                  <th className="p-5 text-center text-orange-600">🏪 Stand</th>
                  <th className="p-5">Precio</th>
                  <th className="p-5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {productosFiltrados.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-5">
                        <p className="font-bold">{p.nombre}</p>
                        <p className="text-[9px] text-gray-400 font-mono">REV: {p.codigo_revista}</p>
                    </td>
                    <td className="p-5 text-center"><span className="font-black text-blue-700 bg-blue-50 px-3 py-1 rounded-lg">{p.stock_casa || 0}</span></td>
                    <td className="p-5 text-center"><span className="font-black text-orange-700 bg-orange-50 px-3 py-1 rounded-lg">{p.stock_actual || 0}</span></td>
                    <td className="p-5 font-bold text-gray-700">{formatearDinero(p.precio_venta)}</td>
                    <td className="p-5 text-center flex justify-center gap-2">
                      <button onClick={() => handleTraslado(p)} className="bg-purple-100 text-purple-600 hover:bg-purple-200 p-2 rounded-xl text-xs font-bold" title="Trasladar">🚚</button>
                      
                      <button onClick={() => {
                          const codigos = [p.codigo_barras, ...(p.barras_adicionales || [])].filter(Boolean);
                          setProductoEditando({
                              ...p,
                              lista_codigos: codigos,
                              codigo_temporal: '' 
                          });
                      }} className="bg-gray-100 text-gray-600 hover:bg-gray-200 p-2 rounded-xl text-xs font-bold" title="Editar Producto">✏️</button>
                      
                      <button onClick={() => eliminarProducto(p.id, p.nombre)} className="text-gray-300 hover:text-red-500 p-2">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-gray-900 text-green-400 p-6 rounded-3xl shadow-xl font-mono text-xs">
          <p className="text-gray-500 mb-4 border-b border-gray-800 pb-2 uppercase tracking-widest font-bold">Monitor de Auditoría en Tiempo Real</p>
          <div className="space-y-2 h-40 overflow-y-auto">
            {logs.map(log => (
              <p key={log.id}>
                <span className="text-gray-600">[{log.fecha?.toDate().toLocaleTimeString()}]</span> <span className="text-white">{log.usuario}</span>: {log.accion} - {log.detalles}
              </p>
            ))}
          </div>
        </div>
      </div>

      {modalReporte && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative">
            <button onClick={() => setModalReporte(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500">✕</button>
            <h2 className="text-xl font-black text-gray-800 mb-6">Generar Reporte Financiero</h2>
            <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
              <button onClick={() => {setTipoReporte('diario'); setFechaSeleccionada('');}} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${tipoReporte === 'diario' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>Diario</button>
              <button onClick={() => {setTipoReporte('semanal'); setFechaSeleccionada('');}} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${tipoReporte === 'semanal' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>Semanal</button>
              <button onClick={() => {setTipoReporte('mensual'); setFechaSeleccionada('');}} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${tipoReporte === 'mensual' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>Mensual</button>
            </div>
            <div className="mb-8">
              {tipoReporte === 'diario' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">Selecciona un Día (Lun-Sáb)</label>
                  <input type="date" className="w-full bg-gray-50 border p-3 rounded-xl font-medium outline-none" value={fechaSeleccionada} onChange={(e) => setFechaSeleccionada(e.target.value)} />
                </div>
              )}
              {tipoReporte === 'semanal' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">Selecciona una Semana Cerrada</label>
                  <select className="w-full bg-gray-50 border p-3 rounded-xl font-medium outline-none" value={fechaSeleccionada} onChange={(e) => setFechaSeleccionada(e.target.value)}>
                    <option value="">-- Elige una semana --</option>
                    {getSemanasCerradas().map((sem, i) => (
                      <option key={i} value={sem.value}>{sem.label}</option>
                    ))}
                  </select>
                </div>
              )}
              {tipoReporte === 'mensual' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">Selecciona un Mes (Debe haber concluido)</label>
                  <input type="month" className="w-full bg-gray-50 border p-3 rounded-xl font-medium outline-none" value={fechaSeleccionada} onChange={(e) => setFechaSeleccionada(e.target.value)} />
                </div>
              )}
            </div>
            <button onClick={handleGenerarPDF} className="w-full bg-orange-600 text-white font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all">
              DESCARGAR PDF
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL DE EDICIÓN MAESTRA --- */}
      {productoEditando && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => { setProductoEditando(null); setEscanerEdicion(false); }} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 text-xl font-bold">✕</button>
            <h2 className="text-xl font-black text-gray-800 mb-6">Editar Producto</h2>
            
            <form onSubmit={guardarEdicionProducto} className="space-y-4">
              
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Códigos de Barras</label>
                  <button type="button" onClick={() => setEscanerEdicion(!escanerEdicion)} className="bg-orange-100 text-orange-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-orange-200 transition-colors">
                    {escanerEdicion ? '❌ Cerrar Cámara' : '📷 Escanear'}
                  </button>
                </div>
                
                {escanerEdicion && <div id="lector-edicion" className="w-full rounded-lg overflow-hidden mb-3 border border-orange-200"></div>}
                
                {/* Etiquetas Azules (Lista Actual) */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {productoEditando.lista_codigos && productoEditando.lista_codigos.length > 0 ? (
                      productoEditando.lista_codigos.map((cod, index) => (
                          <span key={index} className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1 border border-blue-200">
                              {cod}
                              <button type="button" onClick={() => {
                                  const nuevaLista = productoEditando.lista_codigos.filter((_, i) => i !== index);
                                  setProductoEditando({...productoEditando, lista_codigos: nuevaLista});
                              }} className="text-blue-400 hover:text-blue-600 ml-1">✕</button>
                          </span>
                      ))
                  ) : (
                      <span className="text-xs text-gray-400 italic">No hay códigos registrados para este producto.</span>
                  )}
                </div>

                {/* Caja de Revisión Temporal */}
                <div>
                  <label className="text-[9px] text-gray-400 font-bold uppercase block mb-1">AGREGAR NUEVO CÓDIGO (Escanear o digitar):</label>
                  <input 
                    type="text" 
                    className="w-full bg-white border border-gray-300 p-3 rounded-lg font-black text-gray-800 outline-none" 
                    value={productoEditando.codigo_temporal || ''} 
                    onChange={e => setProductoEditando({...productoEditando, codigo_temporal: e.target.value})} 
                    placeholder="El código aparecerá aquí..."
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Nombre</label>
                <input type="text" required className="w-full bg-gray-50 border p-3 rounded-xl font-bold outline-none" 
                  value={productoEditando.nombre} onChange={e => setProductoEditando({...productoEditando, nombre: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Costo ($)</label>
                  <input type="number" required className="w-full bg-gray-50 border p-3 rounded-xl font-bold outline-none" 
                    value={productoEditando.precio_costo} onChange={e => setProductoEditando({...productoEditando, precio_costo: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Precio Venta ($)</label>
                  <input type="number" required className="w-full bg-gray-50 border p-3 rounded-xl font-bold outline-none" 
                    value={productoEditando.precio_venta} onChange={e => setProductoEditando({...productoEditando, precio_venta: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                  <label className="text-[10px] font-bold text-blue-600 uppercase">Stock Casa 🏠</label>
                  <input type="number" required className="w-full bg-transparent font-black text-blue-900 outline-none text-lg text-center" 
                    value={productoEditando.stock_casa || 0} onChange={e => setProductoEditando({...productoEditando, stock_casa: e.target.value})} />
                </div>
                <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
                  <label className="text-[10px] font-bold text-orange-600 uppercase">Stock Stand 🏪</label>
                  <input type="number" required className="w-full bg-transparent font-black text-orange-900 outline-none text-lg text-center" 
                    value={productoEditando.stock_actual || 0} onChange={e => setProductoEditando({...productoEditando, stock_actual: e.target.value})} />
                </div>
              </div>
              <button type="submit" className="w-full bg-gray-900 text-white font-black py-4 rounded-xl shadow-lg mt-4 hover:bg-black active:scale-95 transition-transform">
                GUARDAR CAMBIOS
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}