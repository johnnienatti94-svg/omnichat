'use client';
import {useEffect,useRef,useState} from 'react';
import {
  Inbox,Users,MessageSquare,Plug,Search,Check,ArrowUpRight,Camera,Music2,Send,
  ChevronDown,Store,BarChart3,ArrowLeft,UserRound,Plus,StickyNote,PanelRight,
  RefreshCw,CheckCheck,Clock3,ShieldCheck,FileText,ExternalLink,Shield,UserCheck,
  Sparkles,CheckCircle2,TrendingUp,DollarSign,AlertCircle,Zap,Bot,MessageCircle
} from 'lucide-react';
import {SidebarProvider,Sidebar,SidebarHeader,SidebarContent,SidebarMenu,SidebarMenuItem,SidebarMenuButton,SidebarFooter,SidebarTrigger} from '@/components/ui/sidebar';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Sheet,SheetContent,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
import {Toaster} from '@/components/ui/sonner';
import {toast} from 'sonner';
import {
  demoConversations,defaultReplies,channelNames,defaultStaff,roleLabels,
  type Conversation,type QuickReply,type Channel,type StaffUser,type Team
} from '@/lib/inbox-data';
import TeamManagement from '@/components/team/team-management';
import AutomationSettings from '@/components/settings/automation-settings';
import DashboardView from '@/components/analytics/dashboard-view';
import { calculateCaseMetrics, formatCurrencyTHB, isWithinReopenWindow } from '@/lib/ticket-lifecycle';

type View='Inbox'|'Contacts'|'Saved replies'|'Overview'|'Connections'|'Team'|'Automations';
type Setup={channel:Channel;account:string;url:string};
const channels=Object.keys(channelNames) as Channel[];

function ChannelIcon({channel,small=false}:{channel:Channel;small?:boolean}){
  const Icon=channel==='facebook'?MessageSquare:channel==='instagram'?Camera:channel==='tiktok'?Music2:MessageCircle;
  return <span className={`channel-icon ${channel} ${small?'small':''}`}><Icon size={small?12:19}/></span>;
}

function Avatar({c,large=false}:{c:Conversation;large?:boolean}){
  return <div className={`avatar tone${Number(c.id.slice(-1))%6} ${large?'large':''}`}>{c.name.slice(0,1)}{!large&&<ChannelIcon channel={c.channel} small/>}</div>;
}

function Picker({value,onChange,items,label}:{value:string;onChange:(v:string)=>void;items:[string,string][];label:string}){
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="picker"><SelectValue/></SelectTrigger><SelectContent>{items.map(([v,n])=><SelectItem key={v} value={v}>{n}</SelectItem>)}</SelectContent></Select>;
}

export default function Workspace(){
 const [view,setView]=useState<View>('Inbox');
 const [data,setData]=useState<Conversation[]>(demoConversations);
 const [replies,setReplies]=useState<QuickReply[]>(defaultReplies);
 const [setup,setSetup]=useState<Setup[]>([]);
 const [staffUsers,setStaffUsers]=useState<StaffUser[]>(defaultStaff as any);
 const [teams,setTeams]=useState<Team[]>([]);
 const [activeUserId,setActiveUserId]=useState<string>('user-admin');

 const [selected,setSelected]=useState('demo-1');
 const [channel,setChannel]=useState('all');
 const [status,setStatus]=useState('open');
 const [scope,setScope]=useState('all');
 const [search,setSearch]=useState('');
 const [mode,setMode]=useState('demo');

 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [preview,setPreview]=useState(false);
 const [mobileChat,setMobileChat]=useState(false);
 const [detailOpen,setDetailOpen]=useState(false);

 const [drafts,setDrafts]=useState<Record<string,string>>({});
 const [composeMode,setComposeMode]=useState('out');
 const [quickOpen,setQuickOpen]=useState(false);
 const [editReply,setEditReply]=useState<QuickReply|null>(null);
 const [connect,setConnect]=useState<Channel|null>(null);
 const [account,setAccount]=useState('');
 const [url,setUrl]=useState('');
 const [notes,setNotes]=useState('');
 const [salesInput,setSalesInput]=useState<string>('');
 const messagePanel=useRef<HTMLDivElement>(null);

 // Resolve with Sales Outcome Dialog State
 const [resolveModalOpen, setResolveModalOpen] = useState(false);
 const [resolveData, setResolveData] = useState({
   successful: false,
   amount: 0,
   resolution: 'solved',
   issue_type: 'Product enquiry',
 });

 async function load(){
   setError('');
   try{
     const r=await fetch('/api/workspace');
     const j:any=await r.json();
     if(r.status===401){setPreview(true);return;}
     if(!r.ok)throw new Error(j.error);
     setData(j.conversations);
     setReplies(j.replies);
     setSetup(j.setup);
     if(j.users&&j.users.length)setStaffUsers(j.users);
     if(j.teams)setTeams(j.teams);
     setPreview(false);
   }catch(e){
     setError(e instanceof Error?e.message:'Unable to load workspace');
   }finally{
     setLoading(false);
   }
 }

 useEffect(()=>{void load()},[]);

 const activeUser=staffUsers.find(u=>u.id===activeUserId)||staffUsers[0];
 const allowedChannels=activeUser&&activeUser.channel_access!=='all'&&Array.isArray(activeUser.channel_access)?activeUser.channel_access:channels;

 const visible=data.filter(c=>
   allowedChannels.includes(c.channel)&&
   (channel==='all'||c.channel===channel)&&
   c.status===status&&
   (scope==='all'||(scope==='mine'&&(c.assignee==='me'||c.assignee===activeUserId))||(scope==='unassigned'&&!c.assignee))&&
   (c.name+' '+c.handle+' '+c.tag+' '+c.messages.map(m=>m.body).join(' ')).toLowerCase().includes(search.toLowerCase())
 );

 const c=data.find(c=>c.id===selected);
 const draft=drafts[selected]||'';

 useEffect(()=>{
   const panel=messagePanel.current;
   if(panel)panel.scrollTop=panel.scrollHeight;
 },[selected,c?.messages.length,view,mode]);

 useEffect(()=>{
   setNotes(c?.notes||'');
   setSalesInput(c?.sales_amount ? String(c.sales_amount) : '');
 },[selected,c?.notes,c?.sales_amount]);

 async function action(payload:Record<string,unknown>){
   if(preview){toast.error('Sign in to save changes in the published workspace.');return false;}
   setSaving(true);
   try{
     const r=await fetch('/api/actions',{
       method:'POST',
       headers:{'Content-Type':'application/json'},
       body:JSON.stringify(payload)
     });
     const j:any=await r.json();
     if(!r.ok)throw new Error(j.error);
     await load();
     return true;
   }catch(e){
     toast.error(e instanceof Error?e.message:'Could not save');
     return false;
   }finally{
     setSaving(false);
   }
 }

 async function update(p:Record<string,unknown>){
   if(c&&await action({action:'update',id:c.id,...p}))toast.success('Conversation updated');
 }

 async function send(){
   if(!c||!draft.trim()||saving)return;
   const id=c.id;
   if(await action({action:'reply',id,body:draft.trim(),direction:composeMode,requestId:crypto.randomUUID()})){
     setDrafts(d=>({...d,[id]:''}));
     toast.success(composeMode==='note'?'Internal note saved':'Demo reply saved — not sent to a customer');
   }
 }

 function openResolveModal() {
   if (!c) return;
   setResolveData({
     successful: Boolean(c.sales_successful),
     amount: c.sales_amount || 0,
     resolution: c.resolution || 'solved',
     issue_type: c.issue_type || c.tag || 'Product enquiry',
   });
   setResolveModalOpen(true);
 }

 async function handleConfirmResolve(e: React.FormEvent) {
   e.preventDefault();
   if (!c) return;
   const ok = await action({
     action: 'resolveWithSales',
     id: c.id,
     sales_amount: resolveData.successful ? resolveData.amount : 0,
     sales_successful: resolveData.successful,
     resolution: resolveData.resolution,
     issue_type: resolveData.issue_type,
   });
   if (ok) {
     setResolveModalOpen(false);
     toast.success(
       resolveData.successful
         ? `Ticket resolved: Sale of ฿${resolveData.amount.toLocaleString()} recorded!`
         : 'Ticket marked as resolved.'
     );
   }
 }

 function choose(x:Conversation){setSelected(x.id);setMobileChat(true)}
 function navigate(v:View){setView(v);setMobileChat(false);setSearch('')}
 function openConnection(ch:Channel){
   setConnect(ch);
   const s=setup.find(s=>s.channel===ch);
   setAccount(s?.account||'');
   setUrl(s?.url||'');
 }

 useEffect(()=>{
   const ctx=(document as any).modelContext;
   if(!ctx?.registerTool)return;
   const lifecycle=new AbortController();
   Promise.resolve(ctx.registerTool({
     name:'filter_meepro_inbox',
     description:'Filter the visible demo inbox by channel and open or closed status. Does not send messages.',
     inputSchema:{
       type:'object',
       properties:{channel:{enum:['all','facebook','instagram','tiktok','line']},status:{enum:['open','closed']}},
       required:['channel','status'],
       additionalProperties:false
     },
     annotations:{readOnlyHint:true},
     execute:async(input:any)=>{
       if(!['all',...channels].includes(input.channel)||!['open','closed'].includes(input.status))throw new Error('Invalid inbox filter');
       setView('Inbox');setMode('demo');setChannel(input.channel);setStatus(input.status);setScope('all');setSearch('');
       return {channel:input.channel,status:input.status};
     }
   },{signal:lifecycle.signal})).catch(()=>{});
   return()=>lifecycle.abort();
 },[]);

 const totalOpen=data.filter(c=>allowedChannels.includes(c.channel)&&c.status==='open').length;
 const caseMetrics = calculateCaseMetrics(data);

 const assignOptions:[string,string][]=[
   ['none','Unassigned'],
   ['me','Assigned to me'],
   ...staffUsers.map(u=>[u.id,`${u.name} (${roleLabels[u.role]?.th||u.role})`] as [string,string])
 ];

 const detail=c&&<>
   <div className="person-summary">
     <Avatar c={c} large/>
     <h2>{c.name}</h2>
     <p>@{c.handle}</p>
     <span className="soft-label"><ChannelIcon channel={c.channel} small/>{channelNames[c.channel]}</span>
   </div>

   {/* AI INSIGHTS & CSAT (Section 6) */}
   <div className="detail-block bg-slate-50/70 rounded-lg mx-3 p-3 border border-slate-100 mb-3">
     <div className="flex items-center justify-between mb-2">
       <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
         <Sparkles size={12} className="text-orange-500" /> AI CSAT & SUMMARY
       </span>
       <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
         CSAT: 96% 😊
       </span>
     </div>
     <p className="text-xs text-slate-600 bg-white p-2.5 rounded border border-slate-200/70 leading-relaxed">
       {c.tag === 'Installments'
         ? 'Customer is inquiring about iPhone installment conditions. Recommends sending /pay quick reply.'
         : c.tag === 'Product enquiry'
         ? 'Customer interested in iPhone 15 Pink availability. High purchase intent.'
         : c.tag === 'Accessories'
         ? 'Customer looking for case compatibility. Recommends sending /stock quick reply.'
         : 'Customer service inquiry in progress.'}
     </p>
   </div>

   {/* CASE FIELDS & SALES TRACKING (Section 6) */}
   <div className="detail-block">
     <label className="flex items-center justify-between">
       <span>SALES OUTCOME (บันทึกการขาย)</span>
       <span className="text-xs text-orange-600 font-medium">฿ THB</span>
     </label>
     <div className="space-y-2 mt-1">
       <div className="flex items-center gap-2">
         <input
           type="number"
           placeholder="Total sales ฿"
           value={salesInput}
           onChange={(e) => setSalesInput(e.target.value)}
           onBlur={() => void update({ sales_amount: Number(salesInput) || 0 })}
           className="w-full border border-slate-200 rounded p-1.5 text-xs bg-white"
         />
         <label className="flex items-center gap-1.5 text-xs whitespace-nowrap cursor-pointer">
           <input
             type="checkbox"
             checked={Boolean(c.sales_successful)}
             onChange={(e) => void update({ sales_successful: e.target.checked })}
           />
           <span className="text-emerald-700 font-medium">Sale Won</span>
         </label>
       </div>
     </div>

     <label className="mt-4">ASSIGNED TO (ผู้ดูแลเคส)</label>
     <Picker label="Assign conversation" value={c.assignee||'none'} onChange={v=>void update({assignee:v==='none'?'':v})} items={assignOptions}/>
     
     <label className="mt-4">PRIORITY (ระดับความสำคัญ)</label>
     <Picker label="Priority" value={c.priority||'normal'} onChange={v=>void update({priority:v})} items={[['urgent','🔴 Urgent (ด่วนที่สุด)'],['high','🟠 High (ด่วน)'],['normal','🔵 Normal (ปกติ)'],['low','⚪ Low (ต่ำ)']]}/>

     <label className="mt-4">ISSUE TYPE (ประเภทปัญหา/การสอบถาม)</label>
     <Picker
       label="Issue type"
       value={c.issue_type || c.tag || 'none'}
       onChange={(v) => void update({ issue_type: v === 'none' ? '' : v })}
       items={[
         ['none', 'Not selected'],
         ['Product enquiry', 'Product enquiry (สอบถามสินค้า)'],
         ['Installments', 'Installments (ผ่อนชำระ)'],
         ['Accessories', 'Accessories (อุปกรณ์เสริม)'],
         ['Store visit', 'Store visit (หน้าร้าน)'],
         ['After-sales', 'After-sales (บริการหลังการขาย)'],
       ]}
     />

     <label className="mt-4">RESOLUTION (ผลการปิดเคส)</label>
     <Picker
       label="Resolution"
       value={c.resolution || 'none'}
       onChange={(v) => void update({ resolution: v === 'none' ? '' : v })}
       items={[
         ['none', 'Pending / In progress'],
         ['solved', 'Solved (ปิดการขาย/บริการสำเร็จ)'],
         ['unresponsive', 'Unresponsive (ลูกค้าไม่ตอบกลับ)'],
         ['cancelled', 'Cancelled (ลูกค้ายกเลิก)'],
         ['escalated', 'Escalated (ส่งต่อเคส)'],
       ]}
     />
   </div>

   <div className="detail-block">
     <label>CUSTOMER NOTES <StickyNote size={14}/></label>
     <textarea aria-label="Customer notes" placeholder="Add details for your next conversation…" value={notes} onChange={e=>setNotes(e.target.value)} maxLength={4000}/>
     <button className="text-button" disabled={saving||notes===c.notes} onClick={()=>void update({notes})}>Save notes</button>
   </div>

   <div className="detail-block">
     <label>ABOUT THIS CONTACT</label>
     <p className="meta-line"><span>Channel</span><b>{channelNames[c.channel]}</b></p>
     <p className="meta-line"><span>Status</span><b>{c.status==='open'?'Open':'Resolved'}</b></p>
     {c.closed_at && (
       <p className="meta-line"><span>Closed</span><b>{new Date(c.closed_at).toLocaleDateString('th-TH')}</b></p>
     )}
   </div>
 </>;

 return (
   <SidebarProvider style={{'--sidebar-width':'224px'} as React.CSSProperties}>
     <Toaster richColors position="top-center"/>
     <Sidebar>
       <SidebarHeader className="brand">
         <div className="brand-mark">m</div>
         <div><b>MeePro<span> inbox</span></b><small>Customer workspace</small></div>
       </SidebarHeader>
       <SidebarContent>
         <div className="workspace-name"><Store size={17}/> MeePro Phone <ShieldCheck size={15}/></div>
         <div className="section-label">WORKSPACE</div>
         <SidebarMenu>
           {([
             [Inbox,'Inbox'],
             [Users,'Contacts'],
             [MessageSquare,'Saved replies'],
             [BarChart3,'Overview'],
             [Plug,'Connections'],
             [Shield,'Team'],
             [Zap,'Automations'],
           ] as const).map(([Icon,label])=>(
             <SidebarMenuItem key={label}>
               <SidebarMenuButton isActive={view===label} onClick={()=>navigate(label as View)}>
                 <Icon/>
                 <span>{label}</span>
                 {label==='Inbox'&&<span className="nav-count">{mode==='demo'?totalOpen:0}</span>}
                 {label==='Team'&&<span className="nav-count">{staffUsers.length}</span>}
               </SidebarMenuButton>
             </SidebarMenuItem>
           ))}
         </SidebarMenu>

         <div className="section-label channel-label">CHANNELS</div>
         {channels.map(ch=>{
           const allowed = allowedChannels.includes(ch);
           return (
             <button
               className={'channel-nav '+(view==='Inbox'&&channel===ch?'active':'')+(allowed?'':' opacity-50 cursor-not-allowed')}
               key={ch}
               disabled={!allowed}
               onClick={()=>{
                 if(!allowed) return;
                 navigate('Inbox');
                 setChannel(ch);
                 setStatus('open');
               }}
             >
               <ChannelIcon channel={ch}/>
               <span>{channelNames[ch]}</span>
               <span className="channel-status" title={allowed?'Accessible':'Restricted for your role'}/>
             </button>
           );
         })}

         <div className="side-help">
           <div className="connect-symbol"><Plug size={20}/></div>
           <b>Bring your chats together.</b>
           <p>Your next great customer conversation starts here.</p>
           <button onClick={()=>navigate('Connections')}>Set up channels <ArrowUpRight size={15}/></button>
         </div>
       </SidebarContent>

       <SidebarFooter>
         <div className="profile">
           <div className="avatar">
             {activeUser?.name.slice(0, 2).toUpperCase() || 'MP'}
           </div>
           <div>
             <b>{activeUser?.name || 'MeePro Owner'}</b>
             <small>
               <ShieldCheck size={11}/> {roleLabels[activeUser?.role || 'admin']?.th || 'Owner access'}
             </small>
           </div>
         </div>
       </SidebarFooter>
     </Sidebar>

     <main className="main">
       <header className="topbar">
         <SidebarTrigger/>
         <span>Workspace <span className="slash">/</span> <b>{view}</b></span>

         <div className="top-right">
           {/* ACTIVE USER / ROLE SWITCHER */}
           <div className="flex items-center gap-2">
             <span className="text-xs text-slate-400">Viewing as:</span>
             <Select value={activeUserId} onValueChange={setActiveUserId}>
               <SelectTrigger className="h-7 text-xs bg-slate-50 border border-slate-200 rounded px-2">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 {staffUsers.map((u)=>(
                   <SelectItem key={u.id} value={u.id}>
                     {u.name} ({roleLabels[u.role]?.th})
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>

           <span className="demo-badge">{mode==='demo'?'Demo workspace':'Live workspace'}</span>
           <div className="mini-avatar">
             {activeUser?.name.slice(0, 1).toUpperCase() || 'M'}
           </div>
         </div>
       </header>

       <div className="pageheading">
         <div>
           <h1>
             {view}
             {view==='Inbox'&&<span className="heading-count">{mode==='demo'?totalOpen:0}</span>}
           </h1>
           <p>
             {({
               Inbox:'Every customer conversation, in one place.',
               Contacts:'The people behind every conversation.',
               'Saved replies':'A thoughtful answer, without typing it twice.',
               Overview:'A clear view of sales results and customer conversations.',
               Connections:'Bring Facebook, Instagram and TikTok Shop into MeePro.',
               Team:'Manage staff members, roles, channel permissions, and working hours.',
               Automations:'Configure automatic bot responses, keyword tags, and intelligent routing.',
             })[view]}
           </p>
         </div>
         {view==='Saved replies'?(
           <button className="primary" onClick={()=>setEditReply({id:crypto.randomUUID(),title:'',body:''})}>
             <Plus size={17}/>New reply
           </button>
         ):view==='Team'?(
           <button className="primary" onClick={()=>(document.querySelector('[data-add-user]') as any)?.click?.()}>
             <Plus size={16}/>Add Staff
           </button>
         ):(
           <button className="outline" onClick={()=>navigate('Connections')}>
             <Plug size={16}/>Channel setup
           </button>
         )}
       </div>

       <div className="workspace-notice">
         <span>
           <span className="demo-dot"/>
           {mode==='demo'
             ?'Sample conversations • Replies stay in this demo.'
             :'No channels connected • Live messages are not available yet.'}
         </span>
         <Tabs value={mode} onValueChange={setMode}>
           <TabsList>
             <TabsTrigger value="demo">Demo</TabsTrigger>
             <TabsTrigger value="live">Live</TabsTrigger>
           </TabsList>
         </Tabs>
       </div>

       {error&&<div className="error-banner" role="alert">{error}<button onClick={()=>void load()}><RefreshCw size={14}/>Retry</button></div>}
       {preview&&<div className="preview-notice">Read-only preview. Open the published workspace to save replies and notes.</div>}

       {/* INBOX VIEW */}
       {view==='Inbox'&&(
         mode==='live'?(
           <div className="empty-workspace">
             <div className="empty-icon"><Inbox size={32}/></div>
             <h2>Your live inbox starts here</h2>
             <p>Authorize your business accounts to receive customer messages. No accounts have been connected yet.</p>
             <button className="primary" onClick={()=>navigate('Connections')}>
               Set up your first channel <ArrowUpRight size={16}/>
             </button>
             <button className="text-button" onClick={()=>setMode('demo')}>
               Explore with sample conversations
             </button>
           </div>
         ):(
           <div className={'workspace-grid '+(mobileChat?'chat-open':'')}>
             <section className="threadlist">
               <div className="list-tools">
                 <div className="searchbox">
                   <Search size={16}/>
                   <input aria-label="Search conversations" placeholder="Search conversations…" value={search} onChange={e=>setSearch(e.target.value)}/>
                 </div>
                 <div className="filter-row">
                   <Picker
                     label="Filter channel"
                     value={channel}
                     onChange={setChannel}
                     items={[['all','All channels'],...channels.filter(c=>allowedChannels.includes(c)).map(c=>[c,channelNames[c]] as [string,string])]}
                   />
                   <Picker
                     label="Filter assignment"
                     value={scope}
                     onChange={setScope}
                     items={[['all','All inboxes'],['mine','Mine'],['unassigned','Unassigned']]}
                   />
                 </div>
                 <Tabs value={status} onValueChange={setStatus}>
                   <TabsList variant="line" className="inbox-tabs">
                     <TabsTrigger value="open">Open <span>{totalOpen}</span></TabsTrigger>
                     <TabsTrigger value="closed">Resolved <span>{data.filter(c=>allowedChannels.includes(c.channel)&&c.status==='closed').length}</span></TabsTrigger>
                   </TabsList>
                 </Tabs>
               </div>

               <div className="thread-scroll">
                 {visible.map(x=>(
                   <button
                     aria-label={`Open ${x.name} conversation`}
                     className={'thread '+(c?.id===x.id?'selected':'')}
                     key={x.id}
                     onClick={()=>choose(x)}
                   >
                     <Avatar c={x}/>
                     <div className="thread-info">
                       <div className="thread-top">
                         <b>{x.name}</b>
                         <span>{x.assignee==='me'||x.assignee===activeUserId?'Mine':x.status==='closed'?'Resolved':'Open'}</span>
                       </div>
                       <p>{x.messages.at(-1)?.body}</p>
                       <div className="thread-bottom">
                         <span className="tag">{x.tag||channelNames[x.channel]}</span>
                         {x.priority&&x.priority!=='normal'&&(
                           <span className={`tag ${x.priority==='urgent'?'bg-red-50 text-red-700 border-red-200 font-semibold':'bg-amber-50 text-amber-700 border-amber-200'}`}>
                             {x.priority}
                           </span>
                         )}
                         {Boolean(x.sales_successful)&&(
                           <span className="tag bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
                             ฿{(x.sales_amount||0).toLocaleString()}
                           </span>
                         )}
                         <span className="thread-platform">{x.channel==='tiktok'?'TikTok':channelNames[x.channel]}</span>
                       </div>
                     </div>
                   </button>
                 ))}
                 {!visible.length&&(
                   <div className="list-empty">
                     <Search size={24}/>
                     <b>No conversations found</b>
                     <p>
                       {allowedChannels.length < 3
                         ? `Viewing as ${activeUser?.name} (${roleLabels[activeUser?.role || 'agent']?.th}), restricted to ${allowedChannels.map(c=>channelNames[c]).join(', ')}.`
                         : 'Try another search or filter.'}
                     </p>
                     <button className="text-button" onClick={()=>{setSearch('');setChannel('all');setScope('all');setStatus('open')}}>
                       Clear filters
                     </button>
                   </div>
                 )}
               </div>
               <footer className="list-footer">
                 {visible.length} conversations <span>{allowedChannels.length<3?`Filtered for ${activeUser?.name}`:'Sample data'}</span>
               </footer>
             </section>

             {c?(
               <section className="conversation">
                 <header>
                   <button className="icon-button mobile-back" aria-label="Back to conversations" onClick={()=>setMobileChat(false)}>
                     <ArrowLeft size={20}/>
                   </button>
                   <Avatar c={c}/>
                   <div className="conversation-title">
                     <b>{c.name}</b>
                     <small>{channelNames[c.channel]} <span>·</span> MeePro Phone</small>
                   </div>
                   
                   {/* RESOLVE BUTTON / MODAL TRIGGER */}
                   {c.status==='open'?(
                     <button className="outline resolve-button" disabled={saving} onClick={openResolveModal}>
                       <Check size={16}/>Resolve & Record Sale
                     </button>
                   ):(
                     <button className="outline resolve-button" disabled={saving} onClick={()=>void update({status:'open'})}>
                       <RefreshCw size={14}/>Reopen Case
                     </button>
                   )}

                   <button className="icon-button detail-toggle" aria-label="Customer details" onClick={()=>setDetailOpen(true)}>
                     <PanelRight size={19}/>
                   </button>
                 </header>

                 <div className="chat-context">
                   <span><ChannelIcon channel={c.channel} small/> {channelNames[c.channel]} conversation</span>
                   <div className="flex gap-1.5 items-center">
                     {c.priority&&c.priority!=='normal'&&(
                       <span className="tag font-medium text-orange-700 bg-orange-50 border-orange-200">
                         {c.priority}
                       </span>
                     )}
                     <span className="tag">{c.tag}</span>
                   </div>
                 </div>

                 <div className="messages" ref={messagePanel}>
                   <div className="day">SAMPLE CONVERSATION</div>
                   {c.messages.map(m=>(
                     <div className={'message-row '+m.direction} key={m.id}>
                       {m.direction==='note'?(
                         <div className="internal-note">
                           <StickyNote size={14}/>
                           <div>
                             <b>Internal note</b>
                             <p>{m.body}</p>
                           </div>
                         </div>
                       ):(
                         <>
                           <div className={'bubble '+(m.direction==='out'?'outgoing':'incoming')+(m.delivery_status==='automated'?' border border-violet-300 dark:border-violet-700 bg-violet-50/60 dark:bg-violet-950/30':'')}>
                             {m.body}
                           </div>
                           <small>
                             {m.delivery_status==='automated'?(
                               <span className="inline-flex items-center gap-0.5 text-violet-600 dark:text-violet-400 font-semibold mr-1">
                                 <Bot size={11}/> Bot Auto-Reply ·
                               </span>
                             ):m.direction==='out'?'MeePro · ':''}
                             {new Date(m.created_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'})}
                             {m.direction==='out'&&<CheckCheck size={12}/>}
                           </small>
                         </>
                       )}
                     </div>
                   ))}
                 </div>

                 {c.status==='open'?(
                   <div className={'composer '+(composeMode==='note'?'note-mode':'')}>
                     {/* SLASH / SHORTCUT DETECTOR */}
                     {draft.startsWith('/')&&(
                       <div className="bg-orange-50/90 border-b border-orange-200 p-2 flex flex-wrap items-center gap-2 text-xs">
                         <span className="font-semibold text-orange-900 flex items-center gap-1">
                           <Sparkles size={13}/> Quick Reply Shortcuts:
                         </span>
                         {replies
                           .filter(r => (r.shortcut || '').toLowerCase().includes(draft.toLowerCase()) || r.title.toLowerCase().includes(draft.slice(1).toLowerCase()))
                           .map(r => (
                             <button
                               key={r.id}
                               type="button"
                               onClick={() => setDrafts(d => ({ ...d, [selected]: r.body }))}
                               className="bg-white border border-orange-300 px-2 py-0.5 rounded shadow-xs text-orange-950 hover:bg-orange-100 flex items-center gap-1"
                             >
                               <span className="font-mono font-bold text-orange-600">{r.shortcut || `/${r.id}`}</span>
                               <span>{r.title}</span>
                             </button>
                           ))}
                       </div>
                     )}

                     <Tabs value={composeMode} onValueChange={setComposeMode}>
                       <TabsList variant="line">
                         <TabsTrigger value="out"><MessageSquare size={14}/>Reply</TabsTrigger>
                         <TabsTrigger value="note"><StickyNote size={14}/>Internal note</TabsTrigger>
                       </TabsList>
                     </Tabs>
                     <textarea
                       aria-label={composeMode==='note'?'Write internal note':'Write a reply'}
                       placeholder={composeMode==='note'?'Leave a note for your next conversation…':'Write a friendly reply… (Type / for saved replies)'}
                       value={draft}
                       onChange={e=>setDrafts(d=>({...d,[selected]:e.target.value}))}
                       maxLength={4000}
                       onKeyDown={e=>{
                         if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){
                           e.preventDefault();
                           void send();
                         }
                       }}
                     />
                     <div className="composer-bottom">
                       <button className="text-button" onClick={()=>setQuickOpen(true)}>
                         <FileText size={16}/>Saved replies
                       </button>
                       <button className="primary" disabled={saving||loading||!draft.trim()} onClick={()=>void send()}>
                         {saving?'Saving…':composeMode==='note'?'Save note':'Send demo reply'}
                         <Send size={15}/>
                       </button>
                     </div>
                     <div className="composer-caption">
                       {composeMode==='note'?'Private note · Never sent to customers':'Demo only · No message is sent to Facebook, Instagram or TikTok'}
                     </div>
                   </div>
                 ):(
                   <div className="resolved-notice">
                     <CheckCheck size={20}/>
                     <div>
                       <b>This conversation is resolved.</b>
                       {Boolean(c.sales_successful) && (
                         <span className="ml-2 text-emerald-700 font-semibold">
                           (Sale Outcome: ฿{(c.sales_amount||0).toLocaleString()})
                         </span>
                       )}
                     </div>
                     <button className="text-button" disabled={saving} onClick={()=>void update({status:'open'})}>
                       Reopen to reply
                     </button>
                   </div>
                 )}
               </section>
             ):(
               <div className="empty-workspace"><h2>Select a conversation</h2></div>
             )}

             <aside className="details">
               <div className="details-title">Contact details <UserRound size={16}/></div>
               {detail}
             </aside>
           </div>
         )
       )}

       {/* CONTACTS VIEW */}
       {view==='Contacts'&&(
         <div className="content-page">
           <div className="section-toolbar">
             <h2>{mode==='demo'?data.length:0} contacts</h2>
             <div className="searchbox">
               <Search size={16}/>
               <input placeholder="Search contacts…" aria-label="Search contacts" value={search} onChange={e=>setSearch(e.target.value)}/>
             </div>
           </div>
           <div className="table-card">
             <Table>
               <TableHeader>
                 <TableRow>
                   {['Customer','Channel','Tag','Sales','Assigned to',''].map((h,i)=><TableHead key={i}>{h}</TableHead>)}
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {(mode==='demo'?data:[]).filter(x=>(x.name+x.handle+x.tag).toLowerCase().includes(search.toLowerCase())).map(x=>(
                   <TableRow key={x.id}>
                     <TableCell>
                       <div className="contact-cell">
                         <Avatar c={x}/>
                         <div><b>{x.name}</b><small>@{x.handle}</small></div>
                       </div>
                     </TableCell>
                     <TableCell>
                       <span className="platform-cell"><ChannelIcon channel={x.channel} small/>{channelNames[x.channel]}</span>
                     </TableCell>
                     <TableCell><span className="tag">{x.tag}</span></TableCell>
                     <TableCell>
                       {x.sales_successful ? (
                         <span className="text-emerald-700 font-semibold">฿{(x.sales_amount||0).toLocaleString()}</span>
                       ) : (
                         <span className="text-slate-400">-</span>
                       )}
                     </TableCell>
                     <TableCell>
                       {staffUsers.find(u=>u.id===x.assignee)?.name || (x.assignee==='me'?'Me':'Unassigned')}
                     </TableCell>
                     <TableCell>
                       <button className="text-button" onClick={()=>{navigate('Inbox');setStatus(x.status);choose(x)}}>
                         View conversation <ArrowUpRight size={15}/>
                       </button>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           </div>
           {mode==='live'&&<p className="muted">Contacts will appear when your channels are connected.</p>}
         </div>
       )}

       {/* SAVED REPLIES VIEW (Section 7) */}
       {view==='Saved replies'&&(
         <div className="content-page">
           <div className="section-toolbar">
             <h2>{replies.length} saved replies (with shortcuts & media)</h2>
             <div className="searchbox">
               <Search size={16}/>
               <input placeholder="Find by title, body, or /shortcut…" value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search saved replies"/>
             </div>
           </div>
           <div className="reply-grid">
             {replies.filter(r=>(r.title+r.body+(r.shortcut||'')).toLowerCase().includes(search.toLowerCase())).map(r=>(
               <article className="reply-card relative" key={r.id}>
                 <div className="flex items-center justify-between w-full mb-3">
                   <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200 font-mono text-xs font-semibold">
                     {r.shortcut || `/${r.id}`}
                   </span>
                   <FileText size={18} className="text-orange-400"/>
                 </div>
                 <h2>{r.title}</h2>
                 <p className="text-sm text-slate-600 line-clamp-3 my-2">{r.body}</p>
                 {r.media_url && (
                   <div className="text-[11px] text-blue-600 flex items-center gap-1 mb-2">
                     <ExternalLink size={12}/> Media attachment attached
                   </div>
                 )}
                 <div>
                   <button className="text-button" onClick={()=>setEditReply({...r})}>Edit reply</button>
                   <button className="text-button" onClick={()=>{setMode('demo');navigate('Inbox');setDrafts(d=>({...d,[selected]:r.body}))}}>
                     Use in inbox <ArrowUpRight size={15}/>
                   </button>
                 </div>
               </article>
             ))}
           </div>
         </div>
       )}

       {/* OVERVIEW VIEW — EXECUTIVE ANALYTICS & SALES DASHBOARD */}
       {view==='Overview'&&(
         <DashboardView
           conversations={data}
           staffUsers={staffUsers}
           onSelectConversation={(id)=>{
             const found = data.find(c => c.id === id);
             if (found) {
               choose(found);
               navigate('Inbox');
             }
           }}
         />
       )}

       {/* CONNECTIONS VIEW */}
       {view==='Connections'&&(
         <div className="content-page">
           <div className="connection-summary">
             <div className="empty-icon"><Plug size={26}/></div>
             <div>
               <h2>Make room for every conversation.</h2>
               <p>Prepare your business accounts here. Live connections require platform authorization and integration setup.</p>
             </div>
             <span className="soft-label">{setup.length} of {channels.length} connected</span>
           </div>
           <div className="connection-grid">
             {channels.map(ch=>(
               <article className="connection-card" key={ch}>
                 <div className="connection-card-top">
                   <ChannelIcon channel={ch}/>
                   <span className="setup-badge">{setup.some(s=>s.channel===ch)?'Details saved':'Not connected'}</span>
                 </div>
                 <h2>{channelNames[ch]}</h2>
                 <p>
                   {ch==='facebook'
                     ?'Bring your Facebook Page customer conversations into one inbox.'
                     :ch==='instagram'
                     ?'A dedicated place for conversations with your Instagram customers.'
                     :ch==='tiktok'
                     ?'Manage customer conversations from your TikTok Shop.'
                     :'Connect your LINE Official Account to chat with Thai customers seamlessly.'}
                 </p>
                 <div className="requirements">
                   <b>Before you connect</b>
                   <p><Check size={14}/>{ch==='facebook'?'Facebook Page admin access':ch==='instagram'?'Instagram professional account':ch==='tiktok'?'TikTok Shop seller account':'LINE Developers Console Channel ID & Secret'}</p>
                   <p><Clock3 size={14}/>Platform app and messaging access</p>
                 </div>
                 {setup.find(s=>s.channel===ch)&&(
                   <p className="account-saved"><Store size={14}/>{setup.find(s=>s.channel===ch)?.account}</p>
                 )}
                 <button className="outline" onClick={()=>openConnection(ch)}>
                   Prepare connection <ArrowUpRight size={15}/>
                 </button>
               </article>
             ))}
           </div>
           <div className="connection-note">
             <ShieldCheck size={20}/>
             <div>
               <b>Your accounts stay under your control.</b>
               <p>Saving account details does not connect a channel or import messages. Authorization, webhook setup and sending must be completed and verified before going live. TikTok here means TikTok Shop; general TikTok DMs are not connected.</p>
             </div>
           </div>
         </div>
       )}

       {/* TEAM MANAGEMENT VIEW */}
       {view==='Team'&&(
         <TeamManagement
           initialUsers={staffUsers}
           initialTeams={teams}
           currentUserRole={activeUser?.role || 'admin'}
           onRefresh={load}
         />
       )}

       {/* AUTOMATIONS VIEW */}
       {view==='Automations'&&(
         <AutomationSettings onRefresh={load} />
       )}
     </main>

     {/* RESOLVE WITH SALES RESULT DIALOG (Section 5 & 6) */}
     <Dialog open={resolveModalOpen} onOpenChange={setResolveModalOpen}>
       <DialogContent className="max-w-md bg-white rounded-xl shadow-xl p-6 border border-slate-200">
         <DialogHeader>
           <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
             <CheckCircle2 className="text-emerald-600" size={20} /> Record Sales Result & Resolve Chat
           </DialogTitle>
           <DialogDescription className="text-xs text-slate-500">
             Record whether a sale occurred before resolving this customer conversation.
           </DialogDescription>
         </DialogHeader>

         <form onSubmit={handleConfirmResolve} className="space-y-4 mt-2">
           <div>
             <label className="block text-xs font-semibold text-slate-700 mb-1.5">WAS THIS A SUCCESSFUL SALE?</label>
             <div className="flex gap-2">
               <button
                 type="button"
                 className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                   resolveData.successful
                     ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                     : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                 }`}
                 onClick={() => setResolveData({ ...resolveData, successful: true, amount: resolveData.amount || 18900 })}
               >
                 🎉 Successful Sale (ขายสำเร็จ)
               </button>
               <button
                 type="button"
                 className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                   !resolveData.successful
                     ? 'bg-slate-100 border-slate-300 text-slate-800 font-semibold'
                     : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                 }`}
                 onClick={() => setResolveData({ ...resolveData, successful: false, amount: 0 })}
               >
                 Support / No Sale (บริการทั่วไป)
               </button>
             </div>
           </div>

           {resolveData.successful && (
             <div>
               <label className="block text-xs font-semibold text-slate-700 mb-1">TOTAL SALES AMOUNT (ยอดขาย ฿ THB)</label>
               <input
                 type="number"
                 min="0"
                 required
                 className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-white outline-none focus:border-orange-500"
                 placeholder="e.g. 29900"
                 value={resolveData.amount || ''}
                 onChange={(e) => setResolveData({ ...resolveData, amount: Number(e.target.value) || 0 })}
               />
             </div>
           )}

           <div>
             <label className="block text-xs font-semibold text-slate-700 mb-1">RESOLUTION REASON (เหตุผลการปิดเคส)</label>
             <select
               className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white outline-none focus:border-orange-500"
               value={resolveData.resolution}
               onChange={(e) => setResolveData({ ...resolveData, resolution: e.target.value })}
             >
               <option value="solved">Solved (บริการ/ปิดการขายสำเร็จ)</option>
               <option value="unresponsive">Unresponsive (ลูกค้าไม่ตอบกลับ)</option>
               <option value="cancelled">Cancelled (ลูกค้ายกเลิก)</option>
               <option value="escalated">Escalated (ส่งต่อเคส)</option>
             </select>
           </div>

           <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
             <button type="button" className="outline text-xs px-3 py-1.5" onClick={() => setResolveModalOpen(false)}>
               Cancel
             </button>
             <button type="submit" className="primary text-xs px-4 py-1.5" disabled={saving}>
               {saving ? 'Closing...' : 'Confirm & Resolve Conversation'}
             </button>
           </div>
         </form>
       </DialogContent>
     </Dialog>

     <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
       <SheetContent className="overflow-y-auto">
         <SheetHeader><SheetTitle>Contact details</SheetTitle></SheetHeader>
         {detail}
       </SheetContent>
     </Sheet>

     <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
       <DialogContent>
         <DialogHeader>
           <DialogTitle>Choose a saved reply</DialogTitle>
           <DialogDescription>Insert a reply into your draft, then review it before sending.</DialogDescription>
         </DialogHeader>
         <div className="quick-options">
           {replies.map(r=>(
             <button key={r.id} onClick={()=>{setDrafts(d=>({...d,[selected]:r.body}));setQuickOpen(false)}}>
               <div className="flex items-center justify-between mb-1">
                 <b>{r.title}</b>
                 {r.shortcut && <span className="font-mono text-xs text-orange-600 font-semibold">{r.shortcut}</span>}
               </div>
               <p>{r.body}</p>
             </button>
           ))}
         </div>
       </DialogContent>
     </Dialog>

     <Dialog open={!!editReply} onOpenChange={open=>{if(!open)setEditReply(null)}}>
       <DialogContent>
         <DialogHeader>
           <DialogTitle>Saved reply</DialogTitle>
           <DialogDescription>Keep useful answers ready for your next conversation.</DialogDescription>
         </DialogHeader>
         {editReply&&(
           <form className="modal-form" onSubmit={async e=>{
             e.preventDefault();
             if(await action({action:'saveReply',...editReply})){
               setEditReply(null);
               toast.success('Reply saved');
             }
           }}>
             <label>Title<input value={editReply.title} onChange={e=>setEditReply({...editReply,title:e.target.value})} required maxLength={80}/></label>
             <label>Shortcut (e.g. /hello, /pay)<input value={editReply.shortcut || ''} onChange={e=>setEditReply({...editReply,shortcut:e.target.value})} placeholder="/greeting" maxLength={40}/></label>
             <label>Message<textarea rows={5} value={editReply.body} onChange={e=>setEditReply({...editReply,body:e.target.value})} required maxLength={4000}/></label>
             <button className="primary" disabled={saving}>{saving?'Saving…':'Save reply'}</button>
           </form>
         )}
       </DialogContent>
     </Dialog>

     <Dialog open={!!connect} onOpenChange={o=>{if(!o)setConnect(null)}}>
       <DialogContent>
         <DialogHeader>
           <DialogTitle>{connect&&channelNames[connect]} connection</DialogTitle>
           <DialogDescription>Save the account you want to connect. This step does not grant access or start syncing.</DialogDescription>
         </DialogHeader>
         <form className="modal-form" onSubmit={async e=>{
           e.preventDefault();
           if(await action({action:'setup',channel:connect,account,url})){
             setConnect(null);
             toast.success('Account details saved. Platform authorization is still required.');
           }
         }}>
           <label>Business account name<input placeholder="MeePro Phone" value={account} onChange={e=>setAccount(e.target.value)} required maxLength={100}/></label>
           <label>Public profile or shop URL<input placeholder={connect==='facebook'?'https://www.facebook.com/yourpage':connect==='instagram'?'https://www.instagram.com/youraccount':connect==='tiktok'?'https://www.tiktok.com/@yourshop':'https://line.me/ti/p/@yourlineoa'} value={url} onChange={e=>setUrl(e.target.value)} type="url" required/></label>
           <div className="setup-next">
             <b>Next: authorize the integration</b>
             <p>The live messaging integration is not installed yet. Your developer needs the platform app configuration and approved messaging access. Do not enter passwords or access tokens here.</p>
           </div>
           <button className="primary" disabled={saving}>{saving?'Saving…':'Save account details'}</button>
         </form>
       </DialogContent>
     </Dialog>
   </SidebarProvider>
 );
}
