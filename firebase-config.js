// ---------------------------------------------------------------------------
// Firebase configuration
// ---------------------------------------------------------------------------
// 1. Go to https://console.firebase.google.com/ and create a project.
// 2. Add a "Web app" (</>) to the project and copy its config object here.
// 3. In the console, enable Firestore Database (Build > Firestore Database).
// 4. Paste the firestore.rules from this folder into Firestore > Rules.
//
// The values below are placeholders — replace ALL of them with your own.
// ---------------------------------------------------------------------------

// This app's own project — stores check-ins and any guests added in-app.
export const firebaseConfig = {
  apiKey: "AIzaSyBMqhXZziSDCkzB3RwQSK939Fc5DWlGOF8",
  authDomain: "aquacheckinapp.firebaseapp.com",
  projectId: "aquacheckinapp",
  storageBucket: "aquacheckinapp.firebasestorage.app",
  messagingSenderId: "23726942723",
  appId: "1:23726942723:web:80b947fed500b94a3e7c36",
  measurementId: "G-XV9ZCBJZ5J"
};

// AQUALocator project — the READ-ONLY source of the employee directory.
// The app reads employees live from this project; it never writes to it.
export const locatorConfig = {
  apiKey: "AIzaSyABeCFheLuS08mxfWjCSS2ugXFbLDgnpIE",
  authDomain: "aqualocator-23714.firebaseapp.com",
  projectId: "aqualocator-23714",
  storageBucket: "aqualocator-23714.appspot.com",
  messagingSenderId: "654848563347",
  appId: "1:654848563347:web:4702a6f55ccbf7d5edd566",
};

// Firestore collection path inside the AQUALocator project.
export const locatorEmployeesPath = "artifacts/default-app-id/public/data/employees";
