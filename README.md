# Yo Emprendedor

Proyecto nuevo, independiente de "Mi Catálogo" (Team EYJ). No comparte cuenta
de Firebase, Netlify ni ningún dato con ese proyecto.

## Qué hay en esta carpeta ahora mismo

- `public/index.html` — esqueleto de la página, todavía sin conectar a Firebase.
- `public/manifest.json` — configuración básica de PWA.
- `firestore.rules` — reglas de seguridad ya diseñadas sobre la estructura
  de datos "cada usuario en su propio cajón" (ver hoja de ruta del proyecto).
- `netlify.toml` — configuración de publicación en Netlify.

## Siguiente paso (fase 1 de la hoja de ruta)

1. Crear un proyecto **nuevo** en https://console.firebase.google.com
   (nombre sugerido: `yo-emprendedor`), separado del proyecto `mi-catalogo-5b581`.
2. Dentro de ese proyecto nuevo, activar:
   - Authentication → método "Google".
   - Firestore Database (modo producción).
   - Storage.
3. Copiar la configuración del proyecto (Configuración del proyecto ⚙️ →
   "Tus apps" → agregar app web → copiar el objeto `firebaseConfig`) y
   pegarla en el chat para conectarla a `public/index.html`.
4. Crear un repositorio nuevo en GitHub (por ejemplo `yo-emprendedor`),
   distinto de `mi-catalogo`, y subir esta carpeta.
5. Crear un sitio nuevo en Netlify conectado a ese repositorio.
