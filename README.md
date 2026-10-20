# 🎺 Mi Banda — Control de ensayos y actos

Web publicada en **https://rcolomer3.github.io/MiBanda/** mediante GitHub Pages.

## Sincronización con Firebase

La aplicación está conectada al proyecto **mibanda-32471**, pero para que pueda guardar y sincronizar registros debes activar dos servicios en la [consola de Firebase](https://console.firebase.google.com/project/mibanda-32471/overview).

### 1. Activar inicio de sesión con Google

1. Abre **Authentication → Sign-in method** en Firebase.
2. Activa el proveedor **Google** y elige tu correo de contacto si se solicita.
3. En **Authentication → Settings → Authorized domains**, añade **rcolomer3.github.io** (sin https ni barras).

### 2. Crear la base de datos

1. Abre **Firestore Database → Crear base de datos**.
2. Elige una región europea y **modo de producción**.
3. En la pestaña **Reglas**, reemplaza el contenido existente por el del archivo [firestore.rules](./firestore.rules) de este repositorio.
4. Pulsa **Publicar** las reglas.

No utilices reglas abiertas como `allow read, write: if true`: la web almacena información privada de asistencia.

### 3. Entrar desde los dispositivos

Abre la web desde tu ordenador y pulsa **Entrar con Google**. Usa la misma cuenta en el móvil o iPad. Cada cuenta guarda sus registros separados en `users/{uid}/apps/miBanda`.

Si ya tenías registros guardados en el navegador antes de Firebase, la aplicación ofrecerá importarlos en tu primer inicio de sesión, sin borrar los que ya hubiera en la nube.

### Copias y modo local

En **Ajustes** puedes descargar una copia JSON y volver a importarla. Si Firebase no está listo, pulsa **Continuar sin sincronización** para utilizar la web solo con almacenamiento local.

Los datos se sincronizan automáticamente cuando Firestore está disponible. Los cambios simultáneos hechos en dos dispositivos pueden sobrescribirse (prevalece la última escritura), por lo que conviene evitar editar el mismo registro al mismo tiempo.

El archivo `firebase-sync.js` contiene la configuración pública del cliente Firebase; **las restricciones reales de acceso se aplican con las reglas de Firestore**, que debes publicar en la consola.
