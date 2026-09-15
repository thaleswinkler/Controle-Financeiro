import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
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

// Check saved user session
export function getStoredCloudSession(): CloudUserSession | null {
  try {
    const raw = localStorage.getItem(CLOUD_SESSION_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Erro ao ler sessão salva:", e);
  }
  return null;
}

export function storeCloudSession(session: CloudUserSession | null) {
  try {
    if (session) {
      localStorage.setItem(CLOUD_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(CLOUD_SESSION_KEY);
    }
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
  const session: CloudUserSession = {
    uid: user.uid,
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
