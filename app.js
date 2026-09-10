// ============================================================
// app.js — Autenticación y "sesión" del usuario.
// Todo lo que es contenido de negocio (catálogo, clientes, ventas,
// cobros, reportes) vive en app-negocio.js, para no mezclar la parte
// de seguridad/login con la parte de funciones del día a día.
// ============================================================

// Configuración del proyecto "yo-emprendedor" (separado de Mi Catálogo)
const firebaseConfig = {
  apiKey: "AIzaSyBpzH-f7iG8PgxA-z9f8sFzjh2GiwteCAA",
  authDomain: "yo-emprendedor.firebaseapp.com",
  projectId: "yo-emprendedor",
  storageBucket: "yo-emprendedor.firebasestorage.app",
  messagingSenderId: "752389806922",
  appId: "1:752389806922:web:e713682d0b9c7ac7513fb3",
  measurementId: "G-T86HE6RS69"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

window.sesion = { uid: null, datos: null };

const panelLoginWrap = document.getElementById('panel-login-wrap');
const appDiv = document.getElementById('app');
const estadoLogin = document.getElementById('estado-login');
const mensajeGlobal = document.getElementById('mensaje-global');

function mostrarMensaje(texto, esError) {
  mensajeGlobal.textContent = texto || '';
  mensajeGlobal.style.color = esError ? '#a33d2e' : '#5a5f55';
  if (texto) setTimeout(() => { if (mensajeGlobal.textContent === texto) mensajeGlobal.textContent = ''; }, 5000);
}

function generarCodigoReferido(nombre, uid) {
  const base = (nombre || 'USER').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'USER';
  const sufijo = uid.slice(0, 4).toUpperCase();
  return base + sufijo;
}

document.getElementById('btn-google').addEventListener('click', () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  estadoLogin.textContent = 'Abriendo inicio de sesión de Google...';
  auth.signInWithPopup(provider).catch(err => {
    estadoLogin.textContent = 'No se pudo iniciar sesión: ' + err.message;
  });
});

document.getElementById('btn-logout').addEventListener('click', () => auth.signOut());

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    panelLoginWrap.style.display = 'flex';
    appDiv.style.display = 'none';
    estadoLogin.textContent = '';
    window.sesion = { uid: null, datos: null };
    return;
  }

  estadoLogin.textContent = 'Verificando tu cuenta...';

  try {
    const ref = db.collection('usuarios').doc(user.uid);
    const snap = await ref.get();

    if (!snap.exists) {
      const codigo = generarCodigoReferido(user.displayName, user.uid);

      const params = new URLSearchParams(window.location.search);
      const refCrudo = (params.get('ref') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
      const referidoPor = (refCrudo && refCrudo !== codigo) ? refCrudo : null;

      await ref.set({
        perfil: {
          nombre: user.displayName || '',
          correo: user.email || '',
          foto: user.photoURL || '',
          celular: ''
        },
        plan: 'gratis',
        codigoReferido: codigo,
        referidoPor: referidoPor,
        diasSinAnunciosHasta: null,
        rachaActividad: 0,
        fechaRegistro: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    const datos =
