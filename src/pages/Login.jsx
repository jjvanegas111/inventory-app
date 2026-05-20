import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function Login() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleNumberClick = (num) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
      setError('');
    }
  };

  const clearPin = () => setPin('');

  const handleLogin = async () => {
    if (pin.length !== 4) {
      setError('El PIN debe tener 4 dígitos');
      return;
    }

    setLoading(true);
    try {
      // 1. Limpiar cualquier sesión residual por seguridad
      localStorage.clear();

      const q = query(collection(db, 'usuarios'), where('pin', '==', pin));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('PIN incorrecto');
        setPin('');
      } else {
        const docSnap = querySnapshot.docs[0];
        const userData = docSnap.data();
        
        // 2. Normalizar rol a minúsculas para que el Portero no falle
        const rolNormalizado = userData.rol.toLowerCase();

        // 3. Guardar sesión robusta
        localStorage.setItem('usuarioNombre', userData.nombre);
        localStorage.setItem('usuarioRol', rolNormalizado);
        localStorage.setItem('sessionActive', 'true');

        // 4. Redirección con "replace" para que no puedan volver atrás
        if (rolNormalizado === 'admin') {
          navigate('/admin', { replace: true });
        } else {
          navigate('/ventas', { replace: true });
        }
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Stand Torre Central</h2>
        <p className="text-gray-500 mb-6">Digita tu PIN de acceso</p>

        <div className="flex justify-center gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`w-4 h-4 rounded-full ${i < pin.length ? 'bg-orange-500' : 'bg-gray-300'}`} />
          ))}
        </div>

        {error && <p className="text-red-500 text-sm mb-4 font-semibold">{error}</p>}

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button key={num} onClick={() => handleNumberClick(num.toString())} className="bg-gray-100 py-4 rounded-xl text-2xl font-bold active:bg-gray-200">{num}</button>
          ))}
          <button onClick={clearPin} className="bg-red-50 text-red-600 font-bold py-4 rounded-xl">Borrar</button>
          <button onClick={() => handleNumberClick('0')} className="bg-gray-100 py-4 rounded-xl text-2xl font-bold">0</button>
          <button onClick={handleLogin} disabled={loading} className="bg-orange-500 text-white font-bold py-4 rounded-xl disabled:opacity-50 text-xl">OK</button>
        </div>
      </div>
    </div>
  );
}
