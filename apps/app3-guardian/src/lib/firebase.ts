import {initializeApp, getApps, type FirebaseApp} from 'firebase/app';
import {getAuth, GoogleAuthProvider, signInWithPopup, type Auth} from 'firebase/auth';
import {getFirestore, type Firestore} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Firebase 是 app3 的「未來可接選項」(per README)。本機 demo 不用登入也能跑。
// Init 用 try/catch guard + placeholder detection 包住，避免 demo config 噴錯阻止 module 載入。

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;
let _initError: string | null = null;

(function ensureInit() {
  // Placeholder detection：避免用 demo config 真的觸發 Firebase API
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes('demo') || firebaseConfig.projectId?.includes('placeholder')) {
    _initError = 'placeholder config — Firebase init 已跳過（本機 demo 模式）';
    return;
  }
  try {
    _app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    _db = getFirestore(_app, firebaseConfig.firestoreDatabaseId);
    _auth = getAuth(_app);
  } catch (error) {
    _initError = error instanceof Error ? error.message : String(error);
    console.warn('[firebase] init skipped:', _initError);
  }
})();

export const firebaseApp = _app;
export const db = _db;
export const auth = _auth;
export function getFirebaseInitError(): string | null { return _initError; }

export const signInWithGoogle = async () => {
  if (!_auth) {
    throw new Error(`本機展示模式未啟用 Firebase 登入：${_initError ?? '未初始化'}`);
  }
  const googleProvider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(_auth, googleProvider);
    return result.user;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google 登入暫時無法使用';
    throw new Error(`本機展示模式暫時無法登入：${message}`);
  }
};
