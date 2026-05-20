import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { registrarLog } from '../utils/logger';

export default function AdminUsuarios() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState([]);
  const [nuevoUsuario, setNuevoUsuario] = useState({ nombre: '', pin: '', rol: 'vendedor' });
  const [cargando, setCargando] = useState(false);

  const nombreAdmin = localStorage.getItem('usuarioNombre') || "Admin";

  useEffect(() => { obtenerUsuarios(); }, []);

  const obtenerUsuarios = async () => {
    try {
      const q = query(collection(db, 'usuarios'), orderBy('nombre', 'asc'));
      const querySnapshot = await getDocs(q);
      setUsuarios(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) { console.error(error); }
  };

  const handleCrear = async (e) => {
    e.preventDefault();
    if (nuevoUsuario.pin.length !== 4) return alert("El PIN debe ser de 4 dígitos");
    setCargando(true);
    try {
      const uGuardar = { ...nuevoUsuario, rol: nuevoUsuario.rol.toLowerCase() };
      await addDoc(collection(db, 'usuarios'), uGuardar);
      await registrarLog("CREACION_USUARIO", `Se creó el acceso para: ${uGuardar.nombre}`);
      setNuevoUsuario({ nombre: '', pin: '', rol: 'vendedor' });
      obtenerUsuarios();
      alert("✅ Usuario creado.");
    } catch (error) { alert("Error al crear."); } finally { setCargando(false); }
  };

  const handleEliminar = async (id, nombre) => {
    if (window.confirm(`¿Eliminar acceso a ${nombre}?`)) {
      try {
        await deleteDoc(doc(db, 'usuarios', id));
        await registrarLog("ELIMINACION_USUARIO", `Se eliminó el acceso de: ${nombre}`);
        setUsuarios(prev => prev.filter(u => u.id !== id));
        alert("✅ Eliminado.");
      } catch (error) { alert("Error al eliminar."); }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 text-gray-800">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate('/admin')} className="text-orange-600 font-bold mb-4">← Volver</button>
        <h1 className="text-3xl font-black mb-8">Gestión Personal</h1>

        <div className="bg-white p-6 rounded-3xl shadow-sm mb-8 border border-gray-100">
          <form onSubmit={handleCrear} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase">Nombre</label>
              <input type="text" required value={nuevoUsuario.nombre} onChange={e => setNuevoUsuario({...nuevoUsuario, nombre: e.target.value})} className="w-full bg-gray-50 border rounded-xl p-3 outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase">PIN</label>
              <input type="password" maxLength="4" required value={nuevoUsuario.pin} onChange={e => setNuevoUsuario({...nuevoUsuario, pin: e.target.value})} className="w-full bg-gray-50 border rounded-xl p-3 outline-none" />
            </div>
            <button disabled={cargando} className="bg-orange-500 text-white font-bold py-3 rounded-xl shadow-lg disabled:opacity-50">Crear</button>
          </form>
        </div>

        <div className="space-y-4">
          {usuarios.map(u => (
            <div key={u.id} className="bg-white p-5 rounded-3xl shadow-sm border flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center font-black">{u.nombre[0].toUpperCase()}</div>
                <div><p className="font-black text-lg">{u.nombre}</p><p className="text-[10px] font-bold uppercase text-gray-400">{u.rol}</p></div>
              </div>
              {u.rol.toLowerCase() !== 'admin' && <button onClick={() => handleEliminar(u.id, u.nombre)} className="bg-red-50 text-red-500 font-bold p-3 rounded-2xl">Eliminar</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}