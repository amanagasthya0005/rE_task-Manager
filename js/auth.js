const session={role:null,user:null,isEditor(){return this.role==="editor"},isGuest(){return this.role==="guest"}};
async function authenticateEditor(username,password){
  if(username!=="rE_Task")return{ok:false,error:"Incorrect username or password."};
  if(!BackendSync.isConfigured())return{ok:false,error:"Connect the Supabase backend first."};
  const result=await BackendSync.signInEditor(password);
  if(!result.ok)return{ok:false,error:"Incorrect username or password."};
  session.user=result.user||null;
  return{ok:true};
}
