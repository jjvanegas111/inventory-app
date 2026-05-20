import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Función centralizada para registrar auditoría
 * @param {string} accion - El tipo de movimiento (ej: "VENTA", "BORRADO_PRODUCTO")
 * @param {string} detalles - Descripción detallada del evento
 */
export const registrarLog = async (accion, detalles) => {
  try {
    const usuario = localStorage.getItem('usuarioNombre') || "Desconocido";
    await addDoc(collection(db, 'auditoria'), {
      fecha: serverTimestamp(),
      usuario: usuario,
      accion: accion,
      detalles: detalles
    });
  } catch (error) {
    console.error("❌ Error al registrar en la bitácora de auditoría:", error);
  }
};