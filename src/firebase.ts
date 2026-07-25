import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyC34DSB-HrfHSIBqXeHpHaRtk9iJ8jCylY",
  authDomain: "eiken-vocab-app-40019.firebaseapp.com",
  projectId: "eiken-vocab-app-40019",
  storageBucket: "eiken-vocab-app-40019.firebasestorage.app",
  messagingSenderId: "190977332391",
  appId: "1:190977332391:web:b64d264b6d4b21b80cb782",
  databaseURL: "https://eiken-vocab-app-40019-default-rtdb.firebaseio.com",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
