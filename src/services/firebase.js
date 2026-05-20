import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDY8Qwfbo-ERnn-DmDdecuW42KgAWuKv3U",
  authDomain: "stand-natura-app.firebaseapp.com",
  projectId: "stand-natura-app",
  storageBucket: "stand-natura-app.firebasestorage.app",
  messagingSenderId: "1011512944055",
  appId: "1:1011512944055:web:1a1817783fbea8447d3432"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Activar la persistencia de datos offline (Tolerancia a fallos)
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn("⚠️ Múltiples pestañas abiertas. La persistencia offline solo funciona en una a la vez.");
    } else if (err.code == 'unimplemented') {
      console.warn("⚠️ El navegador actual no soporta el almacenamiento en caché offline de Firebase.");
    }
  });