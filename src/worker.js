const json = (data, status=200) => new Response(JSON.stringify(data), {
  status, headers: {"content-type":"application/json; charset=utf-8", "cache-control":"no-store"}
});
const uid = () => crypto.randomUUID();
const hex = b => [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
async function sha256(value){return hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));}
function corsHeaders(request, env){
  const origin=request.headers.get("Origin")||"";
  const allowed=env.ALLOWED_ORIGIN||new URL(request.url).origin;
  return origin===allowed ? {"access-control-allow-origin":origin,"vary":"Origin","access-control-allow-headers":"authorization,content-type","access-control-allow-methods":"GET,POST,OPTIONS"} : {};
}
function response(data,status,request,env){const r=json(data,status);const h=new Headers(r.headers);for(const [k,v] of Object.entries(corsHeaders(request,env)))h.set(k,v);return new Response(r.body,{status,headers:h});}
async function auth(request,env){
  const token=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token) return null;
  const tokenHash=await sha256(token);
  const row=await env.DB.prepare(`SELECT u.id,u.name,u.email,u.role,u.status FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.status='active'`).bind(tokenHash,new Date().toISOString()).first();
  return row||null;
}
const requireRole=(user,...roles)=>!!user&&roles.includes(user.role);
export default {
 async fetch(request,env){
  if(request.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders(request,env)});
  const url=new URL(request.url), path=url.pathname, method=request.method;
  try{
   if(path==="/api/health"&&method==="GET") return response({ok:true,service:"Meu personal API"},200,request,env);

   if(path==="/api/public/plans"&&method==="GET"){
    const {results=[]}=await env.DB.prepare("SELECT id,name,description,price_cents,duration_days FROM plans WHERE active=1 ORDER BY price_cents").all();
    return response({plans:results},200,request,env);
   }

   if(path==="/api/auth/login"&&method==="POST"){
    const {email,password}=await request.json();
    if(!email||!password) return response({error:"Informe e-mail e senha."},400,request,env);
    const user=await env.DB.prepare("SELECT * FROM users WHERE email=? AND status='active'").bind(email.toLowerCase()).first();
    if(!user||!await verifyPassword(password,user.password_hash)) return response({error:"Credenciais inválidas."},401,request,env);
    const token=uid()+uid(), tokenHash=await sha256(token);
    const expires=new Date(Date.now()+7*86400000).toISOString();
    await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").bind(tokenHash,user.id,expires).run();
    return response({token,expiresAt:expires,user:{id:user.id,name:user.name,email:user.email,role:user.role}},200,request,env);
   }

   const user=await auth(request,env);
   if(path==="/api/auth/me"&&method==="GET") return user?response({user},200,request,env):response({error:"Não autenticado."},401,request,env);
   if(!user) return response({error:"Faça login para continuar."},401,request,env);

   if(path==="/api/workouts"&&method==="GET"){
    const studentId=user.role==="student"?user.id:(url.searchParams.get("studentId")||"");
    if(user.role==="student"||requireRole(user,"teacher","admin")){
      const q=studentId
       ? await env.DB.prepare("SELECT * FROM workouts WHERE student_id=? AND active=1 ORDER BY created_at DESC").bind(studentId).all()
       : (user.role==="admin"
        ? await env.DB.prepare("SELECT * FROM workouts WHERE active=1 ORDER BY created_at DESC").all()
        : await env.DB.prepare("SELECT * FROM workouts WHERE teacher_id=? AND active=1 ORDER BY created_at DESC").bind(user.id).all());
      return response({workouts:q.results||[]},200,request,env);
    }
   }

   if(path==="/api/workouts"&&method==="POST"&&requireRole(user,"teacher","admin")){
    const body=await request.json();
    if(!body.studentId||!body.title) return response({error:"Aluno e título são obrigatórios."},400,request,env);
    const student=user.role==="admin"
      ? await env.DB.prepare("SELECT id FROM users WHERE id=? AND role='student'").bind(body.studentId).first()
      : await env.DB.prepare("SELECT id FROM users WHERE id=? AND role='student' AND teacher_id=?").bind(body.studentId,user.id).first();
    if(!student) return response({error:"Aluno não encontrado."},404,request,env);
    const workoutId=uid();
    await env.DB.prepare("INSERT INTO workouts(id,student_id,teacher_id,title,training_day,instructions) VALUES(?,?,?,?,?,?)")
      .bind(workoutId,student.id,user.id,body.title,body.day||null,body.instructions||null).run();
    for(let i=0;i<(body.exercises||[]).length;i++){
      const e=body.exercises[i];
      await env.DB.prepare("INSERT INTO exercises(id,workout_id,name,sets,reps,rest_seconds,video_url,sort_order) VALUES(?,?,?,?,?,?,?,?)")
       .bind(uid(),workoutId,e.name,e.sets||null,e.reps||null,e.restSeconds||null,e.videoUrl||null,i).run();
    }
    return response({ok:true,workoutId},201,request,env);
   }

   if(path==="/api/questions"&&method==="POST"&&user.role==="student"){
    const body=await request.json();
    if(!body.question?.trim()) return response({error:"Escreva sua pergunta."},400,request,env);
    const questionId=uid();
    await env.DB.prepare("INSERT INTO questions(id,student_id,subject,question) VALUES(?,?,?,?)")
     .bind(questionId,user.id,body.subject||null,body.question.trim()).run();
    return response({ok:true,id:questionId},201,request,env);
   }
   if(path==="/api/questions"&&method==="GET"){
    const query=user.role==="student"
      ? env.DB.prepare("SELECT id,subject,question,answer,asked_at,answered_at FROM questions WHERE student_id=? ORDER BY asked_at DESC").bind(user.id)
      : user.role==="admin"
        ? env.DB.prepare("SELECT q.id,q.student_id,q.subject,q.question,q.answer,q.asked_at,q.answered_at,u.name AS student_name FROM questions q JOIN users u ON u.id=q.student_id ORDER BY q.asked_at DESC")
        : env.DB.prepare("SELECT q.id,q.student_id,q.subject,q.question,q.answer,q.asked_at,q.answered_at,u.name AS student_name FROM questions q JOIN users u ON u.id=q.student_id WHERE u.teacher_id=? ORDER BY q.asked_at DESC").bind(user.id);
    const result=await query.all();
    return response({questions:result.results||[]},200,request,env);
   }
   const answerMatch=path.match(/^\/api\/questions\/([a-f0-9-]+)\/answer$/i);
   if(answerMatch&&method==="POST"&&requireRole(user,"teacher","admin")){
    const {answer}=await request.json();
    if(!answer?.trim()) return response({error:"A resposta não pode ficar vazia."},400,request,env);
    const q=await env.DB.prepare("SELECT id FROM questions WHERE id=?").bind(answerMatch[1]).first();
    if(!q) return response({error:"Pergunta não encontrada."},404,request,env);
    await env.DB.prepare("UPDATE questions SET answer=?,answered_by=?,answered_at=CURRENT_TIMESTAMP WHERE id=?").bind(answer.trim(),user.id,q.id).run();
    return response({ok:true},200,request,env);
   }

   if(path==="/api/announcements"&&method==="GET"){
    const result=await env.DB.prepare("SELECT id,title,body,published_at FROM announcements WHERE active=1 AND audience IN ('all','students') ORDER BY published_at DESC").all();
    return response({announcements:result.results||[]},200,request,env);
   }
   if(path==="/api/announcements"&&method==="POST"&&requireRole(user,"teacher","admin")){
    const {title,body}=await request.json();
    if(!title?.trim()||!body?.trim()) return response({error:"Título e aviso são obrigatórios."},400,request,env);
    const announcementId=uid();
    await env.DB.prepare("INSERT INTO announcements(id,author_id,title,body,audience) VALUES(?,?,?,?,'all')").bind(announcementId,user.id,title.trim(),body.trim()).run();
    return response({ok:true,id:announcementId},201,request,env);
   }

   if(env.ASSETS) return env.ASSETS.fetch(request);
   return response({error:"Rota não encontrada."},404,request,env);
  }catch(err){console.error(err);return response({error:"Erro interno no servidor."},500,request,env);}
 }
};

async function verifyPassword(password,stored){
 // Formato: pbkdf2$iterations$saltHex$hashHex. Gerar hash apenas em ambiente seguro.
 try{
  const [kind,iterations,saltHex,expected]=stored.split("$");
  if(kind!=="pbkdf2") return false;
  const salt=new Uint8Array(saltHex.match(/.{2}/g).map(x=>parseInt(x,16)));
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:Number(iterations),hash:"SHA-256"},key,256);
  return hex(bits)===expected;
 }catch{return false;}
}
