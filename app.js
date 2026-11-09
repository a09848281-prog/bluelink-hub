(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const STANDARD_SERVICES = [
    'battery_service','device_information','heart_rate','health_thermometer',
    'environmental_sensing','generic_access','generic_attribute','automation_io',
    'cycling_speed_and_cadence','running_speed_and_cadence','body_composition',
    'blood_pressure','glucose','pulse_oximeter','weight_scale','human_interface_device'
  ];
  const SERVICE_LABELS = {
    'battery_service':'Battery Service','device_information':'Device Information',
    'heart_rate':'Heart Rate','health_thermometer':'Health Thermometer',
    'environmental_sensing':'Environmental Sensing','generic_access':'Generic Access',
    'generic_attribute':'Generic Attribute','automation_io':'Automation IO',
    'cycling_speed_and_cadence':'Cycling Speed and Cadence',
    'running_speed_and_cadence':'Running Speed and Cadence',
    'body_composition':'Body Composition','blood_pressure':'Blood Pressure',
    'glucose':'Glucose','pulse_oximeter':'Pulse Oximeter','weight_scale':'Weight Scale',
    'human_interface_device':'Human Interface Device'
  };
  let device = null, server = null, services = [], eventCount = 0, toastTimer = null;
  let logs = loadLogs();
  const activeNotifications = new Map();
  const uuidName = uuid => {
    try { return BluetoothUUID.getService(uuid) || BluetoothUUID.getCharacteristic(uuid) || uuid; }
    catch (_) { return String(uuid); }
  };
  function loadLogs() { try { return JSON.parse(localStorage.getItem('bluelink.logs') || '[]'); } catch (_) { return []; } }
  function saveLogs() { try { localStorage.setItem('bluelink.logs', JSON.stringify(logs.slice(-500))); } catch (_) {} }
  function timestamp() { return new Date().toLocaleString('ja-JP', {hour12:false}); }
  function addLog(kind, message) {
    const item = {time:timestamp(),kind,device:device?.name || '—',message:String(message)};
    logs.unshift(item); logs = logs.slice(0,500); saveLogs(); renderLogs(); addConsole(item);
  }
  function addConsole(item) {
    const out = $('#consoleOutput');
    $('.console-empty', out)?.remove();
    const row = document.createElement('div'); row.className = 'console-line';
    [item.time.split(' ')[1] || item.time,item.kind,item.message].forEach((value,i) => {
      const span = document.createElement('span'); span.className = ['console-time','console-kind','console-message'][i]; span.textContent = value; row.append(span);
    });
    out.append(row); out.scrollTop = out.scrollHeight;
    eventCount++; $('#consoleCount').textContent = eventCount + ' EVENTS'; $('#statEvents').textContent = eventCount;
  }
  function showToast(message) {
    const toast = $('#toast'); toast.textContent = message; toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }
  function setConnected(connected) {
    $('#sideDot').classList.toggle('on', connected);
    $('#sideStatus').textContent = connected ? '接続中' : '未接続';
    $('#statConnection').textContent = connected ? '接続中' : '未接続';
    $('#statDevice').textContent = connected ? (device?.name || '名称不明') : 'デバイスを選択してください';
    $('#deviceName').textContent = connected ? (device?.name || '名称不明のデバイス') : 'デバイス未接続';
    $('#deviceId').textContent = connected ? (device?.id || 'ID非公開') : '探索を開始してください';
    $('#connectionChip').textContent = connected ? 'CONNECTED' : 'OFFLINE';
    $('#connectionChip').classList.toggle('connected', connected);
    $('#disconnectBtn').disabled = !connected;
    $('#refreshServices').disabled = !connected;
  }
  function showView(name) {
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    const titles = {dashboard:'ダッシュボード',explorer:'デバイス探索',console:'通信コンソール',logs:'履歴・ログ'};
    $('#pageTitle').textContent = titles[name] || 'BlueLink Hub';
  }
  async function connectDevice() {
    if (!('bluetooth' in navigator)) {
      showToast('このブラウザはWeb Bluetoothに対応していません。Chrome / Edge（対応PC・Android）をお試しください。');
      addLog('ERROR','Web Bluetooth APIが利用できません'); return;
    }
    const optionalServices = [...STANDARD_SERVICES];
    const custom = $('#customUuid').value.split(',').map(v => v.trim()).filter(Boolean);
    for (const uuid of custom) {
      try { optionalServices.push(BluetoothUUID.getService(uuid)); }
      catch (_) { showToast('UUIDの形式を確認してください: ' + uuid); return; }
    }
    try {
      const selected = await navigator.bluetooth.requestDevice({acceptAllDevices:true, optionalServices:[...new Set(optionalServices)]});
      device = selected;
      device.addEventListener('gattserverdisconnected', onDisconnected);
      addLog('CONNECT', '接続要求: ' + (device.name || '名称不明'));
      server = await device.gatt.connect();
      setConnected(true);
      addLog('CONNECTED','GATTサーバーに接続しました');
      await discoverServices();
      showView('explorer');
    } catch (error) {
      if (error.name === 'NotFoundError') showToast('デバイスが選択されませんでした');
      else { showToast('接続できません: ' + error.message); addLog('ERROR',error.message); }
    }
  }
  function onDisconnected() {
    activeNotifications.clear(); server = null; services = [];
    setConnected(false); $('#statServices').textContent = '0';
    $('#servicesContainer').innerHTML = '<div class="empty-panel"><div class="empty-symbol">⌘</div><strong>接続が切断されました</strong><p>再接続するにはデバイスを探索してください。</p></div>';
    addLog('DISCONNECT','デバイスとの接続が切断されました');
  }
  async function disconnectDevice() {
    if (device?.gatt?.connected) device.gatt.disconnect();
    else onDisconnected();
  }
  async function discoverServices() {
    if (!server?.connected) return;
    const container = $('#servicesContainer'); container.innerHTML = '<div class="empty-panel"><strong>サービスを取得中...</strong></div>';
    try {
      services = await server.getPrimaryServices();
      $('#statServices').textContent = services.length;
      if (!services.length) {
        container.innerHTML = '<div class="empty-panel"><strong>アクセス可能なサービスがありません</strong><p>接続時に独自サービスUUIDを指定したか確認してください。</p></div>'; return;
      }
      container.replaceChildren();
      for (const service of services) {
        const card = document.createElement('article'); card.className = 'service-card';
        const head = document.createElement('div'); head.className = 'service-head';
        const title = document.createElement('strong'); title.textContent = SERVICE_LABELS[service.uuid] || uuidName(service.uuid);
        const uuid = document.createElement('small'); uuid.textContent = service.uuid;
        head.append(title,uuid); card.append(head);
        const list = document.createElement('div'); list.className = 'service-characteristics';
        card.append(list); container.append(card);
        try {
          const chars = await service.getCharacteristics();
          for (const characteristic of chars) list.append(buildCharacteristic(characteristic));
          if (!chars.length) list.textContent = '特性値がありません。';
        } catch (error) {
          const msg = document.createElement('p'); msg.className='helper-text'; msg.textContent='特性値を取得できません: '+error.message; list.append(msg);
        }
      }
      addLog('DISCOVERY',services.length+'個のGATTサービスを取得しました');
    } catch (error) {
      container.innerHTML = ''; const msg = document.createElement('div'); msg.className='empty-panel'; msg.textContent='サービス取得エラー: '+error.message; container.append(msg);
      addLog('ERROR','サービス取得: '+error.message);
    }
  }
  function buildCharacteristic(ch) {
    const wrap = document.createElement('div'); wrap.className='characteristic';
    const top = document.createElement('div'); top.className='char-top';
    const info = document.createElement('div'); info.style.minWidth='0';
    const name = document.createElement('div'); name.className='char-name'; name.textContent=uuidName(ch.uuid);
    const uuid = document.createElement('div'); uuid.className='char-uuid'; uuid.textContent=ch.uuid;
    info.append(name,uuid); top.append(info); wrap.append(top);
    const props = document.createElement('div'); props.className='property-list';
    ['read','write','writeWithoutResponse','notify','indicate','authenticatedSignedWrites'].forEach(p=>{
      if(ch.properties[p]){const tag=document.createElement('span');tag.className='property';tag.textContent=p;props.append(tag);}
    });
    wrap.append(props);
    const actions = document.createElement('div'); actions.className='char-actions';
    if(ch.properties.read) actions.append(actionButton('値を読む',()=>readCharacteristic(ch,wrap)));
    if(ch.properties.notify || ch.properties.indicate) actions.append(actionButton('通知を開始',()=>startNotifications(ch,wrap)));
    if(ch.properties.write || ch.properties.writeWithoutResponse) actions.append(actionButton('値を書き込む',()=>writeCharacteristic(ch,wrap)));
    wrap.append(actions);
    return wrap;
  }
  function actionButton(label,fn){const b=document.createElement('button');b.textContent=label;b.addEventListener('click',fn);return b;}
  function valueBox(wrap,text){let box=$('.value-box',wrap);if(!box){box=document.createElement('div');box.className='value-box';wrap.append(box);}box.textContent=text;}
  function formatValue(value) {
    const bytes = new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
    const hex = [...bytes].map(b=>b.toString(16).padStart(2,'0')).join(' ');
    let decoded = ''; try { decoded = new TextDecoder('utf-8',{fatal:true}).decode(bytes); } catch (_) {}
    return 'HEX: '+(hex || '(empty)')+(decoded ? '\nTEXT: '+decoded : '');
  }
  async function readCharacteristic(ch,wrap) {
    try { const value=await ch.readValue(); const formatted=formatValue(value); valueBox(wrap,formatted); addLog('READ',ch.uuid+' → '+formatted.replaceAll('\n',' / ')); }
    catch(error){valueBox(wrap,'読み取りエラー: '+error.message);addLog('ERROR','READ '+ch.uuid+': '+error.message);}
  }
  async function startNotifications(ch,wrap) {
    try {
      if(activeNotifications.has(ch.uuid)){await ch.stopNotifications();activeNotifications.delete(ch.uuid);showToast('通知を停止しました');addLog('NOTIFY','停止: '+ch.uuid);return;}
      await ch.startNotifications(); activeNotifications.set(ch.uuid,ch);
      ch.addEventListener('characteristicvaluechanged',event=>{
        const formatted=formatValue(event.target.value);valueBox(wrap,formatted);addLog('NOTIFY',ch.uuid+' → '+formatted.replaceAll('\n',' / '));
      });
      showToast('通知を開始しました');addLog('NOTIFY','開始: '+ch.uuid);
    } catch(error){showToast('通知を開始できません: '+error.message);addLog('ERROR','NOTIFY '+ch.uuid+': '+error.message);}
  }
  async function writeCharacteristic(ch,wrap) {
    const raw=prompt('送信するデータを入力してください。\nTEXT: hello\nHEX: 01 02 FF');
    if(raw===null)return;
    let bytes;
    if(raw.startsWith('HEX:')) {
      const hex=raw.slice(4).trim().split(/[\s,]+/).filter(Boolean);
      if(!hex.length || hex.some(x=>!/^[0-9a-f]{2}$/i.test(x))){showToast('HEX形式が正しくありません（例: 01 02 FF）');return;}
      bytes=new Uint8Array(hex.map(x=>parseInt(x,16)));
    } else if(raw.startsWith('TEXT:')) bytes=new TextEncoder().encode(raw.slice(5).trimStart());
    else bytes=new TextEncoder().encode(raw);
    try {
      if(ch.properties.write) await ch.writeValueWithResponse(bytes);
      else await ch.writeValueWithoutResponse(bytes);
      const summary=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join(' ');
      valueBox(wrap,'送信しました\nHEX: '+summary);addLog('WRITE',ch.uuid+' ← '+summary);showToast('データを送信しました');
    } catch(error){valueBox(wrap,'書き込みエラー: '+error.message);addLog('ERROR','WRITE '+ch.uuid+': '+error.message);}
  }
  function renderLogs() {
    const body=$('#logsBody');body.replaceChildren();
    if(!logs.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=4;cell.className='table-empty';cell.textContent='まだ履歴はありません。';row.append(cell);body.append(row);return;}
    logs.slice(0,200).forEach(item=>{
      const row=document.createElement('tr');
      [item.time,item.kind,item.device,item.message].forEach(v=>{const cell=document.createElement('td');cell.textContent=v;row.append(cell);});
      body.append(row);
    });
  }
  function exportCSV() {
    const rows=[['時刻','種類','デバイス','内容'],...logs.map(x=>[x.time,x.kind,x.device,x.message])];
    const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='bluelink-logs.csv';a.click();URL.revokeObjectURL(url);
  }
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  $$('[data-go]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.go)));
  $('#headerConnect').addEventListener('click',()=>{showView('explorer');connectDevice();});
  $('#explorerConnect').addEventListener('click',connectDevice);
  $('#disconnectBtn').addEventListener('click',disconnectDevice);
  $('#refreshServices').addEventListener('click',discoverServices);
  $('#clearConsole').addEventListener('click',()=>{$('#consoleOutput').replaceChildren();const e=document.createElement('div');e.className='console-empty';e.textContent='コンソールをクリアしました。';$('#consoleOutput').append(e);eventCount=0;$('#consoleCount').textContent='0 EVENTS';$('#statEvents').textContent='0';});
  $('#exportLogs').addEventListener('click',exportCSV);
  $('#clearLogs').addEventListener('click',()=>{if(confirm('保存した履歴をすべて削除しますか？')){logs=[];saveLogs();renderLogs();showToast('履歴を削除しました');}});
  setConnected(false);renderLogs();
  if(!('bluetooth' in navigator)) {
    const notice=document.createElement('div');notice.className='notice warning';
    const b=document.createElement('b');b.textContent='ブラウザ非対応';const s=document.createElement('span');s.textContent='この環境ではWeb Bluetoothが利用できません。iPhone/iPadのSafariでは直接BLE接続できませんが、画面表示・ログ確認は利用できます。対応するPC版Chrome / Edgeなどでお試しください。';
    notice.append(b,s);$('#view-dashboard').append(notice);
  }
})();