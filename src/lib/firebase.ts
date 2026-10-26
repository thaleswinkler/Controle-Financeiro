import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  onSnapshot,
  getDocFromServer,
  Unsubscribe,
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";
import { FinancialData } from "../types";

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with specific databaseId if provided
export const db = getFirestore(
  app,
  firebaseConfig.firestoreDatabaseId || undefined
);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Test connection as required by Firebase guidelines
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("Firestore offline ou verificando conexão:", error.message);
    }
  }
}
testConnection();

export interface CloudUserSession {
  uid: string; // workspaceId or auth uid
  email: string;
  displayName: string;
  isFirebaseUser?: boolean;
}

const CLOUD_SESSION_KEY = "fin_iq_cloud_session_v1";

// Helper to generate a deterministic, cryptographically secure workspace ID
export async function generateWorkspaceId(email: string, pass: string): Promise<string> {
  const normalized = `${email.trim().toLowerCase()}:::fin_salt_2026:::${pass.trim()}`;
  const msgUint8 = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `ws_${hashHex.substring(0, 32)}`;
}

// Check for synchronization parameters passed in URL (e.g. from mobile QR code or WhatsApp link)
export function checkUrlSyncSession(): CloudUserSession | null {
  try {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const syncUid = params.get("sync_uid") || params.get("ws") || params.get("sync");
    if (syncUid && syncUid.trim().length > 0) {
      const email = params.get("sync_email") || "";
      const name = params.get("sync_name") || email.split("@")[0] || "Usuário Sincronizado";
      const session: CloudUserSession = {
        uid: syncUid.trim(),
        email: email.trim(),
        displayName: name.trim(),
      };
      storeCloudSession(session);
      // Clean query params from browser address bar without reloading
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      return session;
    }
  } catch (e) {
    console.error("Erro ao verificar sync pela URL:", e);
  }
  return null;
}

export const DEFAULT_WORKSPACE_SESSION: CloudUserSession = {
  uid: "ws_5490bffb6e206b14b606e1d3315b9ef5",
  email: "thales_winkler@hotmail.com",
  displayName: "Thales Winkler",
};

// Always return single-user workspace session without requiring any login
export function getStoredCloudSession(): CloudUserSession {
  return DEFAULT_WORKSPACE_SESSION;
}

export function storeCloudSession(_session: CloudUserSession | null) {
  try {
    localStorage.setItem(CLOUD_SESSION_KEY, JSON.stringify(DEFAULT_WORKSPACE_SESSION));
    localStorage.removeItem("fin_iq_explicit_logout");
  } catch (e) {
    console.error("Erro ao salvar sessão:", e);
  }
}

// Multi-device Cloud Login with Email & Password/PIN
export async function authenticateWithCredentials(
  email: string,
  pass: string
): Promise<CloudUserSession> {
  const workspaceId = await generateWorkspaceId(email, pass);
  const userRef = doc(db, "workspaces", workspaceId);

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      // First time registration: create workspace record
      await setDoc(userRef, {
        workspaceId,
        email: email.trim().toLowerCase(),
        displayName: email.split("@")[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.warn("Aviso ao verificar workspace na nuvem:", e);
  }

  const session: CloudUserSession = {
    uid: workspaceId,
    email: email.trim().toLowerCase(),
    displayName: email.split("@")[0],
  };

  storeCloudSession(session);
  return session;
}

// Google Auth Login
export async function loginWithGoogle(): Promise<CloudUserSession> {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  const isThales = user.email?.toLowerCase().includes("thales");
  const workspaceId = isThales ? "ws_5490bffb6e206b14b606e1d3315b9ef5" : user.uid;
  const session: CloudUserSession = {
    uid: workspaceId,
    email: user.email || "",
    displayName: user.displayName || user.email?.split("@")[0] || "Usuário",
    isFirebaseUser: true,
  };
  storeCloudSession(session);
  return session;
}

// Logout
export async function logoutUser() {
  storeCloudSession(null);
  try {
    if (auth.currentUser) {
      await firebaseSignOut(auth);
    }
  } catch {}
}

// Subscribe to monthly data (supports both /workspaces/{id} and /users/{id})
export function subscribeToMonthData(
  uid: string,
  monthYear: string,
  onData: (data: FinancialData | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const docId = monthYear.replace(/[^a-zA-Z0-9_-]/g, "_");
  const collectionName = uid.startsWith("ws_") ? "workspaces" : "users";
  const monthRef = doc(db, collectionName, uid, "months", docId);

  return onSnapshot(
    monthRef,
    (snap) => {
      if (snap.exists()) {
        const remoteData = snap.data() as FinancialData;
        onData(remoteData);
      } else {
        onData(null);
      }
    },
    (err) => {
      console.error("Erro ao sincronizar dados em tempo real:", err);
      if (onError) onError(err);
    }
  );
}

// Save monthly data to Firestore
export async function saveMonthDataToCloud(
  uid: string,
  monthYear: string,
  data: FinancialData
) {
  const docId = monthYear.replace(/[^a-zA-Z0-9_-]/g, "_");
  const collectionName = uid.startsWith("ws_") ? "workspaces" : "users";
  const monthRef = doc(db, collectionName, uid, "months", docId);

  await setDoc(
    monthRef,
    {
      ...data,
      userId: uid,
      monthYear,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

// Get one-time month data from Firestore
export async function getMonthDataFromCloud(
  uid: string,
  monthYear: string
): Promise<FinancialData | null> {
  const docId = monthYear.replace(/[^a-zA-Z0-9_-]/g, "_");
  const collectionName = uid.startsWith("ws_") ? "workspaces" : "users";
  const monthRef = doc(db, collectionName, uid, "months", docId);
  try {
    const snap = await getDoc(monthRef);
    if (snap.exists()) {
      return snap.data() as FinancialData;
    }
  } catch (err) {
    console.error("Erro ao carregar mês da nuvem:", err);
  }
  return null;
}

// Add multiple installment items across future months in Firestore
export async function addInstallmentsToCloud(
  uid: string,
  installmentsByMonth: Record<string, import("../types").GastoCartao[]>,
  templateData: FinancialData
) {
  const collectionName = uid.startsWith("ws_") ? "workspaces" : "users";

  for (const [targetMonth, newItems] of Object.entries(installmentsByMonth)) {
    const docId = targetMonth.replace(/[^a-zA-Z0-9_-]/g, "_");
    const monthRef = doc(db, collectionName, uid, "months", docId);

    try {
      const snap = await getDoc(monthRef);
      let existingCartoes: import("../types").GastoCartao[] = [];
      let baseData: Partial<FinancialData> = {};

      if (snap.exists()) {
        baseData = snap.data() as FinancialData;
        existingCartoes = baseData.cartoes || [];
        // If the cloud month had empty receitas but templateData has receitas, restore them
        if (
          (!baseData.receitas || baseData.receitas.length === 0) &&
          Array.isArray(templateData.receitas) &&
          templateData.receitas.length > 0
        ) {
          baseData.receitas = templateData.receitas.map((r) => ({
            ...r,
            id: "rec_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
            date: `${targetMonth}-${(r.date || "").split("-")[2] || "05"}`,
          }));
        }
      } else {
        baseData = {
          monthYear: targetMonth,
          cards: templateData.cards,
          receitas: (templateData.receitas || []).map((r) => ({
            ...r,
            id: "rec_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
            date: `${targetMonth}-${(r.date || "").split("-")[2] || "05"}`,
          })),
          gastosFixos: (templateData.gastosFixos || [])
            .filter((f) => f.recurring !== false)
            .map((f) => ({
              ...f,
              id: "fix_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
              status: "pendente" as const,
              date: `${targetMonth}-${(f.date || "").split("-")[2] || "05"}`,
            })),
          investimentos: templateData.investimentos || [],
          imprevistos: [],
          metaRiqueza: templateData.metaRiqueza,
          investimentoAcumuladoAnterior: templateData.investimentoAcumuladoAnterior,
        };
      }

      const mergedCartoes = [...existingCartoes];
      for (const item of newItems) {
        const existingIdx = mergedCartoes.findIndex((c) => c.id === item.id);
        if (existingIdx >= 0) {
          mergedCartoes[existingIdx] = item;
        } else {
          mergedCartoes.push(item);
        }
      }

      await setDoc(
        monthRef,
        {
          ...baseData,
          monthYear: targetMonth,
          cartoes: mergedCartoes,
          userId: uid,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error(`Erro ao propagar parcelas para o mês ${targetMonth}:`, err);
    }
  }
}

// Remove installment series across multiple months in Firestore
export async function removeInstallmentsFromCloud(
  uid: string,
  seriesId: string,
  targetMonths: string[]
) {
  const collectionName = uid.startsWith("ws_") ? "workspaces" : "users";

  for (const m of targetMonths) {
    const docId = m.replace(/[^a-zA-Z0-9_-]/g, "_");
    const monthRef = doc(db, collectionName, uid, "months", docId);

    try {
      const snap = await getDoc(monthRef);
      if (snap.exists()) {
        const monthData = snap.data() as FinancialData;
        const filtered = (monthData.cartoes || []).filter(
          (c) => c.installmentSeriesId !== seriesId
        );
        if (filtered.length !== (monthData.cartoes || []).length) {
          await setDoc(
            monthRef,
            {
              ...monthData,
              cartoes: filtered,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }
      }
    } catch (err) {
      console.error(`Erro ao remover parcelas do mês ${m}:`, err);
    }
  }
}

// Fetch all saved months from cloud for full projection sync
export async function getAllUserMonthsFromCloud(uid: string): Promise<FinancialData[]> {
  const collectionName = uid.startsWith("ws_") ? "workspaces" : "users";
  const monthsCol = collection(db, collectionName, uid, "months");
  try {
    const snap = await getDocs(monthsCol);
    return snap.docs.map((d) => d.data() as FinancialData);
  } catch (err) {
    console.error("Erro ao carregar todos os meses da nuvem:", err);
    return [];
  }
}

// Persist deleted keys and signatures in Cloud to prevent resurrection
export async function saveDeletionsToCloud(uid: string, keys: string[]) {
  const collectionName = uid.startsWith("ws_") ? "workspaces" : "users";
  const delRef = doc(db, collectionName, uid, "settings", "deletions");
  try {
    await setDoc(delRef, { keys, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.error("Erro ao salvar exclusões na nuvem:", err);
  }
}

export async function getDeletionsFromCloud(uid: string): Promise<string[]> {
  const collectionName = uid.startsWith("ws_") ? "workspaces" : "users";
  const delRef = doc(db, collectionName, uid, "settings", "deletions");
  try {
    const snap = await getDoc(delRef);
    if (snap.exists() && Array.isArray(snap.data()?.keys)) {
      return snap.data().keys;
    }
  } catch (err) {
    console.error("Erro ao carregar exclusões da nuvem:", err);
  }
  return [];
}

// Master Vault: persist user's known recurring revenues across all devices
export async function saveReceitasVaultToCloud(
  uid: string,
  receitas: import("../types").Receita[]
) {
  if (!receitas || receitas.length === 0) return;
  const collectionName = uid.startsWith("ws_") ? "workspaces" : "users";
  const vaultRef = doc(db, collectionName, uid, "settings", "receitas_vault");
  try {
    await setDoc(
      vaultRef,
      { receitas, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (err) {
    console.error("Erro ao salvar cofre de receitas na nuvem:", err);
  }
}

export async function getReceitasVaultFromCloud(
  uid: string
): Promise<import("../types").Receita[]> {
  const collectionName = uid.startsWith("ws_") ? "workspaces" : "users";
  const vaultRef = doc(db, collectionName, uid, "settings", "receitas_vault");
  try {
    const snap = await getDoc(vaultRef);
    if (snap.exists() && Array.isArray(snap.data()?.receitas)) {
      return snap.data().receitas;
    }
  } catch (err) {
    console.error("Erro ao carregar cofre de receitas da nuvem:", err);
  }
  return [];
}

// Persist last selected active month to cloud for seamless multi-device continuity
export async function saveLastPeriodToCloud(uid: string, period: string) {
  if (!period) return;
  const collectionName = uid.startsWith("ws_") ? "workspaces" : "users";
  const prefRef = doc(db, collectionName, uid, "settings", "preferences");
  try {
    await setDoc(prefRef, { lastPeriod: period, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.error("Erro ao salvar período ativo na nuvem:", err);
  }
}

export async function getLastPeriodFromCloud(uid: string): Promise<string | null> {
  const collectionName = uid.startsWith("ws_") ? "workspaces" : "users";
  const prefRef = doc(db, collectionName, uid, "settings", "preferences");
  try {
    const snap = await getDoc(prefRef);
    if (snap.exists() && typeof snap.data()?.lastPeriod === "string") {
      return snap.data().lastPeriod;
    }
  } catch (err) {
    console.error("Erro ao carregar período ativo da nuvem:", err);
  }
  return null;
}

// Persist custom cards to cloud
export async function saveCardsToCloud(uid: string, cards: import("../types").CardConfig[]) {
  if (!cards || cards.length === 0) return;
  const collectionName = uid.startsWith("ws_") ? "workspaces" : "users";
  const cardsRef = doc(db, collectionName, uid, "settings", "cards");
  try {
    await setDoc(cardsRef, { cards, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.error("Erro ao salvar cartões na nuvem:", err);
  }
}

export async function getCardsFromCloud(uid: string): Promise<import("../types").CardConfig[] | null> {
  const collectionName = uid.startsWith("ws_") ? "workspaces" : "users";
  const cardsRef = doc(db, collectionName, uid, "settings", "cards");
  try {
    const snap = await getDoc(cardsRef);
    if (snap.exists() && Array.isArray(snap.data()?.cards)) {
      return snap.data().cards;
    }
  } catch (err) {
    console.error("Erro ao carregar cartões da nuvem:", err);
  }
  return null;
}

