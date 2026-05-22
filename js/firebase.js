const firebaseConfig = {
  apiKey: "AIzaSyCdkjsJbFqk0NWgmGxocRu80HtpMV8XP48",
  authDomain: "tyoaikakirjanpito.firebaseapp.com",
  projectId: "tyoaikakirjanpito",
  storageBucket: "tyoaikakirjanpito.firebasestorage.app",
  messagingSenderId: "766298930930",
  appId: "1:766298930930:web:3e58d6ba7d5ffb2b025a6b"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
