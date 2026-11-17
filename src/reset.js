import {initializeApp} from "firebase/app";
import {getAuth,verifyPasswordResetCode,confirmPasswordReset} from "firebase/auth";

const auth=getAuth(initializeApp({
  apiKey:import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:import.meta.env.VITE_FIREBASE_APP_ID
}));
const $=id=>document.getElementById(id);
const q=new URLSearchParams(location.search);
const code=q.get("oobCode");
const fail=t=>{$("t").textContent="Link problem";$("s").textContent="";$("m").innerHTML='<span class="err">'+t+'</span>'};

if(q.get("mode")!=="resetPassword"||!code) fail("Invalid or missing link.");
else verifyPasswordResetCode(auth,code)
  .then(email=>{$("t").textContent="Set a new password";$("s").textContent=email;$("f").hidden=false})
  .catch(()=>fail("This link is expired or already used. Request a new one."));

$("f").onsubmit=async e=>{
  e.preventDefault();
  if($("p1").value!==$("p2").value){$("m").innerHTML='<span class="err">Passwords do not match</span>';return}
  $("b").disabled=true;
  try{
    await confirmPasswordReset(auth,code,$("p1").value);
    $("f").hidden=true;$("m").textContent="";
    $("t").textContent="Password changed ✓";
    $("s").textContent="Now open FountHW and log in with your new password.";
  }catch(err){
    $("b").disabled=false;
    $("m").innerHTML='<span class="err">'+(err.code==="auth/weak-password"?"Password is too weak":"Something went wrong, request a new link")+'</span>';
  }
}