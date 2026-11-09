(()=>{'use strict';
const $=s=>document.querySelector(s), KEY='signalscope.records.v1';
let records=load(), position=null, current=null;
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch(_){return[]}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(records.slice(-3000)))}catch(_){toast('保存容量が不足しています')}}
function toast(s){const e=$('#toast');e.textContent=s;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),2600)}
function place(){return $('#placeName').value.trim()||'名称未設定'}
function fmt(t){return new Date(t).toLocaleString('ja-JP',{hour12:false})}
function addState(state){const now=Date.now(),last=records.at(-1);if(last&&last.state===state){toast('同じ色が続いているため記録しませんでした');return}
const row={id:now+'-'+Math.random().toString(36).slice(2,7),time:now,state,place:place(),lat:position?.lat??null,lon:position?.lon??null};
records.push(row);current=state;save();render();toast(state+'を記録しました')}
function durationAnalysis(){const rows=[];for(let i=0;i<records.length-1;i++){const a=records[i],b=records[i+1];if(a.place===b.place&&b.time>a.time)rows.push({state:a.state,ms:b.time-a.time})}return rows}
function avg(a){return a.length?a.reduce((s,x)=>s+x.ms,0)/a.length:0}
function render(){const last=records.at(-1);$('#currentState').textContent=last?.state||'未観測';$('#lastChanged').textContent=last?'最終記録 '+fmt(last.time):'色ボタンで記録を開始';$('#eventCount').textContent=records.length;
const spans=durationAnalysis(),cycles=[];for(let i=0;i<records.length;i++){const r=records[i];if(r.state==='赤'||r.state==='黄'||r.state==='青'){const prior=records.slice(0,i).reverse().find(x=>x.state===r.state&&x.place===r.place);if(prior)cycles.push(r.time-prior.time)}}
$('#cycleValue').textContent=cycles.length?(avg(cycles)/1000).toFixed(1)+'秒':'--';
const groups=['青','黄','赤'].map(state=>({state,items:spans.filter(x=>x.state===state)}));
$('#durationRows').replaceChildren();let any=false;for(const g of groups){if(!g.items.length)continue;any=true;const tr=document.createElement('tr');[g.state,(avg(g.items)/1000).toFixed(1)+' 秒',g.items.length+' 回'].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td)});$('#durationRows').append(tr)}
if(!any){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=3;td.className='empty';td.textContent='まだデータがありません';tr.append(td);$('#durationRows').append(tr)}
const total=spans.reduce((s,x)=>s+x.ms,0),cycleText=cycles.length?(avg(cycles)/1000).toFixed(1)+' 秒':'算出中';$('#analysis').className='analysis-summary';$('#analysis').replaceChildren();const metrics=[['推定1周期',cycleText],['計測した区間',spans.length+' 区間'],['観測時間',total?(total/1000).toFixed(1)+' 秒':'--']];metrics.forEach(([k,v])=>{const d=document.createElement('div');d.className='metric';const s=document.createElement('small'),b=document.createElement('b');s.textContent=k;b.textContent=v;d.append(s,b);$('#analysis').append(d)});
$('#historyRows').replaceChildren();records.slice().reverse().slice(0,250).forEach(r=>{const tr=document.createElement('tr');[fmt(r.time),r.state,r.place].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td)});$('#historyRows').append(tr)});if(!records.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=3;td.className='empty';td.textContent='履歴はありません';tr.append(td);$('#historyRows').append(tr)}
$('#undoBtn').disabled=!records.length}
function csv(){const rows=[['日時','色','地点名','緯度','経度'],...records.map(r=>[fmt(r.time),r.state,r.place,r.lat??'',r.lon??''])];const text='\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='signalscope-observations.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$$('[data-state]').forEach(b=>b.addEventListener('click',()=>addState(b.dataset.state)));
function $$(s){return [...document.querySelectorAll(s)]}
$('#undoBtn').addEventListener('click',()=>{if(!records.length)return;records.pop();current=records.at(-1)?.state||null;save();render();toast('直前の記録を取り消しました')});
$('#finishBtn').addEventListener('click',()=>{if(!records.length){toast('記録がありません');return}if(confirm('今回の観測記録を端末に残して、画面上の観測を終了しますか？')){current=null;toast('観測を終了しました。記録は保存されています')}})
$('#locateBtn').addEventListener('click',()=>{if(!navigator.geolocation){toast('このブラウザでは位置情報を利用できません');return}$('#locationText').textContent='位置情報を取得中...';navigator.geolocation.getCurrentPosition(p=>{position={lat:p.coords.latitude,lon:p.coords.longitude};$('#locationText').textContent='現在地を取得しました';$('#coordsText').textContent=position.lat.toFixed(6)+', '+position.lon.toFixed(6)+'（精度 約'+Math.round(p.coords.accuracy)+'m）';toast('位置情報を取得しました')},e=>{const msg={1:'位置情報の許可が必要です',2:'位置情報を取得できません',3:'位置情報の取得がタイムアウトしました'};$('#locationText').textContent=msg[e.code]||e.message;toast(msg[e.code]||'位置情報エラー')},{enableHighAccuracy:true,timeout:12000,maximumAge:0})});
$('#placeName').addEventListener('change',()=>{if(records.length){toast('地点名は次の記録から反映されます')}});
$('#analyzeBtn').addEventListener('click',()=>{render();toast('最新の記録から再解析しました')});
$('#exportBtn').addEventListener('click',csv);
$('#clearBtn').addEventListener('click',()=>{if(confirm('すべての観測履歴を削除します。この操作は取り消せません。')){records=[];current=null;save();render();toast('履歴を削除しました')}});
render();
})();