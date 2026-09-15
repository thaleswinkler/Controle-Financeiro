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
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
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

// Authentication Helpers
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Erro no login com Google:", error);
    throw error;
  }
}

export async function loginWithEmail(email: string, pass: string) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return result.user;
  } catch (error: any) {
    console.error("Erro no login com email:", error);
    throw error;
  }
}

export async function registerWithEmail(email: string, pass: string) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    return result.user;
  } catch (error: any) {
    console.error("Erro no cadastro:", error);
    throw error;
  }
}

export async function logoutUser() {
  return signOut(auth);
}

// Subscribe to monthly data
export function subscribeToMonthData(
  userId: string,
  monthYear: string,
  onData: (data: FinancialData | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  // Sanitize doc id
  const docId = monthYear.replace(/[^a-zA-Z0-9_-]/g, "_");
  const monthRef = doc(db, "users", userId, "months", docId);

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
  userId: string,
  monthYear: string,
  data: FinancialData
) {
  const docId = monthYear.replace(/[^a-zA-Z0-9_-]/g, "_");
  const monthRef = doc(db, "users", userId, "months", docId);

  await setDoc(
    monthRef,
    {
      ...data,
      userId,
      monthYear,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

// Save user profile settings
export async function saveUserProfile(
  user: User,
  metaRiquezaPadrao?: number,
  investimentoAcumuladoAnterior?: number
) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || user.email?.split("@")[0] || "Usuário",
      metaRiquezaPadrao: metaRiquezaPadrao || 100000,
      investimentoAcumuladoAnterior: investimentoAcumuladoAnterior || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } else {
    await setDoc(
      userRef,
      {
        email: user.email || snap.data().email || "",
        displayName: user.displayName || snap.data().displayName || "Usuário",
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }
}
