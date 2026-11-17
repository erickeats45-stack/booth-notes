const $ = id => document.getElementById(id);
const fieldNames = ['name','country','company','whatsapp','email','productNotes','appearance','notes'];
let productTags = ['小挖','履带翻斗车','属具','其他'], draftCreatedAt;
let db, records = [], current = null, cardPhoto = '', portraitPhoto = '', dirty = false, busy = false, toastTimer;
const ready = new Promise((resolve, reject) => {
  const request = indexedDB.open('zhanyu-booth-notes', 2);
  request.onupgradeneeded = () => {
    if(!request.result.objectStoreNames.contains('visitors')) request.result.createObjectStore('visitors', {keyPath:'id'});
    if(!request.result.objectStoreNames.contains('settings')) request.result.createObjectStore('settings', {keyPath:'id'});
  };
  request.onblocked = () => toast('请关闭其他打开的展遇页面，再重新打开');
  request.onsuccess = () => {db = request.result; db.onversionchange = () => db.close(); resolve();};
  request.onerror = () => reject(request.error);
});
function toast(message) { $('toast').textContent=message; $('toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').hidden=true,4200); }
async function readAll() { await ready; return new Promise((resolve,reject)=> { const request=db.transaction('visitors').objectStore('visitors').getAll(); request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error); }); }
async function writeRecords(items, removeId) { await ready; return new Promise((resolve,reject)=> { const tx=db.transaction('visitors','readwrite'); const store=tx.objectStore('visitors'); if(removeId) store.delete(removeId); items.forEach(item=>store.put(item)); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error); }); }
function el(tag, text, className) { const node=document.createElement(tag); node.textContent=text; if(className)node.className=className; return node; }
async function refresh() { records=(await readAll()).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)); await loadTags(); renderProductControls(); render(); }
function render() {
  const query=$('search').value.trim().toLowerCase(); const product=$('filter').value;
  const shown=records.filter(record=>(!product||record.products.includes(product))&&[...fieldNames.map(key=>record[key]),...record.products].join(' ').toLowerCase().includes(query));
  $('count').textContent=shown.length; $('cards').replaceChildren(); $('empty').hidden=shown.length>0;
  $('empty').querySelector('h2').textContent=records.length?'暂时没有匹配的访客':'第一位访客，从这里开始';
  $('empty').querySelector('p').textContent=records.length?'试试其他姓名、国家、产品或备注。':'用虚构名片试一次自动填表，也可以拍一张自己的名片。';
  for(const record of shown) {
    const button=el('button','','visitor'); button.type='button'; const top=el('div','','visitor-top');
    let avatar=el('span',Array.from(record.name||'访')[0],'avatar');
    if(record.portraitPhoto){ avatar=document.createElement('img');avatar.src=record.portraitPhoto;avatar.className='avatar';avatar.alt='访客照片'; }
    top.append(avatar);const title=el('div');title.append(el('h3',record.name||'待补姓名'),el('p',[record.country,record.company].filter(Boolean).join(' · ')||'资料待补充'));top.append(title);button.append(top);
    const tags=el('div','','tags');record.products.forEach(product=>tags.append(el('span',product,'tag')));button.append(tags);
    button.append(el('p',record.appearance||record.productNotes||record.notes||'点击补充见面时的印象'));
    button.append(el('p',formatVisitTime(record.createdAt),'date'));button.onclick=()=>openEditor(record);$('cards').append(button);
  }
}
function updatePhotos() {
  for(const [prefix,value] of [['card',cardPhoto],['portrait',portraitPhoto]]) {$(prefix+'Preview').src=value||'';$(prefix+'Preview').hidden=!value;$(prefix+'Prompt').hidden=!!value;}
  $('recognize').disabled=!cardPhoto||busy;
}
function openEditor(record=null) {
  current=record; draftCreatedAt=record?.createdAt||new Date().toISOString(); $('visitTime').textContent='到访时间 · '+formatVisitTime(draftCreatedAt)+'（本机时间）'; $('ocrReview').hidden=true; cardPhoto=record?.cardPhoto||''; portraitPhoto=record?.portraitPhoto||''; $('form').reset();
  fieldNames.forEach(key=>$('form').elements[key].value=record?.[key]||'');
  renderProductControls(record?.products||[]);
  $('ocrText').value=record?.ocrText||''; $('ocrDetails').hidden=!$('ocrText').value;
  $('ocrStatus').textContent='名片在本机识别，首次使用需加载英文识别模型。请核对自动填入的信息。';
  $('delete').hidden=!record;$('editTitle').textContent=record?'编辑访客':'新增访客';$('listView').hidden=true;$('editor').hidden=false;dirty=false;updatePhotos();window.scrollTo(0,0);
}
function closeEditor() { if(busy){toast('请等待照片处理或识别完成');return;} if(dirty&&!confirm('有尚未保存的修改，确定返回？'))return;$('editor').hidden=true;$('listView').hidden=false;dirty=false; }
function fileToImage(file) {
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('照片读取失败'));reader.onload=()=>{const image=new Image();image.onerror=()=>reject(new Error('无法读取此图片，请改用 JPG 或 PNG'));image.onload=()=>{const scale=Math.min(1,1800/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.86));};image.src=reader.result;};reader.readAsDataURL(file);});
}
function setBusy(value){busy=value;$('save').disabled=value;$('recognize').disabled=value||!cardPhoto;$('cardFile').disabled=value;$('portraitFile').disabled=value;$('delete').disabled=value;$('clearCard').disabled=value;$('clearPortrait').disabled=value;}
for(const prefix of ['card','portrait']) {
  $(prefix+'File').onchange=async event=>{const file=event.target.files[0];if(!file)return;setBusy(true);try{const data=await fileToImage(file);if(prefix==='card')cardPhoto=data;else portraitPhoto=data;dirty=true;updatePhotos();}catch(error){toast(error.message);}finally{setBusy(false);event.target.value='';}};
}
async function recognizeCard(useDemoCard = false) {
  if(busy || (!useDemoCard && !cardPhoto)) return;
  setBusy(true);
  let worker;
  try{
    if(!window.Tesseract)throw new Error('识别组件加载失败，请联网刷新后重试');
    if (useDemoCard) {
      $('ocrStatus').textContent='正在载入虚构演示名片…';
      const response=await fetch('demo-card.png');
      if(!response.ok) throw new Error('演示名片加载失败，请重试');
      cardPhoto=await fileToImage(await response.blob());
      dirty=true;
      updatePhotos();
    }
    $('ocrStatus').textContent='正在准备识别模型，首次使用需要稍等…';
    worker=await Tesseract.createWorker('eng',1,{workerPath:'worker.min.js',corePath:'.',langPath:'.',logger:message=>{if(message.status==='recognizing text')$('ocrStatus').textContent='正在识别名片 '+Math.round(message.progress*100)+'%';}});
    await worker.setParameters({tessedit_pageseg_mode:'11'});
    const {data}=await worker.recognize(cardPhoto);$('ocrText').value=data.text;$('ocrDetails').hidden=false;
    const result=parseCard(data); const parsed=result.fields; showCandidates(result); let filled=0;
    for(const [key,value] of Object.entries(parsed)){if(value&&!$('form').elements[key].value.trim()){$('form').elements[key].value=value;filled++;}}
    dirty=true;$('ocrStatus').textContent=filled?'已填入 '+filled+' 项，请核对姓名、国家和号码。电话是否为 WhatsApp 需向客户确认。':Object.values(parsed).some(Boolean)?'识别完成，已保留现有资料。可展开原文核对。':'已保留识别原文，请手动补充资料，或拍一张更清晰的名片。';
  }catch(error){$('ocrStatus').textContent='识别未完成。可先保存照片，稍后联网重试。';toast(error.message);}finally{try{if(worker)await worker.terminate();}finally{setBusy(false);}}
}
$('recognize').onclick = () => recognizeCard();
$('demoCard').onclick = () => {
  if (busy) return;
  openEditor();
  recognizeCard(true);
};
$('form').oninput=()=>dirty=true;
$('form').onsubmit=async event=>{
  event.preventDefault();if(busy)return;
  const values=Object.fromEntries(fieldNames.map(key=>[key,$('form').elements[key].value.trim()]));const products=[...document.querySelectorAll('#products input:checked')].map(input=>input.value);
  if(!Object.values(values).some(Boolean)&&!products.length&&!cardPhoto&&!portraitPhoto){toast('先添加名片、照片或一项客户信息');return;}
  setBusy(true);try{const now=new Date().toISOString();await writeRecords([{...values,products,cardPhoto,portraitPhoto,ocrText:$('ocrText').value,id:current?.id||crypto.randomUUID(),createdAt:current?.createdAt||draftCreatedAt||now,updatedAt:now}]);dirty=false;setBusy(false);closeEditor();await refresh();toast('访客已保存在本机');navigator.storage?.persist?.().catch(()=>{});}catch(error){toast('保存失败，请重试或检查设备存储空间');}finally{setBusy(false);}
};
$('delete').onclick=async()=>{if(!current||!confirm('确定删除这位访客及其照片？'))return;try{await writeRecords([],current.id);dirty=false;closeEditor();await refresh();toast('已删除访客');}catch{toast('删除失败，请重试');}};
$('clearCard').onclick=()=>{cardPhoto='';dirty=true;updatePhotos();};$('clearPortrait').onclick=()=>{portraitPhoto='';dirty=true;updatePhotos();};
$('add').onclick=$('emptyAdd').onclick=()=>openEditor();$('back').onclick=closeEditor;$('brand').onclick=event=>{event.preventDefault();closeEditor();};$('search').oninput=render;$('filter').onchange=render;
$('settings').onclick=()=>$('backup').showModal();$('closeBackup').onclick=()=>$('backup').close();
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
$('exportBackup').onclick=async()=>{try{download(JSON.stringify({format:'booth-notes',version:2,productTags,exportedAt:new Date().toISOString(),visitors:await readAll()}),'展遇-完整备份-'+new Date().toISOString().slice(0,10)+'.json','application/json');$('backupStatus').textContent='备份已生成，请将下载文件保存到安全的位置。';}catch{toast('备份失败，请重试');}};
$('exportCsv').onclick=async()=>{const keys=['name','country','company','whatsapp','email','products','productNotes','appearance','notes','createdAt'];const headers=['姓名','国家','公司','WhatsApp','邮箱','感兴趣产品','产品详情','形象描述','交流备注','记录时间'];const csvCell=value=>{let text=Array.isArray(value)?value.join('、'):String(value||'');if(/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};try{const all=await readAll();download('\ufeff'+[headers,...all.map(record=>keys.map(key=>key==='createdAt'?formatVisitTime(record[key]):record[key]))].map(row=>row.map(csvCell).join(',')).join('\r\n'),'展遇-访客表.csv','text/csv;charset=utf-8');}catch{toast('导出失败，请重试');}};
function validateBackup(data){
  if(data.format!=='booth-notes'||![1,2].includes(data.version)||!Array.isArray(data.visitors))throw new Error('请选择展遇导出的完整备份');
  if(data.version===2 && (!Array.isArray(data.productTags)||!data.productTags.every(tag=>typeof tag==='string'&&tag.trim()&&tag.length<=40))) throw new Error('备份标签格式错误');
  return data.visitors.map(record=>{
    if(!record||typeof record.id!=='string'||!record.id||!Array.isArray(record.products)||!record.products.every(value=>typeof value==='string')||!Number.isFinite(Date.parse(record.createdAt))||!Number.isFinite(Date.parse(record.updatedAt)))throw new Error('备份记录格式不完整');
    const safe={id:record.id,products:record.products,createdAt:new Date(record.createdAt).toISOString(),updatedAt:new Date(record.updatedAt).toISOString()};
    for(const key of [...fieldNames,'ocrText','cardPhoto','portraitPhoto']){if(record[key]!=null&&typeof record[key]!=='string')throw new Error('备份字段格式错误');safe[key]=record[key]||'';}
    for(const key of ['cardPhoto','portraitPhoto'])if(safe[key]&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=\s]+$/.test(safe[key]))throw new Error('照片格式不受支持');return safe;
  });
}
$('importFile').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{const backupData=JSON.parse(await file.text());const incoming=validateBackup(backupData);if(!confirm('将恢复 '+incoming.length+' 条记录，与本机记录合并，是否继续？'))return;
  await ready;await new Promise((resolve,reject)=>{const tx=db.transaction(['visitors','settings'],'readwrite');const store=tx.objectStore('visitors');const settings=tx.objectStore('settings');const tagsRequest=settings.get('products');tagsRequest.onsuccess=()=>{const existing=tagsRequest.result?.values||(backupData.productTags?[]:productTags);settings.put({id:'products',values:[...new Set([...existing,...(backupData.productTags||[])])]});};for(const record of incoming){const request=store.get(record.id);request.onsuccess=()=>{if(!request.result||record.updatedAt>request.result.updatedAt)store.put(record);};}tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});await refresh();$('backupStatus').textContent='恢复完成，当前共有 '+records.length+' 位访客。';toast('备份已恢复');}catch(error){$('backupStatus').textContent='恢复失败：'+error.message;}finally{event.target.value='';}};
window.addEventListener('beforeunload',event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}});
ready.then(refresh).catch(()=>toast('本地数据库无法打开，请使用普通浏览模式重试'));
if('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(registration => {
    function announceUpdate() {
      if(!registration.waiting) return;
      const button=document.createElement('button');
      button.className='secondary update-button'; button.textContent='新版已就绪，点击更新';
      button.onclick=()=>{ if(busy||dirty){toast('请先保存当前访客，再更新');return;} navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});registration.waiting.postMessage('activate');button.remove(); };
      document.body.append(button);
    }
    announceUpdate();
    registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)announceUpdate();});});
  }).catch(()=>{});
} 

function formatVisitTime(value) {
  return new Date(value).toLocaleString('zh-CN', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
}
async function loadTags() {
  await ready;
  productTags = await new Promise((resolve,reject) => {
    const request=db.transaction('settings').objectStore('settings').get('products');
    request.onsuccess=()=>resolve(request.result?.values || ['小挖','履带翻斗车','属具','其他']);
    request.onerror=()=>reject(request.error);
  });
}
function renderProductControls(selected) {
  const chosen=selected || [...document.querySelectorAll('#products input:checked')].map(input=>input.value);
  $('products').replaceChildren();
  for(const tag of new Set([...productTags,...chosen])) {
    const label=document.createElement('label');
    const input=document.createElement('input'); input.type='checkbox';input.value=tag;input.checked=chosen.includes(tag);
    label.append(input,el('span',tag));$('products').append(label);
  }
  const filterValue=$('filter').value;
  $('filter').replaceChildren(new Option('全部产品',''));
  for(const tag of new Set([...productTags,...records.flatMap(record=>record.products)])) $('filter').add(new Option(tag,tag));
  $('filter').value=filterValue;
}
async function changeTag(action, oldName, newName='') {
  newName=newName.trim();
  if(action!=='remove' && (!newName || newName.length>40)) throw new Error('产品名称请填写 1–40 个字符');
  await ready;
  await new Promise((resolve,reject) => {
    const tx=db.transaction(['settings','visitors'],'readwrite');
    const settings=tx.objectStore('settings'); const visitors=tx.objectStore('visitors');
    const request=settings.get('products'); let failure;
    request.onsuccess=()=>{
      let tags=request.result?.values||['小挖','履带翻斗车','属具','其他'];
      if(action!=='add'&&!tags.includes(oldName)){failure=new Error('标签已在其他页面更新，请重新打开标签管理');tx.abort();return;}
      if(action!=='remove'&&newName!==oldName&&tags.some(tag=>tag.toLowerCase()===newName.toLowerCase())){failure=new Error('已经有同名产品标签');tx.abort();return;}
      if(action==='add') tags=[...tags,newName];
      if(action==='remove') tags=tags.filter(tag=>tag!==oldName);
      if(action==='rename') {
        tags=tags.map(tag=>tag===oldName?newName:tag);
        const cursor=visitors.openCursor();
        cursor.onsuccess=()=>{
          const row=cursor.result;if(!row)return;
          if(row.value.products.includes(oldName)) row.update({...row.value,products:[...new Set(row.value.products.map(tag=>tag===oldName?newName:tag))],updatedAt:new Date().toISOString()});
          row.continue();
        };
      }
      settings.put({id:'products',values:tags});
    };
    tx.oncomplete=resolve;tx.onerror=()=>reject(failure||tx.error);tx.onabort=()=>reject(failure||tx.error);
  });
  const selected=[...document.querySelectorAll('#products input:checked')].map(input=>action==='rename'&&input.value===oldName?newName:input.value);
  if(current && action==='rename') current={...current,products:current.products.map(tag=>tag===oldName?newName:tag)};
  await refresh();renderProductControls(selected);renderTagRows();
}
function renderTagRows() {
  $('tagRows').replaceChildren();
  for(const tag of productTags) {
    const row=el('div','','tag-row'); const input=document.createElement('input');input.value=tag;input.maxLength=40;input.setAttribute('aria-label','标签 '+tag);
    const rename=el('button','改名','secondary');const remove=el('button','移除','quiet');
    async function apply(action) {
      rename.disabled=remove.disabled=true;
      try {await changeTag(action,tag,input.value);$('tagStatus').textContent=action==='rename'?'标签及关联访客已更新':'标签已移除，历史记录已保留';}
      catch(error){$('tagStatus').textContent=error.message;rename.disabled=remove.disabled=false;}
    }
    rename.onclick=()=>apply('rename');remove.onclick=()=>apply('remove');row.append(input,rename,remove);$('tagRows').append(row);
  }
}
$('manageProducts').onclick=async()=>{await loadTags();renderTagRows();$('tagStatus').textContent='';$('tagsDialog').showModal();};
$('closeTags').onclick=()=>$('tagsDialog').close();
$('addTagForm').onsubmit=async event=>{
  event.preventDefault();const button=$('addTagForm').querySelector('button');button.disabled=true;
  try{await changeTag('add',null,$('newTag').value);$('newTag').value='';$('tagStatus').textContent='产品标签已添加';}catch(error){$('tagStatus').textContent=error.message;}finally{button.disabled=false;}
};
function showCandidates(result) {
  $('ocrReview').hidden=false;$('ocrCandidates').replaceChildren();
  const labels={name:'客户姓名',company:'公司',country:'国家 / 地区',whatsapp:'WhatsApp 候选号码'};
  for(const [field,labelText] of Object.entries(labels)) {
    const options=result.candidates[field];
    if(!options.length)continue;
    const group=el('div','','candidate-group');const label=el('label',labelText);const select=document.createElement('select');select.id='candidate-'+field;label.htmlFor=select.id;select.add(new Option('选择后填入'+labelText,''));
    for(const value of options)select.add(new Option(value,value));
    select.onchange=()=>{if(!select.value)return;$('form').elements[field].value=select.value;dirty=true;toast('已填入'+labelText);};
    group.append(label,select);$('ocrCandidates').append(group);
  }
}
