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

const panelLogin = document.getElementById('panel-login');
const panelUsuario = document.getElementById('panel-usuario');
const estado = document.getElementById('estado');

function generarCodigoReferido(nombre, uid) {
  const base = (nombre || 'USER').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'USER';
  const sufijo = uid.slice(0, 4).toUpperCase();
  return base + sufijo;
}

document.getElementById('btn-google').addEventListener('click', () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  estado.textContent = 'Abriendo inicio de sesión de Google...';
  auth.signInWithPopup(provider).catch(err => {
    estado.textContent = 'No se pudo iniciar sesión: ' + err.message;
  });
});

document.getElementById('btn-logout').addEventListener('click', () => auth.signOut());

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    panelLogin.style.display = 'block';
    panelUsuario.style.display = 'none';
    estado.textContent = '';
    return;
  }

  estado.textContent = 'Verificando tu cuenta...';
  const ref = db.collection('usuarios').doc(user.uid);
  const snap = await ref.get();

  if (!snap.exists) {
    // Primer inicio de sesión: crear el "cajón" del usuario.
    // TODO (fase 4): antes de llegar aquí, mostrar la pantalla de
    // consentimiento (privacidad, términos, cookies) y solo crear
    // este documento después de que la persona acepte.
    const codigo = generarCodigoReferido(user.displayName, user.uid);

    // El código de referido llega por la URL (?ref=ALGO), escrito por
    // quien sea que compartió el enlace — nunca hay que confiar en él
    // a ciegas. Aquí solo se limpia el formato (evita que alguien meta
    // texto largo o símbolos raros); la validación real de que el
    // código exista de verdad, y el crédito de días sin anuncios, los
    // hace más adelante una Cloud Function del lado del servidor
    // (fase 7) — nunca el navegador del propio usuario.
    const params = new URLSearchParams(window.location.search);
    const refCrudo = (params.get('ref') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    const referidoPor = (refCrudo && refCrudo !== codigo) ? refCrudo : null;

    await ref.set({
      perfil: {
        nombre: user.displayName || '',
        correo: user.email || '',
        foto: user.photoURL || '',
        celular: '' // se completa en un paso posterior del registro
      },
      plan: 'gratis',
      codigoReferido: codigo,
      referidoPor: referidoPor,
      diasSinAnunciosHasta: null,
      rachaActividad: 0,
      fechaRegistro: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  const datos = (await ref.get()).data();
  document.getElementById('txt-nombre').textContent = datos.perfil.nombre;
  document.getElementById('txt-correo').textContent = datos.perfil.correo;
  document.getElementById('txt-codigo').textContent = datos.codigoReferido;
  document.getElementById('txt-plan').textContent = datos.plan;

  panelLogin.style.display = 'none';
  panelUsuario.style.display = 'block';
  estado.textContent = '';
});
