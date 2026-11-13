import React,{useState} from 'react';import {X} from 'lucide-react';
export const PRI={High:'bg-rose-100 text-rose-600',Medium:'bg-amber-100 text-amber-700',Low:'bg-emerald-100 text-emerald-700'};
export const Pri=({p})=><span className={'chip '+PRI[p]}>{p}</span>;
export const Card=({className='',children,...r})=><div className={'glass rise p-5 '+className} {...r}>{children}</div>;
export const Title=({icon:I,children,right})=><div className="mb-4 flex items-center justify-between"><h3 className="flex items-center gap-2 text-lg font-bold">{I&&<I size={20} className="text-brand-600"/>}{children}</h3>{right}</div>;
export const Modal=({title,onClose,children})=><div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm" onClick={onClose}><div className="glass !bg-white/90 w-full max-w-md p-6" onClick={e=>e.stopPropagation()}><div className="mb-4 flex justify-between"><h3 className="text-lg font-bold">{title}</h3><button onClick={onClose} aria-label="Close"><X size={20}/></button></div>{children}</div></div>;
export const Page=({title,sub,right,children})=><div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-extrabold">{title}</h1><p className="text-sm text-ink/60">{sub}</p></div>{right}</div>{children}</div>;
export const Empty=({text})=><p className="rounded-2xl border border-dashed border-brand-200 p-6 text-center text-sm text-ink/50">{text}</p>;
export function TaskModal({task,onSave,onClose}){
const[t,setT]=useState(task||{title:'',project:'General',priority:'Medium',status:'todo',due:'2026-11-20'});const u=k=>e=>setT({...t,[k]:e.target.value});
return <Modal title={task?.id?'Edit task':'New task'} onClose={onClose}><div className="space-y-3">
<input className="inp" placeholder="Task title" value={t.title} onChange={u('title')} autoFocus/>
<input className="inp" placeholder="Project" value={t.project} onChange={u('project')}/>
<div className="grid grid-cols-3 gap-2"><select className="inp" value={t.priority} onChange={u('priority')}>{['High','Medium','Low'].map(x=><option key={x}>{x}</option>)}</select>
<select className="inp" value={t.status} onChange={u('status')}><option value="todo">To do</option><option value="doing">In progress</option><option value="done">Done</option></select>
<input type="date" className="inp" value={t.due} onChange={u('due')}/></div>
<button className="btn w-full" disabled={!t.title.trim()} onClick={()=>{onSave(t);onClose()}}>Save task</button></div></Modal>}
