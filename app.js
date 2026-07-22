// ===== 纯JS SHA256 =====
function sha256(msg) {
  function R(n,v){return((n>>>v)|(n<<(32-v)))>>>0}
  function S(n,v){return(n>>>v)>>>0}
  function A(x,y){var l=(x&0xffff)+(y&0xffff);var h=(x>>>16)+(y>>>16)+(l>>>16);return((h<<16)|(l&0xffff))>>>0}
  var K=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298];
  var H=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225];
  var b=unescape(encodeURIComponent(msg));
  var bl=b.length,ml=(bl+9+(((-(bl+9))%64)+64)%64);
  var mb=new ArrayBuffer(ml),mv=new DataView(mb);
  for(var i=0;i<bl;i++)mv.setUint8(i,b.charCodeAt(i));
  mv.setUint8(bl,128);mv.setUint32(ml-4,bl*8,false);
  for(var o=0;o<ml;o+=64){
    var W=new Array(64),a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
    for(var i=0;i<16;i++)W[i]=mv.getUint32(o+i*4,false);
    for(var i=16;i<64;i++){var s0=(R(W[i-15],7)^R(W[i-15],18)^S(W[i-15],3))>>>0;var s1=(R(W[i-2],17)^R(W[i-2],19)^S(W[i-2],10))>>>0;W[i]=A(A(A(s1,W[i-7]),s0),W[i-16]);}
    for(var i=0;i<64;i++){var S1=(R(e,6)^R(e,11)^R(e,25))>>>0;var ch=((e&f)^(~e&g))>>>0;var t1=A(A(A(A(h,S1),ch),K[i]),W[i]);var S0=(R(a,2)^R(a,13)^R(a,22))>>>0;var maj=((a&b)^(a&c)^(b&c))>>>0;var t2=A(S0,maj);h=g;g=f;f=e;e=A(d,t1);d=c;c=b;b=a;a=A(t1,t2);}
    H[0]=A(a,H[0]);H[1]=A(b,H[1]);H[2]=A(c,H[2]);H[3]=A(d,H[3]);H[4]=A(e,H[4]);H[5]=A(f,H[5]);H[6]=A(g,H[6]);H[7]=A(h,H[7]);
  }
  var hex='';for(var i=0;i<8;i++)hex+=H[i].toString(16).padStart(8,'0');
  return hex;
}

var USERS = __USERS__;
var TOKEN_KEY = 'ledger_login_v4';
var DATA = __DATA__;
var FIELDS = ['序号','当前位置','公用个人','责任人','资产编号','用户名','MAC地址','是否加域','IP地址','所属部门','采购日期','使用年限','本地账号','本地密码','分类','CPU','内存','硬盘','操作系统','备注'];
var LOGIN_USER = null;
var editingId = null, currentPage = 1, pageSize = 50, confirmCb = null, searchTimer = null, filterMode = '', sortField = '', sortDir = 1;

var opLogs = JSON.parse(localStorage.getItem('ledger_op_logs') || '[]');
function addOpLog(action, target, detail) {
  if(!LOGIN_USER) return;
  opLogs.push({time: new Date().toLocaleString(), user: LOGIN_USER.name, username: LOGIN_USER.username, action: action, target: target, detail: detail});
  if(opLogs.length > 500) opLogs = opLogs.slice(-500);
  localStorage.setItem('ledger_op_logs', JSON.stringify(opLogs));
  refreshLogPanel();
}
function refreshLogPanel() {
  var panel = document.getElementById('logPanel');
  var list = document.getElementById('logList');
  if(opLogs.length === 0) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  var recent = opLogs.slice(-20).reverse();
  list.innerHTML = recent.map(function(l) { return '<div style="padding:2px 0;border-bottom:1px solid #f5f5f5">['+l.time+'] <strong>'+l.user+'</strong> '+l.action+' '+l.target+' '+l.detail+'</div>'; }).join('');
}
function clearLogs() { opLogs = []; localStorage.removeItem('ledger_op_logs'); refreshLogPanel(); }

function doLogin() {
  var u = document.getElementById('loginUser').value.trim();
  var p = document.getElementById('loginPass').value;
  var err = document.getElementById('loginError');
  if(!u||!p) { err.textContent='请输入用户名和密码'; return; }
  try {
    var hash = sha256(p);
    var user = USERS[u];
    if(!user || user.pwd !== hash) { err.textContent='用户名或密码错误'; return; }
    LOGIN_USER = {username:u, name:user.name, role:user.role};
    localStorage.setItem(TOKEN_KEY, JSON.stringify({u:u, h:hash}));
    showApp(user);
  } catch(e) { err.textContent='登录出错，请重试'; }
}

function showApp(user) {
  document.getElementById('loginWrap').style.display='none';
  document.getElementById('appWrap').style.display='block';
  document.getElementById('loginUserName').textContent = user.name;
  document.getElementById('loginUserRole').textContent = user.role==='admin'?'(管理员)':'';
  updateStats();
  updateFilters();
  render();
  refreshLogPanel();
}

function doLogout() {
  LOGIN_USER = null;
  localStorage.removeItem(TOKEN_KEY);
  document.getElementById('loginWrap').style.display='flex';
  document.getElementById('appWrap').style.display='none';
  document.getElementById('loginPass').value = '';
  document.getElementById('loginError').textContent = '';
}

document.getElementById('loginPass').addEventListener('keydown', function(e) { if(e.key==='Enter') doLogin(); });
document.getElementById('loginUser').addEventListener('keydown', function(e) { if(e.key==='Enter') doLogin(); });

(function() {
  var saved = localStorage.getItem(TOKEN_KEY);
  if(!saved) return;
  try {
    var s = JSON.parse(saved);
    var user = USERS[s.u];
    if(user && user.pwd === s.h) {
      LOGIN_USER = {username:s.u, name:user.name, role:user.role};
      showApp(user);
    }
  } catch(e) {}
})();

function updateStats() {
  var d = DATA;
  var pp = {}; var depts = {}; var idle = 0;
  d.forEach(function(r) {
    var p = r['公用个人']||'未知'; pp[p] = (pp[p]||0)+1;
    var dept = r['所属部门']||'未知';
    // 取部门短名
    var shortDept = dept.split('-').pop() || dept;
    depts[shortDept] = (depts[shortDept]||0)+1;
    var pos = r['当前位置']||''; var person = r['责任人']||'';
    if(['空闲','备用','库存','闲置','未分配'].some(function(k){return pos.includes(k);}) || !person) idle++;
  });
  var items = [
    {icon:'blue',label:'总电脑数',value:d.length, action:'clear'},
    {icon:'green',label:'已用电脑',value:d.length - idle, action:'used'},
    {icon:'slate',label:'空闲电脑',value:idle, action:'idle'},
    {icon:'cyan',label:'公用电脑',value:pp['公用']||0, action:'public'},
    {icon:'red',label:'个人电脑',value:pp['个人']||0, action:'personal'},
  ];
  // 按数量排序的部门卡片
  var deptItems = [];
  Object.keys(depts).forEach(function(k){ deptItems.push({name:k, count:depts[k]}); });
  deptItems.sort(function(a,b){return b.count - a.count;});
  var deptColors = ['#2563eb','#16a34a','#ea580c','#9333ea','#0891b2','#dc2626','#4f46e5','#059669'];
  deptItems.forEach(function(di, idx){
    var color = deptColors[idx % deptColors.length];
    items.push({icon:'blue',label:di.name,value:di.count, action:'dept_'+di.name, color: color});
  });

  document.getElementById('statsRow').innerHTML = items.map(function(i) {
    var bg = i.color || '';
    return '<div class="stat-card" onclick="filterByCard(\''+i.action+'\')"><div class="stat-icon '+i.icon+'"'+(bg?' style="background:'+bg+'20;color:'+bg+'"':'')+'>'+i.label[0]+'</div><div><div class="stat-value">'+i.value+'</div><div class="stat-label">'+i.label+'</div></div></div>';
  }).join('');
}

function updateFilters() {
  var cats = []; var depts = []; var oss = [];
  DATA.forEach(function(r) { if(r['分类'] && cats.indexOf(r['分类'])<0) cats.push(r['分类']); if(r['所属部门'] && depts.indexOf(r['所属部门'])<0) depts.push(r['所属部门']); if(r['操作系统'] && oss.indexOf(r['操作系统'])<0) oss.push(r['操作系统']); });
  cats.sort(); depts.sort(); oss.sort();
  document.getElementById('filterCategory').innerHTML = '<option value="">全部分类</option>'+cats.map(function(c){return '<option value="'+c+'">'+c+'</option>';}).join('');
  document.getElementById('filterDepartment').innerHTML = '<option value="">全部部门</option>'+depts.map(function(d){return '<option value="'+d+'">'+d+'</option>';}).join('');
  document.getElementById('filterOS').innerHTML = '<option value="">全部系统</option>'+oss.map(function(o){return '<option value="'+o+'">'+o+'</option>';}).join('');
  document.getElementById('deptList').innerHTML = depts.map(function(d){return '<option value="'+d+'">';}).join('');
}

function getFilteredData() {
  var search = document.getElementById('searchInput').value.toLowerCase();
  var cat = document.getElementById('filterCategory').value;
  var dept = document.getElementById('filterDepartment').value;
  var ppv = document.getElementById('filterPublic').value;
  var osv = document.getElementById('filterOS').value;
  var filtered = DATA.slice();
  if(filterMode === 'idle') filtered = filtered.filter(function(r) { var pos = r['当前位置']||''; var person = r['责任人']||''; return ['空闲','备用','库存','闲置','未分配'].some(function(k){return pos.includes(k);}) || !person; });
  else if(filterMode === 'used') filtered = filtered.filter(function(r) { var pos = r['当前位置']||''; var person = r['责任人']||''; return !(['空闲','备用','库存','闲置','未分配'].some(function(k){return pos.includes(k);}) || !person); });
  if(search) filtered = filtered.filter(function(r){return FIELDS.some(function(f){return String(r[f]||'').toLowerCase().includes(search);});});
  if(cat) filtered = filtered.filter(function(r){return r['分类']===cat;});
  if(dept) filtered = filtered.filter(function(r){return (r['所属部门']||'').includes(dept);});
  if(ppv) filtered = filtered.filter(function(r){return r['公用个人']===ppv;});
  if(osv) filtered = filtered.filter(function(r){return (r['操作系统']||'')===osv;});
  // 排序
  if(sortField) {
    filtered.sort(function(a, b) {
      var va = (a[sortField] || '').toString();
      var vb = (b[sortField] || '').toString();
      var na = parseFloat(va), nb = parseFloat(vb);
      if(!isNaN(na) && !isNaN(nb) && va === String(na) && vb === String(nb)) { return (na - nb) * sortDir; }
      return va.localeCompare(vb, 'zh-CN') * sortDir;
    });
  }
  return filtered;
}

function calcYears(r) {
  var py = r['采购日期']||'';
  if(!py || py === '/') return '';
  var year = parseInt(py);
  if(isNaN(year)) return py;
  return String(new Date().getFullYear() - year);
}

function render() {
  var filtered = getFilteredData();
  var total = filtered.length;
  var totalPages = Math.max(1, Math.ceil(total/pageSize));
  if(currentPage > totalPages) currentPage = totalPages;
  var start = (currentPage-1)*pageSize;
  var page = filtered.slice(start, start+pageSize);

  var catBadge = {'台式':'bg-blue','笔记本':'bg-green','一体机':'bg-yellow','sruface':'bg-purple'};
  var isAdmin = LOGIN_USER && LOGIN_USER.role === 'admin';

  function thSort(field, label) {
    var arrow = '';
    if(sortField === field) arrow = sortDir === 1 ? ' \u25b2' : ' \u25bc';
    return '<th style="cursor:pointer" onclick="toggleSort(\''+field+'\')">'+label+arrow+'</th>';
  }

  document.getElementById('tableWrapper').innerHTML = '<table><thead><tr>'+
    thSort('序号','序号')+
    thSort('当前位置','当前位置')+
    thSort('公用个人','公用/个人')+
    thSort('责任人','责任人')+
    thSort('资产编号','资产编号')+
    thSort('用户名','用户名')+
    thSort('MAC地址','MAC地址')+
    thSort('是否加域','加域')+
    thSort('IP地址','IP地址')+
    thSort('所属部门','所属部门')+
    thSort('采购日期','采购日期')+
    thSort('使用年限','使用年限')+
    thSort('本地账号','本地账号')+
    thSort('分类','分类')+
    thSort('CPU','CPU')+
    thSort('内存','内存')+
    thSort('硬盘','硬盘')+
    thSort('操作系统','操作系统')+
    thSort('备注','备注')+
    '<th>操作</th>'+
    '</tr></thead><tbody>'+
    page.map(function(r) {
      var ppBadge = (r['公用个人']==='个人')?'bg-pink':'bg-cyan';
      var pos = r['当前位置']||'';
      var deptName = r['所属部门']||'';
      var ops = '<button class="btn btn-outline btn-sm" onclick="editDevice(\''+r['序号']+'\')">\u270f\ufe0f</button>';
      if(isAdmin) ops += '<button class="btn btn-danger btn-sm" onclick="confirmDelete(\''+r['序号']+'\')">\ud83d\uddd1</button>';
      return '<tr>'+
        '<td>'+r['序号']+'</td>'+
        '<td title="'+pos+'">'+pos.substring(0,15)+(pos.length>15?'...':'')+'</td>'+
        '<td><span class="badge '+ppBadge+'">'+(r['公用个人']||'-')+'</span></td>'+
        '<td>'+(r['责任人']||'')+'</td>'+
        '<td><strong>'+(r['资产编号']||'')+'</strong></td>'+
        '<td>'+(r['用户名']||'')+'</td>'+
        '<td style="font-family:monospace;font-size:10px">'+(r['MAC地址']||'')+'</td>'+
        '<td><span class="badge '+(r['是否加域']==='是'?'bg-yes':'bg-no')+'">'+(r['是否加域']||'-')+'</span></td>'+
        '<td style="font-family:monospace">'+(r['IP地址']||'')+'</td>'+
        '<td title="'+deptName+'">'+deptName.substring(0,12)+(deptName.length>12?'...':'')+'</td>'+
        '<td>'+(r['采购日期']||'')+'</td>'+
        '<td'+(calcYears(r)>5?' style="color:#dc2626;font-weight:700"':'')+'>'+calcYears(r)+'</td>'+
        '<td>'+(r['本地账号']||'')+'</td>'+
        '<td><span class="badge '+(catBadge[r['分类']]||'bg-blue')+'">'+(r['分类']||'-')+'</span></td>'+
        '<td>'+(r['CPU']||'')+'</td>'+
        '<td>'+(r['内存']||'')+'</td>'+
        '<td>'+(r['硬盘']||'')+'</td>'+
        '<td>'+(r['操作系统']||'')+'</td>'+
        '<td style="max-width:100px;overflow:hidden;text-overflow:ellipsis" title="'+(r['备注']||'')+'">'+(r['备注']||'')+'</td>'+
        '<td>'+ops+'</td>'+
        '</tr>';
    }).join('')+
    '</tbody></table>';

  var pag = document.getElementById('pagination');
  var ph = ''; var maxB = 7;
  var s = Math.max(1, currentPage-3), e = Math.min(totalPages, s+maxB-1);
  if(e-s < maxB-1) s = Math.max(1, e-maxB+1);
  ph += '<button '+(currentPage===1?'disabled':'')+' onclick="goPage('+(currentPage-1)+')">\u25c0</button>';
  for(var i=s;i<=e;i++) ph += '<button class="'+(i===currentPage?'active':'')+'" onclick="goPage('+i+')">'+i+'</button>';
  ph += '<button '+(currentPage===totalPages?'disabled':'')+' onclick="goPage('+(currentPage+1)+')">\u25b6</button>';
  pag.innerHTML = '<div class="pagination-info">共 <strong>'+total+'</strong> 台电脑，第 '+currentPage+'/'+totalPages+' 页 &nbsp; 每页 <select onchange="changePageSize(this.value)" style="height:28px;border:1px solid #d1d5db;border-radius:4px;font-size:12px">'+
    '<option value="50"'+(pageSize===50?' selected':'')+'>50条</option>'+
    '<option value="100"'+(pageSize===100?' selected':'')+'>100条</option>'+
    '<option value="200"'+(pageSize===200?' selected':'')+'>200条</option>'+
    '<option value="500"'+(pageSize===500?' selected':'')+'>500条</option>'+
    '</select></div><div class="pagination-btns">'+ph+'</div>';
}

function toggleSort(field) {
  if(sortField === field) { sortDir = -sortDir; }
  else { sortField = field; sortDir = 1; }
  currentPage = 1;
  render();
}

function changePageSize(size) { pageSize = parseInt(size); currentPage = 1; render(); }

function goPage(p) { if(p>=1 && p<=Math.ceil(getFilteredData().length/pageSize)){ currentPage=p; render(); } }
function reload() { currentPage=1; render(); }
function debounceSearch() { clearTimeout(searchTimer); searchTimer = setTimeout(function(){ currentPage=1; render(); }, 300); }

function filterByCard(action) {
  document.getElementById('searchInput').value = '';
  document.getElementById('filterCategory').value = '';
  document.getElementById('filterDepartment').value = '';
  document.getElementById('filterPublic').value = '';
  document.getElementById('filterOS').value = '';
  filterMode = (action === 'clear') ? '' : action;
  if(action.indexOf('dept_') === 0) {
    filterMode = '';
    document.getElementById('filterDepartment').value = ''; // 会通过 includes 匹配
    // 用搜索来筛选部门
    document.getElementById('searchInput').value = action.substring(5);
  }
  currentPage = 1;
  render();
}

function openModal(id) {
  if(!LOGIN_USER) { showToast('\u8bf7\u5148\u767b\u5f55', 'error'); return; }
  editingId = id || null;
  document.getElementById('modalTitle').textContent = id ? '\u7f16\u8f91\u7535\u8111 #'+id : '\u65b0\u589e\u7535\u8111';
  document.getElementById('editForm').reset();
  if(id) {
    var r = DATA.find(function(d){return d['\u5e8f\u53f7']===id;});
    if(r) {
      var form = document.getElementById('editForm');
      FIELDS.forEach(function(f){ var el = form.querySelector('[name="'+f+'"]'); if(el && r[f]!==undefined) el.value = r[f]; });
    }
  }
  document.getElementById('editModal').classList.add('active');
}

function editDevice(id) { openModal(id); }
function closeModal() { document.getElementById('editModal').classList.remove('active'); }

function saveDevice() {
  var form = document.getElementById('editForm');
  var fd = new FormData(form);
  var obj = {};
  FIELDS.forEach(function(f){ obj[f] = fd.get(f) || ''; });
  if(editingId) {
    var idx = DATA.findIndex(function(d){return d['\u5e8f\u53f7']===editingId;});
    if(idx >= 0) {
      var merged = {}; Object.keys(DATA[idx]).forEach(function(k){merged[k]=DATA[idx][k];}); Object.keys(obj).forEach(function(k){merged[k]=obj[k];}); merged['\u5e8f\u53f7']=editingId;
      DATA[idx] = merged;
    }
  } else {
    var maxId = Math.max.apply(null, [0].concat(DATA.map(function(d){return parseInt(d['\u5e8f\u53f7'])||0;})));
    obj['\u5e8f\u53f7'] = String(maxId + 1);
    DATA.push(obj);
  }
  closeModal();
  addOpLog(editingId ? '\u7f16\u8f91' : '\u65b0\u589e', '#'+obj['\u5e8f\u53f7'], obj['\u5206\u7c7b']+' - '+obj['\u5f53\u524d\u4f4d\u7f6e']);
  updateStats();
  render();
  showToast(editingId ? '\u7535\u8111\u66f4\u65b0\u6210\u529f' : '\u7535\u8111\u6dfb\u52a0\u6210\u529f', 'success');
}

function confirmDelete(id) {
  if(!LOGIN_USER || LOGIN_USER.role !== 'admin') { showToast('\u4ec5\u7ba1\u7406\u5458\u53ef\u5220\u9664', 'error'); return; }
  document.getElementById('confirmMsg').textContent = '\u786e\u8ba4\u5220\u9664\u5e8f\u53f7\u4e3a '+id+' \u7684\u7535\u8111\uff1f';
  document.getElementById('confirmDialog').classList.add('active');
  confirmCb = function() {
    var del = DATA.find(function(d){return d['\u5e8f\u53f7']===id;});
    DATA = DATA.filter(function(d){return d['\u5e8f\u53f7']!==id;});
    addOpLog('\u5220\u9664', '#'+id, del ? del['\u5206\u7c7b']+' - '+del['\u5f53\u524d\u4f4d\u7f6e'] : '');
    updateStats();
    render();
    showToast('\u5df2\u5220\u9664', 'success');
  };
}

function closeConfirm() { document.getElementById('confirmDialog').classList.remove('active'); confirmCb = null; }
function executeConfirm() { if(confirmCb){ confirmCb(); closeConfirm(); } }

function exportCSV() {
  var filtered = getFilteredData();
  var csv = '\uFEFF' + FIELDS.join(',') + '\n';
  filtered.forEach(function(r){
    csv += FIELDS.map(function(f){ var v = String(r[f]||''); if(v.includes(',')||v.includes('"')||v.includes('\n')) v = '"'+v.replace(/"/g,'""')+'"'; return v; }).join(',')+'\n';
  });
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '\u7535\u8111\u53f0\u8d26_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  addOpLog('\u5bfc\u51fa', filtered.length+'\u6761\u8bb0\u5f55', '');
  showToast('\u5bfc\u51fa\u6210\u529f', 'success');
}

function importData(input) {
  if(!LOGIN_USER) { showToast('\u8bf7\u5148\u767b\u5f55', 'error'); return; }
  var file = input.files[0];
  if(!file) return;
  var ext = file.name.split('.').pop().toLowerCase();
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var imported;
      if(ext === 'json') { imported = JSON.parse(e.target.result); if(!Array.isArray(imported)) imported = imported.data || []; }
      else {
        var lines = e.target.result.split('\n').filter(Boolean);
        if(lines.length < 2) { showToast('\u6587\u4ef6\u683c\u5f0f\u9519\u8bef', 'error'); return; }
        var headers = lines[0].replace(/^\uFEFF/,'').split(',');
        imported = lines.slice(1).map(function(line) {
          var vals = [], inQ = false, cur = '';
          for(var ci=0;ci<line.length;ci++) { var ch=line[ci]; if(ch==='"') inQ = !inQ; else if(ch===',' && !inQ) { vals.push(cur); cur = ''; } else cur += ch; }
          vals.push(cur);
          var obj = {}; headers.forEach(function(h,i){ obj[h.trim()] = (vals[i]||'').replace(/^"|"$/g,''); });
          return obj;
        });
      }
      if(imported.length === 0) { showToast('\u672a\u8bc6\u522b\u5230\u6570\u636e', 'error'); return; }
      document.getElementById('confirmMsg').textContent = '\u786e\u8ba4\u5bfc\u5165 '+imported.length+' \u6761\u6570\u636e\uff1f';
      document.getElementById('confirmDialog').classList.add('active');
      confirmCb = function() {
        DATA = imported;
        addOpLog('\u5bfc\u5165', imported.length+'\u6761\u8bb0\u5f55', '');
        updateStats();
        updateFilters();
        render();
        showToast('\u5df2\u5bfc\u5165 '+imported.length+' \u6761', 'success');
      };
    } catch(err) { showToast('\u89e3\u6790\u5931\u8d25: '+err.message, 'error'); }
  };
  if(ext === 'json') reader.readAsText(file); else reader.readAsText(file);
  input.value = '';
}

function showToast(msg, type) {
  var el = document.createElement('div');
  el.className = 'toast '+type;
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(function(){ el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(function(){el.remove();},300); }, 2500);
}

document.getElementById('editModal').addEventListener('click', function(e){ if(e.target===this) closeModal(); });
document.getElementById('confirmDialog').addEventListener('click', function(e){ if(e.target===this) closeConfirm(); });
