import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup,
  signInWithRedirect, signOut
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import {
  getFirestore, doc, getDocFromServer, onSnapshot, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

// Firebase client configuration is public; data access is protected by Firestore rules.
const firebaseConfig = {
  apiKey: "AIzaSyCJ6XNuAAgC0vjV4Z_T-6ic6wMu4Dm3fJg",
  authDomain: "mibanda-32471.firebaseapp.com",
  projectId: "mibanda-32471",
  storageBucket: "mibanda-32471.firebasestorage.app",
  messagingSenderId: "962051496920",
  appId: "1:962051496920:web:23eaab73ed93686e1870ad",
  measurementId: "G-586XYHZWWB"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = "es";
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });
const ui = window.miBandaUI;
const el = id => document.getElementById(id);
const pendingKey = "miBanda_cloud_pending_uid";
const previousUserKey = "miBanda_cloud_last_uid";
let currentRef = null, currentUser = null, unsubscribe = null, ready = false, writeCounter = 0;
let connecting = false;

function friendlyError(error) {
  const code = error?.code || "";
  if (code === "auth/operation-not-allowed") return "Activa el proveedor Google en Firebase → Authentication → Sign-in method.";
  if (code === "auth/unauthorized-domain") return "Añade rcolomer3.github.io a los dominios autorizados en Firebase Authentication → Settings.";
  if (code === "permission-denied") return "Firestore ha denegado el acceso. Publica las reglas seguras de firestore.rules en Firebase → Firestore Database → Reglas.";
  if (code === "failed-precondition" || code === "not-found") return "Comprueba que has creado la base de datos Cloud Firestore en Firebase.";
  if (code === "unavailable") return "No hay conexión con Firestore. Revisa Internet e inténtalo de nuevo.";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "No has terminado el inicio de sesión.";
  return (error?.message || "Error desconocido") + (code ? " (" + code + ")" : "");
}

function stopListening() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  ready = false;
  currentRef = null;
  currentUser = null;
  writeCounter++;
  window.miBandaCloud.mode = "local";
}

async function push(nextRecords) {
  if (!ready || !currentRef || !currentUser) throw new Error("La sincronización no está preparada.");
  const uid = currentUser.uid;
  const sequence = ++writeCounter;
  localStorage.setItem(pendingKey, uid);
  ui.syncMessage("Guardando en Firebase…");
  try {
    await setDoc(currentRef, { records: nextRecords, updatedAt: serverTimestamp() });
    if (sequence === writeCounter && currentUser?.uid === uid) {
      localStorage.removeItem(pendingKey);
      ui.syncMessage("Sincronizado con Firebase");
    }
  } catch (error) {
    if (currentUser?.uid === uid) {
      ui.syncMessage("Error de sincronización · los cambios siguen guardados en este dispositivo");
      ui.notify("No se pudo sincronizar: " + friendlyError(error));
    }
    throw error;
  }
}
window.miBandaCloud = { mode: "local", save: push };

async function connect(user) {
  if (connecting) return;
  connecting = true;
  stopListening();
  ui.showGate("Cargando tus registros de Firebase…", false);
  try {
    const ref = doc(db, "users", user.uid, "apps", "miBanda");
    const snapshot = await getDocFromServer(ref);
    const savedCloud = snapshot.exists() && Array.isArray(snapshot.data()?.records) ? snapshot.data().records : [];
    const local = ui.getLocalRecords();
    const lastUser = localStorage.getItem(previousUserKey);
    const migratedKey = "miBanda_migrated_" + user.uid;
    const migrated = localStorage.getItem(migratedKey) === "1";
    let incoming = savedCloud;
    const sameAccountOrNew = !lastUser || lastUser === user.uid;
    const unsavedChanges = localStorage.getItem(pendingKey) === user.uid && lastUser === user.uid;

    if (unsavedChanges) {
      const restore = confirm("Hay cambios pendientes de sincronización guardados en este dispositivo. ¿Quieres subir estos registros a Firebase? Se reemplazarán los registros de la nube por esta copia.");
      if (restore) {
        incoming = local;
        await setDoc(ref, { records: incoming, updatedAt: serverTimestamp() });
      }
      localStorage.removeItem(pendingKey);
    } else if (!migrated && sameAccountOrNew && local.length) {
      // Initial transfer from the old localStorage-only version. Preserve any
      // records already in the cloud and import only previously unseen IDs.
      const cloudIds = new Set(savedCloud.map(item => item.id));
      const missing = local.filter(item => !cloudIds.has(item.id));
      if (missing.length && confirm("He encontrado " + missing.length + " registro(s) de este navegador que todavía no están en Firebase. ¿Quieres importarlos sin borrar los registros de la nube?")) {
        incoming = [...savedCloud, ...missing];
        await setDoc(ref, { records: incoming, updatedAt: serverTimestamp() });
      }
    }
    localStorage.setItem(migratedKey, "1");
    localStorage.setItem(previousUserKey, user.uid);
    currentRef = ref;
    currentUser = user;
    ui.applyRecords(incoming);
    ready = true;
    window.miBandaCloud.mode = "cloud";
    ui.showApp("cloud", { name: user.displayName || user.email || "Cuenta de Google", email: user.email || "" });
    ui.syncMessage("Sincronizado con Firebase");
    unsubscribe = onSnapshot(ref, snapshot => {
      // Local pending edits take precedence until the server acknowledges them.
      if (!ready || localStorage.getItem(pendingKey) === user.uid || snapshot.metadata.hasPendingWrites) return;
      const fresh = snapshot.exists() && Array.isArray(snapshot.data()?.records) ? snapshot.data().records : [];
      ui.applyRecords(fresh);
      ui.syncMessage(snapshot.metadata.fromCache ? "Sin conexión · mostrando últimos datos" : "Sincronizado con Firebase");
    }, error => {
      ui.syncMessage("No se puede leer Firestore");
      ui.notify("Error al recibir datos: " + friendlyError(error));
    });
  } catch (error) {
    console.error("Firebase connection error:", error);
    ui.showGate("No se ha podido conectar: " + friendlyError(error) + " Puedes seguir en modo local hasta terminar la configuración.", true);
  } finally {
    connecting = false;
  }
}

el("signInBtn").addEventListener("click", async () => {
  el("signInBtn").disabled = true;
  try {
    if (auth.currentUser) {
      await connect(auth.currentUser);
    } else {
      await signInWithPopup(auth, provider);
    }
  } catch (error) {
    if (error?.code === "auth/popup-blocked" || error?.code === "auth/operation-not-supported-in-this-environment") {
      try { await signInWithRedirect(auth, provider); return; }
      catch (redirectError) { error = redirectError; }
    }
    ui.showGate(friendlyError(error), true);
  } finally {
    el("signInBtn").disabled = false;
  }
});

el("connectGoogle").addEventListener("click", async () => {
  if (auth.currentUser) await connect(auth.currentUser);
  else el("signInBtn").click();
});

async function closeSession() {
  const buttons = [el("signOutBtn"), el("signOutHeader")];
  buttons.forEach(button => button.disabled = true);
  try {
    await signOut(auth);
    stopListening();
    ui.showGate("Sesión cerrada. Entra con Google para recuperar tus registros sincronizados.", true);
  } catch (error) {
    ui.notify("No se ha podido cerrar sesión: " + friendlyError(error));
  } finally {
    buttons.forEach(button => button.disabled = false);
  }
}
el("signOutBtn").addEventListener("click", closeSession);
el("signOutHeader").addEventListener("click", closeSession);

onAuthStateChanged(auth, user => {
  el("signInBtn").disabled = false;
  if (user) {
    connect(user);
  } else if (!ui.isLocalMode()) {
    ui.showGate("Inicia sesión con Google para sincronizar los ensayos y actos entre dispositivos.", true);
  }
}, error => ui.showGate(friendlyError(error), true));
