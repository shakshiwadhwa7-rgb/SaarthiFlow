import React,{createContext,useContext,useEffect,useState} from 'react';
const C=createContext();export const useApp=()=>useContext(C);
export const uid=()=>Math.random().toString(36).slice(2,9);
export const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const fmtD=d=>{if(!d)return'No date';const[,m,day]=d.split('-');return MONTHS[+m-1]+' '+ +day};
export const iso=(y,m,d)=>`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
export const TODAY=iso(2026,10,14);
const T=(title,project,priority,status,due)=>({id:uid(),title,project,priority,status,due});
const seed={
tasks:[T('Submit GSSoC application','Open Source','High','todo','2026-11-18'),T('Complete Azure AI-900 practice','Learning','Medium','done','2026-11-12'),T('Build SaarthiFlow MVP','Hackathon','High','doing','2026-11-20'),T('Paper review for agents','Research','Medium','todo','2026-11-22'),T('HackOWASP registration','Hackathon','High','todo','2026-11-17'),T('Infosys Internship Course','Internships','Low','doing','2026-11-25'),T('DBMS Phase 2 submission','College','High','todo','2026-12-02'),T('Prepare demo video','Hackathon','Medium','todo','2026-11-19')],
proposals:[{id:uid(),title:'Analyze HackOWASP hackathon page',source:'Agent Studio',created:Date.now()-3600e3,status:'pending',tasks:[{id:uid(),title:'Register team for HackOWASP',priority:'High',due:'2026-11-17',project:'Hackathon'},{id:uid(),title:'Draft problem statement',priority:'Medium',due:'2026-11-21',project:'Hackathon'}]}],
activity:[{id:uid(),at:Date.now()-7200e3,type:'Plan',title:'Analyzed webpage (demo)',detail:'Extracted deadlines and requirements',source:'Agent Studio',status:'Completed'}],
settings:{name:'Riya',email:'riya@example.com',role:'Student Developer',weekStart:'Mon',notify:true,demo:true}};
export function Store({children}){
const[s,set]=useState(()=>{try{return{...seed,...JSON.parse(localStorage.getItem('sf-v1')||'{}')}}catch{return seed}});
useEffect(()=>{localStorage.setItem('sf-v1',JSON.stringify(s))},[s]);
const log=(a,type,title,detail,source,status='Completed')=>({...a,activity:[{id:uid(),at:Date.now(),type,title,detail,source,status},...a.activity]});
const api={...s,
addTask:t=>set(a=>log({...a,tasks:[{...t,id:uid()},...a.tasks]},'Task','Task created: '+t.title,t.project+' · due '+fmtD(t.due),'My Space')),
updateTask:t=>set(a=>log({...a,tasks:a.tasks.map(x=>x.id===t.id?t:x)},'Task','Task updated: '+t.title,'Status: '+t.status,'My Space')),
deleteTask:id=>set(a=>{const t=a.tasks.find(x=>x.id===id);return log({...a,tasks:a.tasks.filter(x=>x.id!==id)},'Task','Task deleted: '+t?.title,'Removed from My Space','My Space','Cancelled')}),
toggleTask:id=>set(a=>{const t=a.tasks.find(x=>x.id===id);const d=t.status!=='done';return log({...a,tasks:a.tasks.map(x=>x.id===id?{...x,status:d?'done':'todo'}:x)},'Task',(d?'Completed: ':'Reopened: ')+t.title,'Status changed','My Space')}),
addProposal:p=>set(a=>log({...a,proposals:[{...p,id:uid(),created:Date.now(),status:'pending'},...a.proposals]},'Plan','Plan sent for approval: '+p.title,p.tasks.length+' proposed tasks','Agent Studio','Pending')),
decide:(id,ok,tasks)=>set(a=>{const p=a.proposals.find(x=>x.id===id);if(!p||p.status!=='pending')return a;
const list=tasks||p.tasks;const np={...p,tasks:list,status:ok?'approved':'rejected',decidedAt:Date.now()};
const nt=ok?list.map(t=>({...t,id:uid(),status:'todo'})):[];
return log({...a,proposals:a.proposals.map(x=>x.id===id?np:x),tasks:[...nt,...a.tasks]},'Approval',(ok?'Approved: ':'Rejected: ')+p.title,ok?nt.length+' tasks created in My Space':'No tasks created','Approvals',ok?'Completed':'Rejected')}),
logOnly:(type,title,detail,source)=>set(a=>log(a,type,title,detail,source)),
saveSettings:v=>set(a=>log({...a,settings:v},'Settings','Settings saved','Preferences updated locally','Settings')),
reset:()=>{localStorage.removeItem('sf-v1');location.reload()}};
return <C.Provider value={api}>{children}</C.Provider>}
